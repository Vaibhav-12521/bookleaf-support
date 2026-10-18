import type { Prisma } from '@prisma/client';
import type { BookDTO, MyBooksResponse, SessionUser } from '@bookleaf/shared';
import { summarizeRoyalties, toBookDTO } from '../../domain/book.mapper';
import { pendingByAuthor } from '../../domain/royalty';
import { notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';

const scope = (viewer: SessionUser): Prisma.BookWhereInput =>
  viewer.role === 'ADMIN' ? {} : { authorId: viewer.authorId ?? '__none__' };

export async function listBooks(viewer: SessionUser): Promise<MyBooksResponse> {
  const books = await prisma.book.findMany({
    where: scope(viewer),
    orderBy: [{ publicationDate: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
  });
  const pending = pendingByAuthor(books);
  return { books: books.map((b) => toBookDTO(b, pending.get(b.authorId) ?? 0)), summary: summarizeRoyalties(books) };
}

export async function getBook(viewer: SessionUser, bookId: string): Promise<BookDTO> {
  const book = await prisma.book.findFirst({ where: { AND: [{ id: bookId }, scope(viewer)] } });
  if (!book) throw notFound('Book');
  const account = await prisma.book.aggregate({ where: { authorId: book.authorId }, _sum: { royaltyPending: true } });
  return toBookDTO(book, account._sum.royaltyPending ?? 0);
}
