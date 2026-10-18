export const ROLES = ['AUTHOR', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const UNRESOLVED_STATUSES: readonly TicketStatus[] = ['OPEN', 'IN_PROGRESS'];

export const CATEGORIES = [
  'ROYALTY_PAYMENTS',
  'ISBN_METADATA',
  'PRINTING_QUALITY',
  'DISTRIBUTION_AVAILABILITY',
  'BOOK_STATUS_PRODUCTION',
  'GENERAL_INQUIRY',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  ROYALTY_PAYMENTS: 'Royalty & Payments',
  ISBN_METADATA: 'ISBN & Metadata Issues',
  PRINTING_QUALITY: 'Printing & Quality',
  DISTRIBUTION_AVAILABILITY: 'Distribution & Availability',
  BOOK_STATUS_PRODUCTION: 'Book Status & Production Updates',
  GENERAL_INQUIRY: 'General Inquiry',
};

export const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export const PRIORITY_RANK: Record<Priority, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export const DECISION_SOURCES = ['AI', 'RULES', 'ADMIN'] as const;
export type DecisionSource = (typeof DECISION_SOURCES)[number];

export const TRIAGE_STATUSES = ['PENDING', 'COMPLETED', 'FAILED'] as const;
export type TriageStatus = (typeof TRIAGE_STATUSES)[number];

export const MESSAGE_TYPES = ['AUTHOR_MESSAGE', 'ADMIN_REPLY', 'INTERNAL_NOTE'] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const PRODUCTION_STAGES = [
  'Manuscript Received',
  'Editing',
  'Cover Design',
  'Typesetting',
  'Proofreading',
  'ISBN Assignment',
  'Printing',
  'Distribution Setup',
  'Published & Live',
] as const;
export type ProductionStage = (typeof PRODUCTION_STAGES)[number];

export const ATTACHMENT_RULES = {
  maxBytes: 5 * 1024 * 1024,
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
} as const;

// AI drafts and templates mark facts the agent must supply as [bracketed text].
// A reply that still contains one is incomplete and must not reach the author.
const DRAFT_PLACEHOLDER = /\[[^\]\n]{3,}\]/g;
export const findDraftPlaceholders = (text: string): string[] => text.match(DRAFT_PLACEHOLDER) ?? [];
