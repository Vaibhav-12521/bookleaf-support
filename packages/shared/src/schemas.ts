import { z } from 'zod';
import { ATTACHMENT_RULES, CATEGORIES, PRIORITIES, TICKET_STATUSES } from './constants';

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required').max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const attachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive().max(ATTACHMENT_RULES.maxBytes, 'Attachments must be 5 MB or smaller'),
  mimeType: z.enum(ATTACHMENT_RULES.mimeTypes, { error: 'Only JPG, PNG, WEBP or PDF files are supported' }),
});
export type AttachmentInput = z.infer<typeof attachmentSchema>;

export const createTicketSchema = z.object({
  bookId: z.string().trim().min(1).max(20).nullable(),
  subject: trimmed(5, 150, 'Subject'),
  description: trimmed(20, 5000, 'Description'),
  attachment: attachmentSchema.optional(),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const updateTicketSchema = z
  .object({
    status: z.enum(TICKET_STATUSES).optional(),
    category: z.enum(CATEGORIES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    assigneeId: z.string().uuid().nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Provide at least one field to update',
  });
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

export const createMessageSchema = z.object({
  body: trimmed(1, 5000, 'Message'),
  kind: z.enum(['REPLY', 'NOTE']).default('REPLY'),
  status: z.enum(TICKET_STATUSES).optional(),
  fromAiDraft: z.boolean().optional(),
});
export type CreateMessageInput = z.input<typeof createMessageSchema>;
export type CreateMessageData = z.output<typeof createMessageSchema>;

const csvEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean))
    .pipe(z.array(z.enum(values)))
    .optional();

export const ticketListQuerySchema = z.object({
  status: csvEnum(TICKET_STATUSES),
  category: csvEnum(CATEGORIES),
  priority: csvEnum(PRIORITIES),
  assignee: z.enum(['me', 'unassigned']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(['urgency', 'oldest', 'newest', 'updated']).default('urgency'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type TicketListQuery = z.infer<typeof ticketListQuerySchema>;
