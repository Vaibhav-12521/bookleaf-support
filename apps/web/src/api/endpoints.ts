import type {
  Category,
  CreateMessageInput,
  CreateTicketInput,
  DraftDTO,
  LoginInput,
  MessageDTO,
  MyBooksResponse,
  Paginated,
  Priority,
  SessionUser,
  TicketDetailDTO,
  TicketListQuery,
  TicketOverviewDTO,
  TicketStatus,
  TicketSummaryDTO,
  UpdateTicketInput,
} from '@bookleaf/shared';
import { request } from './client';

export interface TicketFilters {
  status?: TicketStatus[];
  category?: Category[];
  priority?: Priority[];
  assignee?: TicketListQuery['assignee'];
  from?: string;
  to?: string;
  q?: string;
  sort?: TicketListQuery['sort'];
  page?: number;
  pageSize?: number;
}

function toQuery(filters: TicketFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) continue;
    params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const api = {
  login: (input: LoginInput) => request<{ user: SessionUser }>('/auth/login', { method: 'POST', json: input }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  me: () => request<{ user: SessionUser }>('/auth/me'),

  books: () => request<MyBooksResponse>('/books'),

  tickets: (filters: TicketFilters = {}) => request<Paginated<TicketSummaryDTO>>(`/tickets${toQuery(filters)}`),
  ticket: (id: string) => request<{ ticket: TicketDetailDTO }>(`/tickets/${id}`).then((r) => r.ticket),
  createTicket: (input: CreateTicketInput) =>
    request<{ ticket: TicketDetailDTO }>('/tickets', { method: 'POST', json: input }).then((r) => r.ticket),
  updateTicket: (id: string, input: UpdateTicketInput) =>
    request<{ ticket: TicketDetailDTO }>(`/tickets/${id}`, { method: 'PATCH', json: input }).then((r) => r.ticket),
  addMessage: (id: string, input: CreateMessageInput) =>
    request<{ message: MessageDTO }>(`/tickets/${id}/messages`, { method: 'POST', json: input }).then((r) => r.message),

  draft: (id: string) => request<{ draft: DraftDTO }>(`/tickets/${id}/draft`).then((r) => r.draft),
  regenerateDraft: (id: string) =>
    request<{ draft: DraftDTO }>(`/tickets/${id}/draft`, { method: 'POST' }).then((r) => r.draft),
  retriage: (id: string) => request<{ status: string }>(`/tickets/${id}/triage`, { method: 'POST' }),

  overview: () => request<{ overview: TicketOverviewDTO; aiEnabled: boolean }>('/admin/overview'),
};

export const keys = {
  me: ['me'] as const,
  books: ['books'] as const,
  tickets: ['tickets'] as const,
  ticketLists: ['tickets', 'list'] as const,
  ticketList: (filters: TicketFilters) => [...keys.ticketLists, filters] as const,
  ticket: (id: string) => ['tickets', 'detail', id] as const,
  draft: (id: string) => ['draft', id] as const,
  overview: ['overview'] as const,
};
