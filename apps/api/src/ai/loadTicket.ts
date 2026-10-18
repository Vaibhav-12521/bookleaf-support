import { prisma } from '../lib/prisma';
import type { TicketWithContext } from './context';

export function loadTicketForAi(ticketId: string): Promise<TicketWithContext | null> {
  return prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      author: { include: { user: { select: { name: true, email: true } }, books: { orderBy: { id: 'asc' } } } },
      book: true,
      messages: { orderBy: { createdAt: 'asc' }, include: { sender: { select: { name: true, role: true } } } },
    },
  });
}
