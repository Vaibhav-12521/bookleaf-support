import type { DraftDTO } from '@bookleaf/shared';
import { notFound } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { nextPayoutSchedule } from '../domain/royalty';
import { buildAccountFacts, buildThread } from './context';
import { getAiProvider } from './index';
import { loadTicketForAi } from './loadTicket';
import { buildDraftPrompt } from './prompts';
import { AiError, describeAiError } from './provider';
import { renderTemplate } from './templates';
import { correctNearMisses, enforceGreeting, normalizeModelText } from './text';
import { recordAiEvent } from './usage';
import { ticketReference } from '../modules/tickets/ticket.mapper';

export async function getDraft(ticketId: string, options: { regenerate?: boolean } = {}): Promise<DraftDTO> {
  // A draft is "as of" the moment its context was read, not when generation finished:
  // a message that arrives while the model is writing must make the draft stale.
  const contextReadAt = new Date();
  const ticket = await loadTicketForAi(ticketId);
  if (!ticket) throw notFound('Ticket');

  const messageCount = ticket.messages.length;
  const cached = await prisma.aiDraft.findUnique({ where: { ticketId } });
  if (!options.regenerate && cached && cached.messageCount === messageCount && cached.category === ticket.category) {
    return {
      ticketId,
      content: cached.content,
      source: 'AI',
      model: cached.model,
      createdAt: cached.createdAt.toISOString(),
      notice: null,
    };
  }

  const fallback = (notice: string): DraftDTO => ({
    ticketId,
    content: renderTemplate(ticket.category, {
      firstName: ticket.author.user.name.split(' ')[0] ?? ticket.author.user.name,
      bookTitle: ticket.book?.title ?? null,
      nextPayoutDate: nextPayoutSchedule(new Date()).nextPayoutDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }),
    }),
    source: 'TEMPLATE',
    model: null,
    createdAt: contextReadAt.toISOString(),
    notice,
  });

  const provider = getAiProvider();
  if (!provider) return fallback(`${describeAiError('NOT_CONFIGURED')} Loaded a reply template instead.`);

  const prompt = buildDraftPrompt({
    category: ticket.category,
    priority: ticket.priority,
    reference: ticketReference(ticket.number),
    accountFacts: buildAccountFacts(ticket, { purpose: 'draft' }),
    thread: buildThread(ticket),
  });

  try {
    const result = await provider.generateText({ ...prompt, maxTokens: 3000, effort: 'low', maxRetries: 1 });
    await recordAiEvent({
      ticketId,
      operation: 'DRAFT',
      model: result.model,
      success: true,
      usage: result.usage,
      latencyMs: result.latencyMs,
    });
    const firstName = ticket.author.user.name.split(' ')[0] ?? ticket.author.user.name;
    const content = enforceGreeting(
      correctNearMisses(normalizeModelText(result.value), [firstName, ...ticket.author.books.map((b) => b.title)]),
      firstName,
    );
    const saved = await prisma.aiDraft.upsert({
      where: { ticketId },
      create: { ticketId, content, model: result.model, category: ticket.category, messageCount, createdAt: contextReadAt },
      update: { content, model: result.model, category: ticket.category, messageCount, createdAt: contextReadAt },
    });
    return {
      ticketId,
      content: saved.content,
      source: 'AI',
      model: saved.model,
      createdAt: saved.createdAt.toISOString(),
      notice: null,
    };
  } catch (err) {
    const aiError = err instanceof AiError ? err : new AiError('UNAVAILABLE', String(err));
    await recordAiEvent({
      ticketId,
      operation: 'DRAFT',
      model: provider.model,
      success: false,
      usage: aiError.usage,
      latencyMs: aiError.latencyMs ?? 0,
      errorCode: aiError.code,
    });
    return fallback(`${describeAiError(aiError.code)} Loaded a reply template instead.`);
  }
}
