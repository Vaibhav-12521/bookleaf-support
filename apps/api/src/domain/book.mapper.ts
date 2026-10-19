import type { Book } from '@prisma/client';
import type { BookDTO, RoyaltySummary } from '@bookleaf/shared';
import { isPublished, parseProductionStage } from './production';
import { isBelowPayoutThreshold, nextPayoutSchedule, toIsoDate } from './royalty';

export function toBookDTO(book: Book, accountPending: number): BookDTO {
  return {
    id: book.id,
    authorId: book.authorId,
    title: book.title,
    isbn: book.isbn,
    genre: book.genre,
    publicationDate: book.publicationDate ? toIsoDate(book.publicationDate) : null,
    status: book.status,
    isPublished: isPublished(book.status),
    productionStage: parseProductionStage(book.status),
    mrp: book.mrp,
    copiesSold: book.copiesSold,
    royalty: {
      perCopy: book.royaltyPerCopy,
      earned: book.royaltyEarned,
      paid: book.royaltyPaid,
      pending: book.royaltyPending,
      lastPayoutDate: book.lastPayoutDate ? toIsoDate(book.lastPayoutDate) : null,
      belowThreshold: book.royaltyPending > 0 && isBelowPayoutThreshold(accountPending),
    },
    printPartner: book.printPartner,
    platforms: book.platforms,
  };
}

export function summarizeRoyalties(books: Book[], today = new Date()): RoyaltySummary {
  const schedule = nextPayoutSchedule(today);
  return {
    totalEarned: sum(books, 'royaltyEarned'),
    totalPaid: sum(books, 'royaltyPaid'),
    totalPending: sum(books, 'royaltyPending'),
    totalCopiesSold: sum(books, 'copiesSold'),
    nextPayoutDate: toIsoDate(schedule.nextPayoutDate),
    quarterEndDate: toIsoDate(schedule.quarterEndDate),
  };
}

const sum = (books: Book[], key: 'royaltyEarned' | 'royaltyPaid' | 'royaltyPending' | 'copiesSold') =>
  books.reduce((acc, b) => acc + b[key], 0);
