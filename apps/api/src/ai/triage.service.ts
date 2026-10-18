import { CATEGORY_LABELS, PRIORITY_LABELS } from '@bookleaf/shared';
import { notFound } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { sseHub } from '../realtime/sseHub';
import { buildAccountFacts, type TicketWithContext } from './context';
import { isRoyaltyOverdue } from '../domain/royalty';
import { getAiProvider } from './index';
import { loadTicketForAi } from './loadTicket';
import { buildTriagePrompt, triageOutputSchema } from './prompts';
import { AiError, describeAiError } from './provider';
import { applyPriorityPolicy } from './rules';
import { normalizeModelText } from './text';
import { recordAiEvent } from './usage';

let queue: Promise<void> = Promise.resolve();

export function enqueueTriage(ticketId: string): Promise<void> {
  queue = queue.then(() => triageTicket(ticketId)).catch((err) => {
    logger.error('Triage job crashed', { ticketId, error: String(err) });
  });
  return queue;
}

export const triageQueueIdle = (): Promise<void> => queue;

export async function triageTicket(ticketId: string): Promise<void> {
  const ticket = await loadTicketForAi(ticketId);
  if (!ticket) return;

  const provider = getAiProvider();
  if (!provider) {
    await markFailed(ticketId, ticket.authorId, 'NOT_CONFIGURED');
    return;
  }

  const prompt = buildTriagePrompt({
    subject: ticket.subject,
    description: ticket.description,
    accountFacts: buildAccountFacts(ticket, { purpose: 'triage' }),
  });

  try {
    const result = await provider.generateStructured(
      { ...prompt, maxTokens: 1500, effort: 'low' },
      triageOutputSchema,
    );
    await recordAiEvent({
      ticketId,
      operation: 'TRIAGE',
      model: result.model,
      success: true,
      usage: result.usage,
      latencyMs: result.latencyMs,
    });

    const ai = result.value;
    const priority = applyPriorityPolicy(ai.category, ai.priority, `${ticket.subject}\n${ticket.description}`, royaltyFacts(ticket));
    const reasoning =
      priority !== ai.priority
        ? `${ai.reasoning} (Raised from ${PRIORITY_LABELS[ai.priority]} to ${PRIORITY_LABELS[priority]} by ${CATEGORY_LABELS[ai.category]} policy.)`
        : ai.reasoning;

    await prisma.$transaction([
      prisma.ticket.update({
        where: { id: ticketId },
        data: {
          triageStatus: 'COMPLETED',
          aiCategory: ai.category,
          aiPriority: priority,
          aiConfidence: Math.min(1, Math.max(0, ai.confidence)),
          aiReasoning: normalizeModelText(reasoning).slice(0, 500),
          triageError: null,
        },
      }),
      prisma.ticket.updateMany({
        where: { id: ticketId, categorySource: { not: 'ADMIN' } },
        data: { category: ai.category, categorySource: 'AI' },
      }),
      prisma.ticket.updateMany({
        where: { id: ticketId, prioritySource: { not: 'ADMIN' } },
        data: { priority, prioritySource: 'AI' },
      }),
    ]);
    sseHub.publish({ type: 'ticket.updated', ticketId }, { authorId: ticket.authorId, adminsOnly: true });
  } catch (err) {
    const aiError = err instanceof AiError ? err : new AiError('UNAVAILABLE', String(err));
    await recordAiEvent({
      ticketId,
      operation: 'TRIAGE',
      model: provider.model,
      success: false,
      usage: aiError.usage,
      latencyMs: aiError.latencyMs ?? 0,
      errorCode: aiError.code,
    });
    await markFailed(ticketId, ticket.authorId, aiError.code);
  }
}

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function royaltyFacts(ticket: TicketWithContext, today = new Date()) {
  const books = ticket.book ? [ticket.book] : ticket.author.books;
  const accountPending = ticket.author.books.reduce((acc, b) => acc + b.royaltyPending, 0);
  const overdue = books.filter((b) => isRoyaltyOverdue(b, today, accountPending));
  return {
    royaltyOverdue: overdue.length > 0,
    neverPaidForOverAYear: overdue.some(
      (b) => !b.lastPayoutDate && b.publicationDate && today.getTime() - b.publicationDate.getTime() > YEAR_MS,
    ),
  };
}

async function markFailed(ticketId: string, authorId: string, code: AiError['code']) {
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { triageStatus: 'FAILED', triageError: `${describeAiError(code)} Using rule-based triage.` },
  });
  sseHub.publish({ type: 'ticket.updated', ticketId }, { authorId, adminsOnly: true });
}

export async function requestRetriage(ticketId: string): Promise<void> {
  const updated = await prisma.ticket.updateMany({
    where: { id: ticketId },
    data: { triageStatus: 'PENDING', triageError: null },
  });
  if (updated.count === 0) throw notFound('Ticket');
  void enqueueTriage(ticketId);
}

export async function resumePendingTriage(): Promise<void> {
  const pending = await prisma.ticket.findMany({
    where: { triageStatus: 'PENDING' },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
  if (pending.length) logger.info('Resuming pending triage', { count: pending.length });
  for (const { id } of pending) void enqueueTriage(id);
}
