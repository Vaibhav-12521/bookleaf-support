import { describe, expect, it } from 'vitest';
import { applyPriorityPolicy, atLeast, classifyByRules } from '../../src/ai/rules';

describe('classifyByRules', () => {
  it.each([
    ['Royalty not received', 'I have not received my royalty payout for last quarter.', 'ROYALTY_PAYMENTS'],
    ['ISBN mismatch', 'Amazon listing shows a different ISBN than the printed copy.', 'ISBN_METADATA'],
    ['Bad print', 'Copies arrived with blurry images and misaligned pages.', 'PRINTING_QUALITY'],
    ['Not on Flipkart', 'My book is showing as unavailable on Flipkart.', 'DISTRIBUTION_AVAILABILITY'],
    ['Typesetting delay', 'It has been 3 weeks and my book is still in typesetting.', 'BOOK_STATUS_PRODUCTION'],
    ['Author bio', 'Can I update my author bio on the website?', 'GENERAL_INQUIRY'],
  ])('%s -> %s', (subject, description, expected) => {
    expect(classifyByRules(subject, description).category).toBe(expected);
  });

  it('lets a strong identifier beat incidental mentions (ISBN ticket that mentions Amazon listing)', () => {
    const r = classifyByRules('Wrong ISBN', 'The Amazon listing for my book shows the wrong ISBN.');
    expect(r.category).toBe('ISBN_METADATA');
  });

  it('flags long-unpaid royalties as critical and how-to questions as low', () => {
    expect(classifyByRules('No royalty', "I haven't received any royalty for 6 months").priority).toBe('CRITICAL');
    expect(classifyByRules('Can I update my author bio?', 'Just wanted to know how.').priority).toBe('LOW');
  });

  it('defaults to General Inquiry / Medium when nothing matches', () => {
    expect(classifyByRules('Hello', 'I have a question about something else entirely.')).toMatchObject({
      category: 'GENERAL_INQUIRY',
      priority: 'MEDIUM',
    });
  });
});

describe('applyPriorityPolicy', () => {
  it('raises ISBN errors to at least High (knowledge-base rule)', () => {
    expect(applyPriorityPolicy('ISBN_METADATA', 'LOW', 'duplicate ISBN on two books')).toBe('HIGH');
    expect(applyPriorityPolicy('ISBN_METADATA', 'CRITICAL', 'wrong ISBN')).toBe('CRITICAL');
  });

  it('does not raise a non-error ISBN question', () => {
    expect(applyPriorityPolicy('ISBN_METADATA', 'LOW', 'can I use my own imprint ISBN?')).toBe('LOW');
  });

  it('raises physical print defects to at least High', () => {
    expect(applyPriorityPolicy('PRINTING_QUALITY', 'MEDIUM', 'binding is coming apart')).toBe('HIGH');
  });

  it('escalates royalty tickets using account facts', () => {
    expect(applyPriorityPolicy('ROYALTY_PAYMENTS', 'MEDIUM', 'when will I be paid?', { royaltyOverdue: true })).toBe('HIGH');
    expect(applyPriorityPolicy('ROYALTY_PAYMENTS', 'HIGH', 'no royalty yet', { royaltyOverdue: true, neverPaidForOverAYear: true })).toBe('CRITICAL');
    expect(applyPriorityPolicy('ROYALTY_PAYMENTS', 'MEDIUM', 'question', {})).toBe('MEDIUM');
    expect(applyPriorityPolicy('GENERAL_INQUIRY', 'LOW', 'bio', { royaltyOverdue: true })).toBe('LOW');
  });

  it('atLeast never lowers a priority', () => {
    expect(atLeast('CRITICAL', 'HIGH')).toBe('CRITICAL');
    expect(atLeast('LOW', 'MEDIUM')).toBe('MEDIUM');
  });
});
