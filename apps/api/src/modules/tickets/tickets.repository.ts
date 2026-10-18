import type { Prisma } from '@prisma/client';
import type { SessionUser, TicketListQuery } from '@bookleaf/shared';
import { prisma } from '../../lib/prisma';
import { messageInclude, ticketSummaryInclude } from './ticket.mapper';

export function visibleTo(viewer: SessionUser): Prisma.TicketWhereInput {
  return viewer.role === 'ADMIN' ? {} : { authorId: viewer.authorId ?? '__none__' };
}

export function messagesVisibleTo(viewer: SessionUser): Prisma.TicketMessageWhereInput {
  return viewer.role === 'ADMIN' ? {} : { type: { not: 'INTERNAL_NOTE' } };
}

function buildWhere(viewer: SessionUser, q: TicketListQuery): Prisma.TicketWhereInput {
  const and: Prisma.TicketWhereInput[] = [visibleTo(viewer)];
  if (q.status?.length) and.push({ status: { in: q.status } });
  if (q.category?.length) and.push({ category: { in: q.category } });
  if (q.priority?.length) and.push({ priority: { in: q.priority } });
  if (q.from) and.push({ createdAt: { gte: q.from } });
  if (q.to) and.push({ createdAt: { lte: endOfDay(q.to) } });
  if (viewer.role === 'ADMIN' && q.assignee === 'me') and.push({ assigneeId: viewer.id });
  if (viewer.role === 'ADMIN' && q.assignee === 'unassigned') and.push({ assigneeId: null });
  if (q.q) {
    const term = q.q;
    const or: Prisma.TicketWhereInput[] = [
      { subject: { contains: term, mode: 'insensitive' } },
      { author: { user: { name: { contains: term, mode: 'insensitive' } } } },
      { book: { title: { contains: term, mode: 'insensitive' } } },
    ];
    const ref = Number(term.replace(/^bl-?/i, ''));
    if (Number.isInteger(ref) && ref > 0) or.push({ number: ref });
    and.push({ OR: or });
  }
  return { AND: and };
}

const SORTS: Record<TicketListQuery['sort'], Prisma.TicketOrderByWithRelationInput[]> = {
  urgency: [{ priority: 'asc' }, { createdAt: 'asc' }],
  oldest: [{ createdAt: 'asc' }],
  newest: [{ createdAt: 'desc' }],
  updated: [{ updatedAt: 'desc' }],
};

export async function findTickets(viewer: SessionUser, q: TicketListQuery) {
  const where = buildWhere(viewer, q);
  const [items, total] = await prisma.$transaction([
    prisma.ticket.findMany({
      where,
      include: ticketSummaryInclude,
      orderBy: SORTS[q.sort],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.ticket.count({ where }),
  ]);
  return { items, total };
}

export function findTicketDetail(viewer: SessionUser, id: string) {
  return prisma.ticket.findFirst({
    where: { AND: [{ id }, visibleTo(viewer)] },
    include: {
      ...ticketSummaryInclude,
      messages: { where: messagesVisibleTo(viewer), orderBy: { createdAt: 'asc' }, include: messageInclude },
    },
  });
}

function endOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(23, 59, 59, 999);
  return copy;
}
