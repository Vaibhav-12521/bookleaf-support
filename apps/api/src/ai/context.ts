import type { Author, Book, MessageType, Ticket, TicketMessage, User } from '@prisma/client';
import { isPublished } from '../domain/production';
import {
  PAYOUT_THRESHOLD_INR,
  isBelowPayoutThreshold,
  isRoyaltyOverdue,
  nextPayoutSchedule,
  toDisplayDate,
} from '../domain/royalty';

const MAX_DESCRIPTION_CHARS = 3000;
const MAX_MESSAGE_CHARS = 1200;
const MAX_THREAD_MESSAGES = 6;

export type TicketWithContext = Ticket & {
  author: Author & { user: Pick<User, 'name' | 'email'>; books: Book[] };
  book: Book | null;
  messages: (TicketMessage & { sender: Pick<User, 'name' | 'role'> })[];
};

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function payoutStatus(b: Book, today: Date, accountPending: number): string {
  if (b.royaltyPending === 0) return b.royaltyEarned > 0 ? 'fully paid up' : 'nothing owed yet';
  if (isBelowPayoutThreshold(accountPending)) {
    return `the author's total pending royalty (${inr(accountPending)}) is below the ₹1,000 minimum, so it rolls over to the next quarter (not overdue)`;
  }
  if (isRoyaltyOverdue(b, today, accountPending)) {
    const since = b.lastPayoutDate
      ? `the last payout on ${toDisplayDate(b.lastPayoutDate)}`
      : `publication on ${b.publicationDate ? toDisplayDate(b.publicationDate) : 'an unknown date'} (never paid)`;
    return `OVERDUE: ${inr(b.royaltyPending)} payable and nothing paid since ${since}; this is BookLeaf's delay to own and escalate`;
  }
  return 'pending balance is due at the next payout date';
}

export function describeBook(
  b: Book,
  today = new Date(),
  options: { royalties?: boolean; accountPending?: number } = {},
): string {
  const royalties = options.royalties ?? true;
  const accountPending = options.accountPending ?? b.royaltyPending;
  if (!isPublished(b.status)) {
    return `Title: "${b.title}" (${b.id}) | ISBN ${b.isbn} | Genre: ${b.genre} | Status: ${b.status} | Not yet published, so no sales or royalties yet`;
  }
  return [
    `Title: "${b.title}" (${b.id})`,
    `ISBN ${b.isbn}`,
    `Genre: ${b.genre}`,
    `Status: ${b.status}`,
    `Published: ${b.publicationDate ? toDisplayDate(b.publicationDate) : 'unknown'}`,
    `MRP: ${b.mrp !== null ? inr(b.mrp) : 'n/a'}`,
    `Copies sold: ${b.copiesSold}`,
    ...(royalties
      ? [
          `Author royalty per copy: ${b.royaltyPerCopy !== null ? inr(b.royaltyPerCopy) : 'n/a'}`,
          `Royalty earned: ${inr(b.royaltyEarned)}, paid: ${inr(b.royaltyPaid)}, pending: ${inr(b.royaltyPending)}`,
          `Last payout: ${b.lastPayoutDate ? toDisplayDate(b.lastPayoutDate) : 'no payout yet'}`,
          `Payout status: ${payoutStatus(b, today, accountPending)}`,
        ]
      : []),
    `Print partner: ${b.printPartner ?? 'n/a'}`,
    `Listed on: ${b.platforms.length ? b.platforms.join(', ') : 'none yet'}`,
  ].join(' | ');
}

const ROYALTY_RELEVANT = new Set(['ROYALTY_PAYMENTS', 'GENERAL_INQUIRY']);

export function buildAccountFacts(
  ticket: TicketWithContext,
  options: { purpose: 'triage' | 'draft'; today?: Date },
): string {
  const today = options.today ?? new Date();
  const { author } = ticket;
  const firstName = author.user.name.split(' ')[0];
  const royalties = options.purpose === 'triage' || ROYALTY_RELEVANT.has(ticket.category);
  const accountPending = author.books.reduce((acc, b) => acc + b.royaltyPending, 0);
  const describe = (b: Book) => describeBook(b, today, { royalties, accountPending });

  const books = ticket.book
    ? `<book>\n${describe(ticket.book)}\n</book>`
    : `<books note="General / account-level ticket; all of the author's books">\n${author.books.map(describe).join('\n')}\n</books>`;

  const lines = [
    `<today>${toDisplayDate(today)}</today>`,
    `<author>Name: ${author.user.name} (address them as ${firstName}) | City: ${author.city} | Author since: ${toDisplayDate(author.joinedDate)}</author>`,
    books,
  ];
  if (royalties) {
    const schedule = nextPayoutSchedule(today);
    lines.push(
      `<royalty_schedule>Latest quarter end: ${toDisplayDate(schedule.quarterEndDate)}. Next payout date (end of the 45-day window): ${toDisplayDate(schedule.nextPayoutDate)}. Minimum payout: ${inr(PAYOUT_THRESHOLD_INR)}; smaller balances roll over to the next quarter.</royalty_schedule>`,
    );
  }
  return lines.join('\n');
}

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}… [truncated]` : text);

const ROLE_LABEL: Record<MessageType, string> = {
  AUTHOR_MESSAGE: 'author',
  ADMIN_REPLY: 'bookleaf_team',
  INTERNAL_NOTE: 'internal_note',
};

export function buildThread(ticket: TicketWithContext): string {
  const recent = ticket.messages.slice(-MAX_THREAD_MESSAGES);
  const omitted = ticket.messages.length - recent.length;
  const lines = [
    `<original_query subject="${escapeAttr(ticket.subject)}">\n${truncate(ticket.description, MAX_DESCRIPTION_CHARS)}\n</original_query>`,
  ];
  if (omitted > 0) lines.push(`<omitted>${omitted} earlier message(s) not shown</omitted>`);
  for (const m of recent) {
    lines.push(`<message from="${ROLE_LABEL[m.type]}" at="${m.createdAt.toISOString()}">\n${truncate(m.body, MAX_MESSAGE_CHARS)}\n</message>`);
  }
  return lines.join('\n');
}

const escapeAttr = (s: string) => s.replace(/"/g, "'");
