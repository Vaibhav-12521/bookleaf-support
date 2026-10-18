import type { Prisma } from '@prisma/client';
import type { AttachmentDTO, MessageDTO, TicketDetailDTO, TicketSummaryDTO } from '@bookleaf/shared';

export const ticketReference = (n: number) => `BL-${n.toString().padStart(5, '0')}`;

export const ticketSummaryInclude = {
  author: { select: { id: true, user: { select: { name: true } } } },
  book: { select: { id: true, title: true } },
  assignee: { select: { id: true, name: true } },
} satisfies Prisma.TicketInclude;

export type TicketWithSummary = Prisma.TicketGetPayload<{ include: typeof ticketSummaryInclude }>;

export const messageInclude = {
  sender: { select: { id: true, name: true, role: true } },
} satisfies Prisma.TicketMessageInclude;

export type MessageWithSender = Prisma.TicketMessageGetPayload<{ include: typeof messageInclude }>;

export function toTicketSummary(t: TicketWithSummary): TicketSummaryDTO {
  return {
    id: t.id,
    reference: ticketReference(t.number),
    subject: t.subject,
    status: t.status,
    category: t.category,
    priority: t.priority,
    book: t.book ? { id: t.book.id, title: t.book.title } : null,
    author: { id: t.author.id, name: t.author.user.name },
    assignee: t.assignee ? { id: t.assignee.id, name: t.assignee.name } : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    firstResponseAt: t.firstResponseAt?.toISOString() ?? null,
    awaitingTeam: t.awaitingTeam,
  };
}

export function toMessageDTO(m: MessageWithSender): MessageDTO {
  return {
    id: m.id,
    type: m.type,
    body: m.body,
    sender: { id: m.sender.id, name: m.sender.name, role: m.sender.role },
    createdAt: m.createdAt.toISOString(),
  };
}

export function toTicketDetail(
  t: TicketWithSummary & { messages: MessageWithSender[] },
  extras: Pick<TicketDetailDTO, 'triage' | 'authorContext'> = {},
): TicketDetailDTO {
  return {
    ...toTicketSummary(t),
    description: t.description,
    attachment: (t.attachment as AttachmentDTO | null) ?? null,
    resolvedAt: t.resolvedAt?.toISOString() ?? null,
    messages: t.messages.map(toMessageDTO),
    ...extras,
  };
}
