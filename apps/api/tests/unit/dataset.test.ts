import { describe, expect, it } from 'vitest';
import { auditDataset, loadDataset } from '../../src/seed/dataset';

describe('provided sample dataset', () => {
  const data = loadDataset();
  const books = data.authors.flatMap((a) => a.books);

  it('parses with the expected shape and counts', () => {
    expect(data.authors).toHaveLength(10);
    expect(books).toHaveLength(18);
  });

  it('contains the edge cases the brief calls out', () => {
    const inProduction = books.filter((b) => b.status !== 'Published & Live');
    expect(inProduction.map((b) => b.book_id).sort()).toEqual(['BK013', 'BK015']);
    expect(inProduction.every((b) => b.mrp === null && b.publication_date === null)).toBe(true);
    expect(books.some((b) => b.royalty_paid === 0 && b.royalty_pending > 0)).toBe(true);
  });

  it('passes the business-rule audit', () => {
    expect(auditDataset(data)).toEqual([]);
  });

  it('reports arithmetic inconsistencies instead of silently fixing them', () => {
    const broken = structuredClone(data);
    broken.authors[0]!.books[0]!.royalty_paid += 1;
    expect(auditDataset(broken)).toEqual(expect.arrayContaining([expect.stringContaining('paid + pending != earned')]));
  });
});
