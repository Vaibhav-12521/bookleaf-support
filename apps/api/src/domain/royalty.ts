export const PAYOUT_THRESHOLD_INR = 1000;
export const PAYOUT_WINDOW_DAYS = 45;

const DAY_MS = 24 * 60 * 60 * 1000;

export function quarterEnd(date: Date): Date {
  const quarterLastMonth = Math.floor(date.getUTCMonth() / 3) * 3 + 2;
  return new Date(Date.UTC(date.getUTCFullYear(), quarterLastMonth + 1, 0));
}

export function previousQuarterEnd(date: Date): Date {
  const currentQuarterStart = new Date(Date.UTC(date.getUTCFullYear(), Math.floor(date.getUTCMonth() / 3) * 3, 1));
  return new Date(currentQuarterStart.getTime() - DAY_MS);
}

export function nextPayoutSchedule(today: Date): { quarterEndDate: Date; nextPayoutDate: Date } {
  const lastEnded = previousQuarterEnd(today);
  const lastWindowClose = new Date(lastEnded.getTime() + PAYOUT_WINDOW_DAYS * DAY_MS);
  // Compare calendar days: the payout date stays "next" for the whole of that day.
  if (toIsoDate(today) <= toIsoDate(lastWindowClose)) {
    return { quarterEndDate: lastEnded, nextPayoutDate: lastWindowClose };
  }
  const currentEnd = quarterEnd(today);
  return {
    quarterEndDate: currentEnd,
    nextPayoutDate: new Date(currentEnd.getTime() + PAYOUT_WINDOW_DAYS * DAY_MS),
  };
}

// The ₹1,000 minimum applies to the author's accumulated pending royalties across
// all their books (payouts are one bank transfer per author), not to each book.
export function isBelowPayoutThreshold(accountPending: number): boolean {
  return accountPending > 0 && accountPending < PAYOUT_THRESHOLD_INR;
}

export const pendingByAuthor = (books: { authorId: string; royaltyPending: number }[]) =>
  books.reduce((acc, b) => acc.set(b.authorId, (acc.get(b.authorId) ?? 0) + b.royaltyPending), new Map<string, number>());

export const OVERDUE_AFTER_DAYS = 180;

export function isRoyaltyOverdue(
  book: { royaltyPending: number; lastPayoutDate: Date | null; publicationDate: Date | null },
  today: Date,
  accountPending = book.royaltyPending,
): boolean {
  if (book.royaltyPending === 0 || accountPending < PAYOUT_THRESHOLD_INR) return false;
  const since = book.lastPayoutDate ?? book.publicationDate;
  if (!since) return false;
  return today.getTime() - since.getTime() > OVERDUE_AFTER_DAYS * DAY_MS;
}

export const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);

export const toDisplayDate = (d: Date) =>
  d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
