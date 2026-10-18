import { describe, expect, it } from 'vitest';
import { isPublished, parseProductionStage } from '../../src/domain/production';
import { correctNearMisses, enforceGreeting, normalizeModelText } from '../../src/ai/text';
import { findDraftPlaceholders } from '@bookleaf/shared';
import {
  isBelowPayoutThreshold,
  isRoyaltyOverdue,
  pendingByAuthor,
  nextPayoutSchedule,
  previousQuarterEnd,
  quarterEnd,
  toIsoDate,
} from '../../src/domain/royalty';

const d = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

describe('royalty calendar', () => {
  it('finds quarter ends', () => {
    expect(toIsoDate(quarterEnd(d('2026-02-10')))).toBe('2026-03-31');
    expect(toIsoDate(quarterEnd(d('2026-11-30')))).toBe('2026-12-31');
    expect(toIsoDate(previousQuarterEnd(d('2026-01-05')))).toBe('2025-12-31');
  });

  it('uses the just-ended quarter while inside its 45-day payout window', () => {
    const s = nextPayoutSchedule(d('2026-10-15'));
    expect(toIsoDate(s.quarterEndDate)).toBe('2026-09-30');
    expect(toIsoDate(s.nextPayoutDate)).toBe('2026-11-14');
  });

  it('moves to the current quarter once the window has passed', () => {
    const s = nextPayoutSchedule(d('2026-12-01'));
    expect(toIsoDate(s.quarterEndDate)).toBe('2026-12-31');
    expect(toIsoDate(s.nextPayoutDate)).toBe('2027-02-14');
  });

  it('keeps the payout date as "next" for the whole payout day', () => {
    for (const t of ['2026-11-14T00:00:00Z', '2026-11-14T09:30:00Z', '2026-11-14T23:59:00Z']) {
      expect(toIsoDate(nextPayoutSchedule(new Date(t)).nextPayoutDate)).toBe('2026-11-14');
    }
    expect(toIsoDate(nextPayoutSchedule(new Date('2026-11-15T00:00:00Z')).nextPayoutDate)).toBe('2027-02-14');
  });

  it('applies the ₹1,000 minimum to the author’s accumulated balance, not each book', () => {
    const books = [
      { authorId: 'A', royaltyPending: 600 },
      { authorId: 'A', royaltyPending: 600 },
      { authorId: 'B', royaltyPending: 850 },
    ];
    const pending = pendingByAuthor(books);
    expect(pending.get('A')).toBe(1200);
    expect(isBelowPayoutThreshold(pending.get('A')!)).toBe(false);
    expect(isBelowPayoutThreshold(pending.get('B')!)).toBe(true);
    const book = { royaltyPending: 600, lastPayoutDate: null, publicationDate: d('2024-01-01') };
    expect(isRoyaltyOverdue(book, d('2026-10-17'))).toBe(false); // this book alone is below the minimum
    expect(isRoyaltyOverdue(book, d('2026-10-17'), 1200)).toBe(true); // but the account is payable
  });

  it('marks payable balances with no payout for two cycles as overdue', () => {
    const today = d('2026-10-17');
    const book = (pending: number, last: string | null, published: string | null = '2024-01-01') => ({
      royaltyPending: pending,
      lastPayoutDate: last ? d(last) : null,
      publicationDate: published ? d(published) : null,
    });
    expect(isRoyaltyOverdue(book(2546, null, '2024-07-05'), today)).toBe(true);
    expect(isRoyaltyOverdue(book(3570, '2025-10-15'), today)).toBe(true);
    expect(isRoyaltyOverdue(book(3570, '2026-08-14'), today)).toBe(false);
    expect(isRoyaltyOverdue(book(850, null), today)).toBe(false);
    expect(isRoyaltyOverdue(book(0, null), today)).toBe(false);
  });

  it('flags balances below the ₹1,000 threshold, but not zero', () => {
    expect(isBelowPayoutThreshold(850)).toBe(true);
    expect(isBelowPayoutThreshold(1000)).toBe(false);
    expect(isBelowPayoutThreshold(0)).toBe(false);
  });
});

describe('normalizeModelText', () => {
  it('replaces typographic hyphens and spaces that break matching and email clients', () => {
    expect(normalizeModelText('high‑priority within the next 48 hours  \n')).toBe('high-priority within the next 48 hours');
    expect(normalizeModelText('zero​width')).toBe('zerowidth');
  });

  it('strips markdown emphasis and headings from plain-text drafts', () => {
    expect(normalizeModelText('## Update\nLive by **[confirm date]** and __soon__.')).toBe('Update\nLive by [confirm date] and soon.');
  });
});

describe('findDraftPlaceholders', () => {
  it('finds bracketed gaps the agent must fill', () => {
    expect(findDraftPlaceholders('Paid on [confirm date] to [bank]... ok')).toEqual(['[confirm date]', '[bank]']);
  });

  it('ignores ordinary text and very short brackets', () => {
    expect(findDraftPlaceholders('Hi Priya, see section [a] of the FAQ.')).toEqual([]);
    expect(findDraftPlaceholders('No brackets here.')).toEqual([]);
  });
});

describe('proper-noun guardrails', () => {
  const canon = ['Sneha', 'Between Two Temples', 'Code & Karma', 'Midnight in Mysore'];

  it('fixes near-miss spellings of names and titles, keeping punctuation', () => {
    expect(correctNearMisses('Hi Sneja, about “Between Two Tempts” sales.', canon)).toBe('Hi Sneha, about “Between Two Temples” sales.');
    expect(correctNearMisses('Your book Midnight in Mysor is in cover design.', canon)).toBe('Your book Midnight in Mysore is in cover design.');
    expect(correctNearMisses('readers can’t find “Howow Nights” on Flipkart', ['Howrah Nights'])).toBe('readers can’t find “Howrah Nights” on Flipkart');
  });

  it('leaves exact matches and unrelated words alone', () => {
    const text = 'Hi Sneha, Code & Karma is live. Please share the photos.';
    expect(correctNearMisses(text, canon)).toBe(text);
    expect(correctNearMisses('We need more time.', canon)).toBe('We need more time.');
    const draft = 'Thank you for letting us know. We will move the book into Typesetting within 2 business days and share the cover with you.';
    expect(correctNearMisses(draft, [...canon, 'Howrah Nights', 'The Algorithm of Love', 'Ctrl+Alt+Delete My Ex'])).toBe(draft);
  });

  it('always greets the author by their exact first name', () => {
    expect(enforceGreeting('Hi Sneja,\n\nBody', 'Sneha')).toBe('Hi Sneha,\n\nBody');
    expect(enforceGreeting('Dear author,\n\nBody', 'Sneha')).toBe('Hi Sneha,\n\nBody');
    expect(enforceGreeting('Body only', 'Sneha')).toBe('Hi Sneha,\n\nBody only');
  });
});

describe('production stage parsing', () => {
  it.each([
    ['Published & Live', 'Published & Live'],
    ['In Production - Cover Design', 'Cover Design'],
    ['In Production - Typesetting', 'Typesetting'],
    ['Something unexpected', 'Manuscript Received'],
  ])('%s -> %s', (status, stage) => {
    expect(parseProductionStage(status)).toBe(stage);
  });

  it('knows which books are published', () => {
    expect(isPublished('Published & Live')).toBe(true);
    expect(isPublished('In Production - Cover Design')).toBe(false);
  });
});
