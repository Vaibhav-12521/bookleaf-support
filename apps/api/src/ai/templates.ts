import type { Category } from '@bookleaf/shared';

interface TemplateInput {
  firstName: string;
  bookTitle: string | null;
  nextPayoutDate: string;
}

const SIGN_OFF = '\n\nWarm regards,\nBookLeaf Author Support';

const TEMPLATES: Record<Category, (t: TemplateInput) => string> = {
  ROYALTY_PAYMENTS: (t) =>
    `Hi ${t.firstName},\n\nThank you for reaching out about your royalties${t.bookTitle ? ` for "${t.bookTitle}"` : ''}, and I'm sorry for the worry this has caused. Royalties at BookLeaf are calculated quarterly and paid within 45 days of the quarter ending, by bank transfer to the account linked in your dashboard. Balances below ₹1,000 roll over to the next quarter. Your next scheduled payout date is ${t.nextPayoutDate}.\n\n[Check the author's payout history and bank details, then state the specific amount and status.]\n\nIf a payment is overdue, that is on us, and our team will resolve it within 48 hours. We're also happy to share a detailed line-by-line royalty breakdown if that would help.` +
    SIGN_OFF,
  ISBN_METADATA: (t) =>
    `Hi ${t.firstName},\n\nThank you for flagging this${t.bookTitle ? ` for "${t.bookTitle}"` : ''}. An ISBN or metadata mismatch is a serious data issue, and we're treating it as high priority. I have escalated it to our production team today, and we will get back to you with a resolution within 48 hours.\n\n[Add the ISBN on record and what is being corrected.]\n\nYou don't need to do anything further right now; we'll confirm here once the listing is corrected.` +
    SIGN_OFF,
  PRINTING_QUALITY: (t) =>
    `Hi ${t.firstName},\n\nI'm truly sorry that your copies${t.bookTitle ? ` of "${t.bookTitle}"` : ''} arrived in this condition. That's not the standard we hold ourselves to. Could you reply with a few clear photos of the affected pages and the cover? Once we've verified the issue, we will arrange a free reprint, which takes 5-7 business days from confirmation.\n\nAs soon as we receive the photos, we'll confirm the reprint and share the dispatch timeline.` +
    SIGN_OFF,
  DISTRIBUTION_AVAILABILITY: (t) =>
    `Hi ${t.firstName},\n\nThank you for letting us know${t.bookTitle ? ` about "${t.bookTitle}"` : ''}, and I understand how frustrating it is when readers can't find your book. This is usually caused by a stock sync issue with the platform. We are triggering a re-sync with our distribution team now, and the listing should be live again within 24-48 hours.\n\n[Confirm which platforms the book is listed on.]\n\nWe'll check the listing again after the re-sync and update you here.` +
    SIGN_OFF,
  BOOK_STATUS_PRODUCTION: (t) =>
    `Hi ${t.firstName},\n\nThank you for checking in${t.bookTitle ? ` on "${t.bookTitle}"` : ''}. I completely understand wanting a clear picture of where things stand. [State the current production stage and what it is waiting on.]\n\n[Give a specific updated timeline for the next stage.]\n\nWe'll keep you updated by email at each stage, and please reply here if anything is needed from your side.` +
    SIGN_OFF,
  GENERAL_INQUIRY: (t) =>
    `Hi ${t.firstName},\n\nThank you for getting in touch. [Answer the author's question.]\n\nIf anything else comes up, just reply here and we'll be glad to help.` +
    SIGN_OFF,
};

export function renderTemplate(category: Category, input: TemplateInput): string {
  return TEMPLATES[category](input);
}
