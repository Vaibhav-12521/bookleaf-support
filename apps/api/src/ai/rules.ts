import { PRIORITY_RANK, type Category, type Priority } from '@bookleaf/shared';

type Weighted = [RegExp, number];

const CATEGORY_KEYWORDS: Record<Exclude<Category, 'GENERAL_INQUIRY'>, Weighted[]> = {
  ROYALTY_PAYMENTS: [[/royalt/, 3], [/payout/, 3], [/\bpaid\b/, 1], [/\bpay(ment)?s?\b/, 1], [/bank/, 1], [/earning/, 1], [/₹|\brs\.?\s?\d|\binr\b/, 1]],
  ISBN_METADATA: [[/\bisbn\b/, 4], [/metadata/, 2], [/barcode/, 2], [/imprint/, 2], [/wrong (book|title|author)/, 2]],
  PRINTING_QUALITY: [[/print(ing|ed)? quality/, 3], [/blurr?y/, 3], [/misalign/, 3], [/binding/, 3], [/misprint/, 3], [/smudge/, 2], [/faded/, 2], [/defect/, 2], [/torn/, 2], [/author copies/, 1], [/reprint/, 2]],
  DISTRIBUTION_AVAILABILITY: [[/unavailable/, 3], [/not available/, 3], [/out of stock/, 3], [/can'?t find/, 2], [/cannot find/, 2], [/not (showing|listed)/, 2], [/\blisting\b/, 1], [/amazon/, 1], [/flipkart/, 1], [/bookleaf store/, 1]],
  BOOK_STATUS_PRODUCTION: [[/cover design/, 3], [/typesetting/, 3], [/proofread/, 3], [/production/, 2], [/\bstage\b/, 2], [/\bproofs?\b/, 2], [/manuscript/, 2], [/when will (my|the) book/, 2], [/still in/, 1]],
};

const CATEGORY_PRECEDENCE: Category[] = [
  'ISBN_METADATA',
  'PRINTING_QUALITY',
  'ROYALTY_PAYMENTS',
  'DISTRIBUTION_AVAILABILITY',
  'BOOK_STATUS_PRODUCTION',
];

const CRITICAL_SIGNALS = [/legal/, /lawyer/, /consumer (court|forum)/, /fraud/, /never (been )?paid/, /\b(6|six|7|seven|8|eight|9|nine|10|ten|11|eleven|12|twelve) months/, /over a year/, /more than a year/];
const HIGH_SIGNALS = [/urgent/, /asap/, /immediately/, /not received/, /haven'?t received/, /no royalty/, /wrong/, /duplicate/, /defect/, /blurr?y/, /misalign/, /unavailable/, /cannot be sold/];
const LOW_SIGNALS = [/^can i\b/, /\bhow (do|can) i\b/, /author bio/, /update (my|the) (bio|description|photo|profile)/, /just (wanted|curious)/, /quick question/];

export interface RuleTriage {
  category: Category;
  priority: Priority;
  reasoning: string;
}

export function classifyByRules(subject: string, description: string): RuleTriage {
  const text = `${subject}\n${description}`.toLowerCase();

  let best: Category = 'GENERAL_INQUIRY';
  let bestScore = 0;
  for (const category of CATEGORY_PRECEDENCE) {
    const patterns = CATEGORY_KEYWORDS[category as keyof typeof CATEGORY_KEYWORDS];
    const score = patterns.reduce((acc, [p, weight]) => (p.test(text) ? acc + weight : acc), 0);
    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  }

  let priority: Priority = 'MEDIUM';
  if (CRITICAL_SIGNALS.some((p) => p.test(text))) priority = 'CRITICAL';
  else if (HIGH_SIGNALS.some((p) => p.test(text))) priority = 'HIGH';
  else if (LOW_SIGNALS.some((p) => p.test(subject.toLowerCase()) || p.test(text))) priority = 'LOW';

  priority = applyPriorityPolicy(best, priority, text);

  return {
    category: best,
    priority,
    reasoning: bestScore > 0 ? 'Keyword-based classification' : 'No strong keywords found; defaulted to General Inquiry',
  };
}

export function applyPriorityPolicy(
  category: Category,
  priority: Priority,
  text: string,
  facts: { royaltyOverdue?: boolean; neverPaidForOverAYear?: boolean } = {},
): Priority {
  const lower = text.toLowerCase();
  if (category === 'ROYALTY_PAYMENTS' && facts.neverPaidForOverAYear) return 'CRITICAL';
  if (category === 'ROYALTY_PAYMENTS' && facts.royaltyOverdue) return atLeast(priority, 'HIGH');
  if (category === 'ISBN_METADATA' && /(wrong|different|duplicate|mismatch|incorrect|error)/.test(lower)) {
    return atLeast(priority, 'HIGH');
  }
  if (category === 'PRINTING_QUALITY' && /(defect|blurr?y|misalign|misprint|binding|torn)/.test(lower)) {
    return atLeast(priority, 'HIGH');
  }
  return priority;
}

export function atLeast(priority: Priority, floor: Priority): Priority {
  return PRIORITY_RANK[priority] >= PRIORITY_RANK[floor] ? priority : floor;
}
