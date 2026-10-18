import type { Prisma } from '@prisma/client';
import type {
  CreateMessageData,
  CreateTicketInput,
  MessageDTO,
  Paginated,
  SessionUser,
  TicketDetailDTO,
  TicketListQuery,
  TicketSummaryDTO,
  UpdateTicketInput,
} from '@bookleaf/shared';
import { findDraftPlaceholders } from '@bookleaf/shared';
import { classifyByRules } from '../../ai/rules';
import { enqueueTriage } from '../../ai/triage.service';
import { toBookDTO } from '../../domain/book.mapper';
import { conflict, forbidden, notFound, validationError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { sseHub } from '../../realtime/sseHub';
import { messageInclude, toMessageDTO, toTicketDetail, toTicketSummary } from './ticket.mapper';
import { findTicketDetail, findTickets, visibleTo } from './tickets.repository';

export async function listTickets(viewer: SessionUser, query: TicketListQuery): Promise<Paginated<TicketSummaryDTO>> {
  const { items, total } = await findTickets(viewer, query);
  return { items: items.map(toTicketSummary), page: query.page, pageSize: query.pageSize, total };
}

export async function getTicket(viewer: SessionUser, id: string): Promise<TicketDetailDTO> {
  const ticket = await findTicketDetail(viewer, id);
  if (!ticket) throw notFound('Ticket');
  if (viewer.role !== 'ADMIN') return toTicketDetail(ticket);

  const author = await prisma.author.findUniqueOrThrow({
    where: { id: ticket.authorId },
    include: { user: { select: { name: true, email: true } }, books: { orderBy: { id: 'asc' } } },
  });
  const accountPending = author.books.reduce((acc, b) => acc + b.royaltyPending, 0);
  return toTicketDetail(ticket, {
    triage: {
      status: ticket.triageStatus,
      categorySource: ticket.categorySource,
      prioritySource: ticket.prioritySource,
      aiCategory: ticket.aiCategory,
      aiPriority: ticket.aiPriority,
      confidence: ticket.aiConfidence,
      reasoning: ticket.aiReasoning,
      error: ticket.triageError,
    },
    authorContext: {
      id: author.id,
      name: author.user.name,
      email: author.user.email,
      city: author.city,
      joinedDate: author.joinedDate.toISOString().slice(0, 10),
      books: author.books.map((b) => toBookDTO(b, accountPending)),
    },
  });
}

export async function createTicket(viewer: SessionUser, input: CreateTicketInput): Promise<TicketDetailDTO> {
  if (viewer.role !== 'AUTHOR' || !viewer.authorId) throw forbidden('Only authors can raise support tickets');

  if (input.bookId) {
    const book = await prisma.book.findFirst({ where: { id: input.bookId, authorId: viewer.authorId } });
    if (!book) throw validationError([{ path: 'bookId', message: 'Select one of your own books' }]);
  }

  const rules = classifyByRules(input.subject, input.description);
  const ticket = await prisma.ticket.create({
    data: {
      authorId: viewer.authorId,
      bookId: input.bookId,
      subject: input.subject,
      description: input.description,
      attachment: input.attachment ?? undefined,
      category: rules.category,
      priority: rules.priority,
      categorySource: 'RULES',
      prioritySource: 'RULES',
      triageStatus: 'PENDING',
    },
  });

  sseHub.publish({ type: 'ticket.created', ticketId: ticket.id }, { authorId: viewer.authorId });
  void enqueueTriage(ticket.id);
  return getTicket(viewer, ticket.id);
}

export async function updateTicket(viewer: SessionUser, id: string, input: UpdateTicketInput): Promise<TicketDetailDTO> {
  const existing = await prisma.ticket.findUnique({ where: { id } });
  if (!existing) throw notFound('Ticket');

  const data: Prisma.TicketUncheckedUpdateInput = {};
  if (input.status && input.status !== existing.status) Object.assign(data, statusChange(input.status));
  if (input.category) Object.assign(data, { category: input.category, categorySource: 'ADMIN' });
  if (input.priority) Object.assign(data, { priority: input.priority, prioritySource: 'ADMIN' });
  if (input.assigneeId !== undefined) {
    if (input.assigneeId !== null) {
      const assignee = await prisma.user.findFirst({ where: { id: input.assigneeId, role: 'ADMIN' } });
      if (!assignee) throw validationError([{ path: 'assigneeId', message: 'Tickets can only be assigned to BookLeaf team members' }]);
    }
    data.assigneeId = input.assigneeId;
  }

  await prisma.ticket.update({ where: { id }, data });
  sseHub.publish(
    { type: 'ticket.updated', ticketId: id },
    { authorId: existing.authorId, adminsOnly: input.status === undefined },
  );
  return getTicket(viewer, id);
}

export async function addMessage(viewer: SessionUser, ticketId: string, input: CreateMessageData): Promise<MessageDTO> {
  const ticket = await prisma.ticket.findFirst({ where: { AND: [{ id: ticketId }, visibleTo(viewer)] } });
  if (!ticket) throw notFound('Ticket');

  const now = new Date();
  let type: 'AUTHOR_MESSAGE' | 'ADMIN_REPLY' | 'INTERNAL_NOTE';
  let ticketUpdate: Prisma.TicketUncheckedUpdateInput = {};

  if (viewer.role === 'AUTHOR') {
    if (ticket.status === 'CLOSED') throw conflict('This ticket is closed. Please raise a new ticket if you still need help.');
    type = 'AUTHOR_MESSAGE';
    ticketUpdate = { awaitingTeam: true, ...(ticket.status === 'RESOLVED' ? statusChange('OPEN') : {}) };
  } else if (input.kind === 'NOTE') {
    type = 'INTERNAL_NOTE';
    if (input.status && input.status !== ticket.status) ticketUpdate = statusChange(input.status);
  } else {
    const placeholders = findDraftPlaceholders(input.body);
    if (placeholders.length) {
      throw validationError([{ path: 'body', message: `Fill in the placeholders before sending: ${placeholders.join(', ')}` }]);
    }
    type = 'ADMIN_REPLY';
    const nextStatus = input.status ?? (ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status);
    ticketUpdate = {
      awaitingTeam: false,
      firstResponseAt: ticket.firstResponseAt ?? now,
      assigneeId: ticket.assigneeId ?? viewer.id,
      ...(nextStatus !== ticket.status ? statusChange(nextStatus) : {}),
    };
  }

  const [message] = await prisma.$transaction([
    prisma.ticketMessage.create({
      data: { ticketId, senderId: viewer.id, type, body: input.body, fromAiDraft: type === 'ADMIN_REPLY' && !!input.fromAiDraft },
      include: messageInclude,
    }),
    prisma.ticket.update({ where: { id: ticketId }, data: { ...ticketUpdate, updatedAt: now } }),
  ]);

  sseHub.publish(
    { type: 'message.created', ticketId, messageType: type },
    { authorId: ticket.authorId, adminsOnly: type === 'INTERNAL_NOTE' },
  );
  return toMessageDTO(message);
}

function statusChange(status: TicketDetailDTO['status']): Prisma.TicketUncheckedUpdateInput {
  const done = status === 'RESOLVED' || status === 'CLOSED';
  return { status, resolvedAt: done ? new Date() : null };
}
