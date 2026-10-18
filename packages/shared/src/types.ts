import type {
  Category,
  DecisionSource,
  MessageType,
  Priority,
  ProductionStage,
  Role,
  TicketStatus,
  TriageStatus,
} from './constants';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  authorId: string | null;
}

export interface RoyaltyInfo {
  perCopy: number | null;
  earned: number;
  paid: number;
  pending: number;
  lastPayoutDate: string | null;
  belowThreshold: boolean;
}

export interface BookDTO {
  id: string;
  authorId: string;
  title: string;
  isbn: string;
  genre: string;
  publicationDate: string | null;
  status: string;
  isPublished: boolean;
  productionStage: ProductionStage;
  mrp: number | null;
  copiesSold: number;
  royalty: RoyaltyInfo;
  printPartner: string | null;
  platforms: string[];
}

export interface RoyaltySummary {
  totalEarned: number;
  totalPaid: number;
  totalPending: number;
  totalCopiesSold: number;
  nextPayoutDate: string;
  quarterEndDate: string;
}

export interface MyBooksResponse {
  books: BookDTO[];
  summary: RoyaltySummary;
}

export interface UserRef {
  id: string;
  name: string;
}

export interface AttachmentDTO {
  fileName: string;
  sizeBytes: number;
  mimeType: string;
}

export interface MessageDTO {
  id: string;
  type: MessageType;
  body: string;
  sender: UserRef & { role: Role };
  createdAt: string;
}

export interface TicketSummaryDTO {
  id: string;
  reference: string;
  subject: string;
  status: TicketStatus;
  category: Category;
  priority: Priority;
  book: { id: string; title: string } | null;
  author: { id: string; name: string };
  assignee: UserRef | null;
  createdAt: string;
  updatedAt: string;
  firstResponseAt: string | null;
  awaitingTeam: boolean;
}

export interface TriageInfo {
  status: TriageStatus;
  categorySource: DecisionSource;
  prioritySource: DecisionSource;
  aiCategory: Category | null;
  aiPriority: Priority | null;
  confidence: number | null;
  reasoning: string | null;
  error: string | null;
}

export interface TicketDetailDTO extends TicketSummaryDTO {
  description: string;
  attachment: AttachmentDTO | null;
  messages: MessageDTO[];
  resolvedAt: string | null;
  triage?: TriageInfo;
  authorContext?: AuthorContextDTO;
}

export interface AuthorContextDTO {
  id: string;
  name: string;
  email: string;
  city: string;
  joinedDate: string;
  books: BookDTO[];
}

export interface DraftDTO {
  ticketId: string;
  content: string;
  source: 'AI' | 'TEMPLATE';
  model: string | null;
  createdAt: string;
  notice: string | null;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface TicketOverviewDTO {
  byStatus: Record<TicketStatus, number>;
  unresolvedByPriority: Record<Priority, number>;
  unassigned: number;
  awaitingTeam: number;
  oldestUnresolvedAt: string | null;
  ai: { calls: number; failures: number; inputTokens: number; outputTokens: number; estimatedCostUsd: number };
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type RealtimeEvent =
  | { type: 'ticket.created'; ticketId: string }
  | { type: 'ticket.updated'; ticketId: string }
  | { type: 'message.created'; ticketId: string; messageType: MessageType };
