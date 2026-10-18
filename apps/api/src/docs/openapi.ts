import { z } from 'zod';
import {
  CATEGORIES,
  PRIORITIES,
  TICKET_STATUSES,
  createMessageSchema,
  createTicketSchema,
  loginSchema,
  updateTicketSchema,
} from '@bookleaf/shared';

const jsonSchema = (schema: z.ZodType) => z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });

const json = (schema: object, description = 'OK') => ({
  description,
  content: { 'application/json': { schema } },
});

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const err = (description: string) => json(ref('Error'), description);

const COMMON_ERRORS = {
  401: err('Not signed in or session expired'),
  403: err('Signed in but not allowed (wrong role)'),
};

const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };

const csvParam = (name: string, values: readonly string[], description: string) => ({
  name,
  in: 'query',
  required: false,
  description: `${description} Comma-separated, any of: ${values.join(', ')}`,
  schema: { type: 'string' },
});

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'BookLeaf Author Support API',
    version: '1.0.0',
    description:
      'REST API for the BookLeaf Author Support & Communication Portal.\n\n' +
      '**Auth:** `POST /auth/login` sets an httpOnly session cookie and also returns a JWT. ' +
      'Use the cookie from a browser, or click *Authorize* and paste the token as a Bearer token.\n\n' +
      '**Access:** authors only ever see their own books, tickets and public messages; admins see everything, including internal notes and AI triage data.\n\n' +
      '**Errors** always look like `{ "error": { "code", "message", "details?" } }`.',
  },
  servers: [{ url: '/api/v1' }],
  security: [{ cookieAuth: [] }, { bearerAuth: [] }],
  tags: [
    { name: 'Auth' },
    { name: 'Books' },
    { name: 'Tickets' },
    { name: 'AI', description: 'Admin-only AI assistance. Always degrades to rules/templates instead of failing.' },
    { name: 'Admin' },
    { name: 'Realtime' },
  ],
  paths: {
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Sign in with email and password',
        security: [],
        requestBody: { required: true, content: { 'application/json': { schema: jsonSchema(loginSchema) } } },
        responses: {
          200: json({ type: 'object', properties: { user: ref('SessionUser'), token: { type: 'string' } } }),
          401: err('Incorrect email or password'),
          422: err('Validation error'),
          429: err('Too many attempts'),
        },
      },
    },
    '/auth/logout': {
      post: { tags: ['Auth'], summary: 'Clear the session cookie', security: [], responses: { 204: { description: 'Signed out' } } },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current user',
        responses: { 200: json({ type: 'object', properties: { user: ref('SessionUser') } }), 401: COMMON_ERRORS[401] },
      },
    },
    '/books': {
      get: {
        tags: ['Books'],
        summary: "List books (author: own books + royalty summary; admin: all books)",
        description:
          'Books still in production have null MRP / royalty per copy / publication date; `productionStage` shows where they are in the pipeline.',
        responses: { 200: json(ref('MyBooksResponse')), 401: COMMON_ERRORS[401] },
      },
    },
    '/books/{bookId}': {
      get: {
        tags: ['Books'],
        summary: 'Get one book',
        parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string' }, example: 'BK001' }],
        responses: { 200: json({ type: 'object', properties: { book: ref('Book') } }), 401: COMMON_ERRORS[401], 404: err('Not found or not yours') },
      },
    },
    '/tickets': {
      get: {
        tags: ['Tickets'],
        summary: 'List tickets (author: own; admin: all) with filters, sorting and pagination',
        parameters: [
          csvParam('status', TICKET_STATUSES, 'Filter by status.'),
          csvParam('category', CATEGORIES, 'Filter by category.'),
          csvParam('priority', PRIORITIES, 'Filter by priority.'),
          { name: 'assignee', in: 'query', schema: { type: 'string', enum: ['me', 'unassigned'] }, description: 'Admin only' },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Created on/after' },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Created on/before' },
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search subject, author, book title or reference (BL-00042)' },
          {
            name: 'sort',
            in: 'query',
            schema: { type: 'string', enum: ['urgency', 'oldest', 'newest', 'updated'], default: 'urgency' },
            description: 'urgency = priority (Critical first), then oldest first',
          },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 } },
        ],
        responses: { 200: json(ref('TicketPage')), 401: COMMON_ERRORS[401], 422: err('Invalid filter') },
      },
      post: {
        tags: ['Tickets'],
        summary: 'Raise a ticket (authors only)',
        description:
          'Saved immediately with a rule-based category/priority, so creation never depends on the AI. AI triage then runs in the background and pushes a realtime update.',
        requestBody: { required: true, content: { 'application/json': { schema: jsonSchema(createTicketSchema) } } },
        responses: {
          201: json({ type: 'object', properties: { ticket: ref('TicketDetail') } }, 'Created'),
          ...COMMON_ERRORS,
          422: err('Validation error (including a bookId that is not yours)'),
          429: err('Too many tickets'),
        },
      },
    },
    '/tickets/{id}': {
      get: {
        tags: ['Tickets'],
        summary: 'Ticket with its conversation',
        description: 'Authors never receive internal notes or triage data. Admins also get `triage` and `authorContext`.',
        parameters: [idParam],
        responses: { 200: json({ type: 'object', properties: { ticket: ref('TicketDetail') } }), 401: COMMON_ERRORS[401], 404: err('Not found or not yours') },
      },
      patch: {
        tags: ['Tickets'],
        summary: 'Update status, override category/priority, or assign (admins only)',
        description: 'Category/priority set here are marked as ADMIN decisions and are never overwritten by a later AI run.',
        parameters: [idParam],
        requestBody: { required: true, content: { 'application/json': { schema: jsonSchema(updateTicketSchema) } } },
        responses: { 200: json({ type: 'object', properties: { ticket: ref('TicketDetail') } }), ...COMMON_ERRORS, 404: err('Not found'), 422: err('Validation error') },
      },
    },
    '/tickets/{id}/messages': {
      post: {
        tags: ['Tickets'],
        summary: 'Post a message',
        description:
          'Author: a follow-up (reopens a Resolved ticket; Closed tickets return 409).\n' +
          'Admin `kind: REPLY`: visible to the author; sets first response, auto-assigns if unassigned, moves Open to In Progress, or to `status` if given ("Send & resolve"). Rejected with 422 if the body still contains a draft `[placeholder]`.\n' +
          'Admin `kind: NOTE`: internal note, never visible to the author.',
        parameters: [idParam],
        requestBody: { required: true, content: { 'application/json': { schema: jsonSchema(createMessageSchema) } } },
        responses: { 201: json({ type: 'object', properties: { message: ref('Message') } }, 'Created'), 401: COMMON_ERRORS[401], 404: err('Not found or not yours'), 409: err('Ticket is closed'), 422: err('Validation error') },
      },
    },
    '/tickets/{id}/draft': {
      get: {
        tags: ['AI'],
        summary: 'Get the reply draft (cached if still fresh)',
        description:
          'Returns the cached AI draft unless the thread or category changed since it was written. If the AI is unavailable, returns a category template with `source: TEMPLATE` and a `notice`. Never fails because of the AI.',
        parameters: [idParam],
        responses: { 200: json({ type: 'object', properties: { draft: ref('Draft') } }), ...COMMON_ERRORS, 404: err('Not found'), 429: err('AI rate limit') },
      },
      post: {
        tags: ['AI'],
        summary: 'Regenerate the reply draft',
        parameters: [idParam],
        responses: { 201: json({ type: 'object', properties: { draft: ref('Draft') } }, 'Created'), ...COMMON_ERRORS, 404: err('Not found'), 429: err('AI rate limit') },
      },
    },
    '/tickets/{id}/triage': {
      post: {
        tags: ['AI'],
        summary: 'Re-run AI classification and priority (async)',
        parameters: [idParam],
        responses: { 202: json({ type: 'object', properties: { status: { const: 'PENDING' } } }, 'Accepted'), ...COMMON_ERRORS, 404: err('Not found') },
      },
    },
    '/admin/overview': {
      get: {
        tags: ['Admin'],
        summary: 'Queue counts, urgency breakdown and AI usage/cost',
        responses: { 200: json({ type: 'object', properties: { overview: { type: 'object' }, aiEnabled: { type: 'boolean' } } }), ...COMMON_ERRORS },
      },
    },
    '/events': {
      get: {
        tags: ['Realtime'],
        summary: 'Server-Sent Events stream',
        description:
          'Events: `ticket.created`, `ticket.updated`, `message.created`, each `{ type, ticketId }`. Payloads carry no ticket content; clients refetch through the authorised endpoints. Authors only receive events for their own tickets, and never for internal notes or triage.',
        responses: { 200: { description: 'text/event-stream', content: { 'text/event-stream': { schema: { type: 'string' } } } }, 401: COMMON_ERRORS[401] },
      },
    },
  },
  components: {
    securitySchemes: {
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'bl_session' },
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', examples: ['VALIDATION_ERROR', 'NOT_FOUND', 'UNAUTHORIZED'] },
              message: { type: 'string' },
              details: { description: 'For VALIDATION_ERROR: [{ path, message }]' },
            },
          },
        },
      },
      SessionUser: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
          name: { type: 'string' },
          role: { enum: ['AUTHOR', 'ADMIN'] },
          authorId: { type: ['string', 'null'] },
        },
      },
      Book: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          isbn: { type: 'string' },
          genre: { type: 'string' },
          publicationDate: { type: ['string', 'null'], format: 'date' },
          status: { type: 'string' },
          isPublished: { type: 'boolean' },
          productionStage: { type: 'string' },
          mrp: { type: ['integer', 'null'] },
          copiesSold: { type: 'integer' },
          royalty: {
            type: 'object',
            properties: {
              perCopy: { type: ['integer', 'null'] },
              earned: { type: 'integer' },
              paid: { type: 'integer' },
              pending: { type: 'integer' },
              lastPayoutDate: { type: ['string', 'null'], format: 'date' },
              belowThreshold: { type: 'boolean' },
            },
          },
          printPartner: { type: ['string', 'null'] },
          platforms: { type: 'array', items: { type: 'string' } },
        },
      },
      MyBooksResponse: {
        type: 'object',
        properties: {
          books: { type: 'array', items: ref('Book') },
          summary: {
            type: 'object',
            properties: {
              totalEarned: { type: 'integer' },
              totalPaid: { type: 'integer' },
              totalPending: { type: 'integer' },
              totalCopiesSold: { type: 'integer' },
              nextPayoutDate: { type: 'string', format: 'date' },
              quarterEndDate: { type: 'string', format: 'date' },
            },
          },
        },
      },
      Message: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { enum: ['AUTHOR_MESSAGE', 'ADMIN_REPLY', 'INTERNAL_NOTE'] },
          body: { type: 'string' },
          sender: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, role: { type: 'string' } } },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      TicketSummary: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          reference: { type: 'string', examples: ['BL-00001'] },
          subject: { type: 'string' },
          status: { enum: [...TICKET_STATUSES] },
          category: { enum: [...CATEGORIES] },
          priority: { enum: [...PRIORITIES] },
          book: { type: ['object', 'null'] },
          author: { type: 'object' },
          assignee: { type: ['object', 'null'] },
          awaitingTeam: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          firstResponseAt: { type: ['string', 'null'], format: 'date-time' },
        },
      },
      TicketDetail: {
        allOf: [
          ref('TicketSummary'),
          {
            type: 'object',
            properties: {
              description: { type: 'string' },
              attachment: { type: ['object', 'null'] },
              resolvedAt: { type: ['string', 'null'], format: 'date-time' },
              messages: { type: 'array', items: ref('Message') },
              triage: { type: 'object', description: 'Admins only' },
              authorContext: { type: 'object', description: 'Admins only' },
            },
          },
        ],
      },
      TicketPage: {
        type: 'object',
        properties: {
          items: { type: 'array', items: ref('TicketSummary') },
          page: { type: 'integer' },
          pageSize: { type: 'integer' },
          total: { type: 'integer' },
        },
      },
      Draft: {
        type: 'object',
        properties: {
          ticketId: { type: 'string' },
          content: { type: 'string' },
          source: { enum: ['AI', 'TEMPLATE'] },
          model: { type: ['string', 'null'] },
          createdAt: { type: 'string', format: 'date-time' },
          notice: { type: ['string', 'null'] },
        },
      },
    },
  },
};
