import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

export const datasetBookSchema = z.object({
  book_id: z.string().min(1),
  title: z.string().min(1),
  isbn: z.string().min(1),
  genre: z.string().min(1),
  publication_date: isoDate.nullable(),
  status: z.string().min(1),
  mrp: z.number().int().nonnegative().nullable(),
  author_royalty_per_copy: z.number().int().nonnegative().nullable(),
  total_copies_sold: z.number().int().nonnegative(),
  total_royalty_earned: z.number().int().nonnegative(),
  royalty_paid: z.number().int().nonnegative(),
  royalty_pending: z.number().int().nonnegative(),
  last_royalty_payout_date: isoDate.nullable(),
  print_partner: z.string().nullable(),
  available_on: z.array(z.string()),
});

export const datasetAuthorSchema = z.object({
  author_id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string(),
  city: z.string(),
  joined_date: isoDate,
  books: z.array(datasetBookSchema),
});

export const datasetSchema = z.object({ authors: z.array(datasetAuthorSchema) });

export type Dataset = z.infer<typeof datasetSchema>;
export type DatasetBook = z.infer<typeof datasetBookSchema>;

const here = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_DATASET_PATH = path.resolve(here, '../../../../data/bookleaf_sample_data.json');

export function loadDataset(filePath = DEFAULT_DATASET_PATH): Dataset {
  const raw = JSON.parse(readFileSync(filePath, 'utf8'));
  return datasetSchema.parse(raw);
}

export function auditDataset(data: Dataset): string[] {
  const warnings: string[] = [];
  const isbns = new Set<string>();
  const ids = new Set<string>();

  for (const author of data.authors) {
    for (const b of author.books) {
      if (ids.has(b.book_id)) warnings.push(`${b.book_id}: duplicate book id`);
      ids.add(b.book_id);
      if (isbns.has(b.isbn)) warnings.push(`${b.book_id}: duplicate ISBN ${b.isbn}`);
      isbns.add(b.isbn);

      if (b.royalty_paid + b.royalty_pending !== b.total_royalty_earned) {
        warnings.push(`${b.book_id}: paid + pending != earned`);
      }
      if (b.author_royalty_per_copy !== null && b.author_royalty_per_copy * b.total_copies_sold !== b.total_royalty_earned) {
        warnings.push(`${b.book_id}: copies x royalty per copy != earned`);
      }
      if (b.status === 'Published & Live' && (b.mrp === null || b.publication_date === null)) {
        warnings.push(`${b.book_id}: published but missing MRP or publication date`);
      }
    }
  }
  return warnings;
}
