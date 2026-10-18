import type { Category } from '@bookleaf/shared';

export const KB_COMPANY = `## Company overview
- BookLeaf Publishing is a self-publishing company operating in India and the US.
- Publishing packages: Standard Free (no upfront cost) and Bestseller Breakthrough (premium, paid package with marketing and distribution add-ons).
- BookLeaf handles cover design, typesetting, ISBN assignment, printing, distribution, and royalty management for authors.
- The in-house printing facility and warehouse are in Delhi. Print partners include Repro India and Epitome Books.`;

export const KB_ROYALTY = `## Royalty policy
- 80/20 royalty split: 80% of the net profit per book goes to the author, 20% to BookLeaf.
- Net profit = MRP minus printing cost, platform commission (Amazon/Flipkart), and shipping charges.
- Royalties are calculated quarterly and paid within 45 days of the quarter ending.
- Minimum payout threshold: ₹1,000. If accumulated royalties are below this, they roll over to the next quarter.
- Payouts are made via bank transfer to the account linked in the author's dashboard.
- Authors can view a detailed royalty breakdown in their dashboard, showing sales figures per platform.`;

export const KB_ISBN = `## ISBN policy
- Every book published through BookLeaf receives a unique ISBN assigned by BookLeaf.
- ISBNs are registered under BookLeaf's publisher imprint. Authors who want an ISBN under their own imprint must obtain it independently.
- An ISBN error (duplicate, wrong book linked) is a high-priority issue and is escalated to the production team.`;

export const KB_PRINTING = `## Printing & quality
- In-house printing handles most orders. Overflow or specific format requirements go to Repro India or Epitome Books.
- Standard print turnaround: 5-7 business days from order confirmation.
- For a quality issue (misprints, binding defects, colour inconsistency), BookLeaf arranges a free reprint after verification. The author may need to share photos of the defective copy.`;

export const KB_DISTRIBUTION = `## Distribution & availability
- Books are listed on Amazon India, Flipkart, Amazon US, Amazon UK, and the BookLeaf Store.
- New listings typically go live within 7-10 business days after publication is complete.
- A book showing as unavailable on a platform usually indicates a stock sync issue; BookLeaf's team can trigger a re-sync within 24-48 hours.
- Metadata updates (e.g. description, author bio) can be submitted through the dashboard or by emailing the BookLeaf team; changes typically reflect on platforms within 3-5 business days.`;

export const KB_PRODUCTION = `## Production stages
- Stages in order: Manuscript Received -> Editing (if opted) -> Cover Design -> Typesetting -> Proofreading -> ISBN Assignment -> Printing -> Distribution Setup -> Published & Live.
- Authors are updated at each stage via email.
- Delays typically happen at Cover Design (waiting for author approval) and Proofreading (revision rounds).`;

export const KB_EXAMPLES: Record<Category, string> = {
  ROYALTY_PAYMENTS: `## How BookLeaf answers royalty questions
- "Published 4 months ago, no royalty yet": acknowledge the frustration, explain the quarterly cycle and 45-day payout window, check whether bank details are linked, give the specific next payout date. If the payment is genuinely overdue, escalate with a 48-hour resolution timeline.
- "Royalty seems too low": explain the net profit calculation (MRP minus printing, platform commission, shipping). Offer a detailed line-by-line royalty breakdown. Do not be defensive; offer transparency.`,
  ISBN_METADATA: `## How BookLeaf answers ISBN issues
- "Amazon shows a different ISBN than the physical copy": treat as high priority, acknowledge it is a serious data issue, confirm it is being escalated to the production team immediately, give a 48-hour resolution timeline.`,
  PRINTING_QUALITY: `## How BookLeaf answers print quality issues
- "Copies are blurry / pages misaligned": apologise sincerely, ask for photos of the defective copies, confirm BookLeaf will arrange a free reprint once verified, give a 5-7 business day timeline for the reprint.`,
  DISTRIBUTION_AVAILABILITY: `## How BookLeaf answers availability issues
- "Book shows Currently Unavailable on Amazon": explain this is typically a stock sync issue, confirm a re-sync is being triggered with the distribution team, set the expectation of 24-48 hours for it to go live again.`,
  BOOK_STATUS_PRODUCTION: `## How BookLeaf answers production status questions
- "Still in typesetting after 3 weeks": check the actual production status. If delayed, be honest about why (e.g. waiting on author approval of proofs). Give a specific updated timeline. Do not blame the author even if the delay is on their side; frame it collaboratively.`,
  GENERAL_INQUIRY: `## How BookLeaf answers general questions
- "Can I update my book description on Amazon after it's live?": yes, metadata updates can be submitted through the dashboard or by emailing the BookLeaf team; changes typically reflect within 3-5 business days.`,
};

const SECTIONS_BY_CATEGORY: Record<Category, string[]> = {
  ROYALTY_PAYMENTS: [KB_ROYALTY],
  ISBN_METADATA: [KB_ISBN, KB_DISTRIBUTION],
  PRINTING_QUALITY: [KB_PRINTING],
  DISTRIBUTION_AVAILABILITY: [KB_DISTRIBUTION],
  BOOK_STATUS_PRODUCTION: [KB_PRODUCTION, KB_DISTRIBUTION],
  GENERAL_INQUIRY: [KB_ROYALTY, KB_ISBN, KB_PRINTING, KB_DISTRIBUTION, KB_PRODUCTION],
};

export function knowledgeFor(category: Category): string {
  return [KB_COMPANY, ...SECTIONS_BY_CATEGORY[category], KB_EXAMPLES[category]].join('\n\n');
}
