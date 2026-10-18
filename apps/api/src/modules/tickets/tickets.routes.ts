import { Router, type Request } from 'express';
import {
  createMessageSchema,
  createTicketSchema,
  ticketListQuerySchema,
  updateTicketSchema,
} from '@bookleaf/shared';
import { getDraft } from '../../ai/draft.service';
import { requestRetriage } from '../../ai/triage.service';
import { currentUser, requireRole } from '../../middleware/authenticate';
import { aiLimiter, draftReadLimiter, ticketCreateLimiter } from '../../middleware/rateLimits';
import { validateBody, validateQuery } from '../../middleware/validate';
import * as tickets from './tickets.service';

export const ticketsRouter = Router();

const ticketId = (req: Request) => String(req.params.id);

ticketsRouter.get('/', validateQuery(ticketListQuerySchema), async (req, res) => {
  res.json(await tickets.listTickets(currentUser(req), res.locals.query));
});

ticketsRouter.post('/', requireRole('AUTHOR'), ticketCreateLimiter, validateBody(createTicketSchema), async (req, res) => {
  const ticket = await tickets.createTicket(currentUser(req), req.body);
  res.status(201).location(`/api/v1/tickets/${ticket.id}`).json({ ticket });
});

ticketsRouter.get('/:id', async (req, res) => {
  res.json({ ticket: await tickets.getTicket(currentUser(req), ticketId(req)) });
});

ticketsRouter.patch('/:id', requireRole('ADMIN'), validateBody(updateTicketSchema), async (req, res) => {
  res.json({ ticket: await tickets.updateTicket(currentUser(req), ticketId(req), req.body) });
});

ticketsRouter.post('/:id/messages', validateBody(createMessageSchema), async (req, res) => {
  const message = await tickets.addMessage(currentUser(req), ticketId(req), req.body);
  res.status(201).json({ message });
});

ticketsRouter.get('/:id/draft', requireRole('ADMIN'), draftReadLimiter, async (req, res) => {
  res.json({ draft: await getDraft(ticketId(req)) });
});

ticketsRouter.post('/:id/draft', requireRole('ADMIN'), aiLimiter, async (req, res) => {
  res.status(201).json({ draft: await getDraft(ticketId(req), { regenerate: true }) });
});

ticketsRouter.post('/:id/triage', requireRole('ADMIN'), aiLimiter, async (req, res) => {
  await requestRetriage(ticketId(req));
  res.status(202).json({ status: 'PENDING' });
});
