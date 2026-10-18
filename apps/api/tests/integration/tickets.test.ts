import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setAiProvider } from '../../src/ai/index';
import { triageQueueIdle } from '../../src/ai/triage.service';
import { prisma } from '../../src/lib/prisma';
import { ADMIN, PRIYA, ROHIT, api, hasTestDb, resetDatabase, tokenFor } from '../helpers/db';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const newTicket = (overrides: Record<string, unknown> = {}) => ({
  bookId: 'BK001',
  subject: 'Royalty question for Whispers',
  description: 'I would like to understand how my royalty for this quarter was calculated.',
  ...overrides,
});

describe.skipIf(!hasTestDb)('tickets API: auth, access control, lifecycle', () => {
  let admin: string;
  let priya: string;
  let rohit: string;

  beforeAll(async () => {
    await resetDatabase();
    setAiProvider(null);
    [admin, priya, rohit] = await Promise.all([tokenFor(ADMIN), tokenFor(PRIYA), tokenFor(ROHIT)]);
  });
  beforeEach(async () => {
    await prisma.ticket.deleteMany();
  });
  afterAll(async () => {
    setAiProvider(undefined);
    await prisma.$disconnect();
  });

  it('rejects unauthenticated requests and bad credentials with clear errors', async () => {
    const res = await api().get('/api/v1/tickets');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');

    const bad = await api().post('/api/v1/auth/login').send({ email: PRIYA, password: 'wrong' });
    expect(bad.status).toBe(401);
  });

  it('sets an httpOnly session cookie on login', async () => {
    const res = await api().post('/api/v1/auth/login').send({ email: PRIYA, password: 'Author@123' });
    expect(res.headers['set-cookie']?.[0]).toMatch(/bl_session=.*HttpOnly/i);
  });

  it('returns 422 with field-level details for invalid input', async () => {
    const res = await api().post('/api/v1/tickets').set(auth(priya)).send({ bookId: null, subject: 'x', description: 'short' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(expect.arrayContaining(['subject', 'description']));
  });

  it("won't let an author raise a ticket about someone else's book", async () => {
    const res = await api().post('/api/v1/tickets').set(auth(priya)).send(newTicket({ bookId: 'BK003' }));
    expect(res.status).toBe(422);
  });

  it('creates a ticket even with AI unavailable, using rule-based triage', async () => {
    const res = await api().post('/api/v1/tickets').set(auth(priya)).send(newTicket());
    expect(res.status).toBe(201);
    expect(res.body.ticket).toMatchObject({ status: 'OPEN', category: 'ROYALTY_PAYMENTS', reference: expect.stringMatching(/^BL-\d{5}$/) });
    expect(res.body.ticket.triage).toBeUndefined();

    await triageQueueIdle();
    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: res.body.ticket.id } });
    expect(stored).toMatchObject({ triageStatus: 'FAILED', categorySource: 'RULES' });
  });

  it('scopes tickets to their author and hides existence of others (404, not 403)', async () => {
    const created = await api().post('/api/v1/tickets').set(auth(priya)).send(newTicket());
    const id = created.body.ticket.id;

    const rohitList = await api().get('/api/v1/tickets').set(auth(rohit));
    expect(rohitList.body.total).toBe(0);
    expect((await api().get(`/api/v1/tickets/${id}`).set(auth(rohit))).status).toBe(404);
    expect((await api().post(`/api/v1/tickets/${id}/messages`).set(auth(rohit)).send({ body: 'hi' })).status).toBe(404);

    const adminList = await api().get('/api/v1/tickets').set(auth(admin));
    expect(adminList.body.total).toBe(1);
  });

  it('keeps admin-only endpoints admin-only', async () => {
    const created = await api().post('/api/v1/tickets').set(auth(priya)).send(newTicket());
    const id = created.body.ticket.id;
    expect((await api().patch(`/api/v1/tickets/${id}`).set(auth(priya)).send({ status: 'CLOSED' })).status).toBe(403);
    expect((await api().get(`/api/v1/tickets/${id}/draft`).set(auth(priya))).status).toBe(403);
    expect((await api().get('/api/v1/admin/overview').set(auth(priya))).status).toBe(403);
    expect((await api().post('/api/v1/tickets').set(auth(admin)).send(newTicket())).status).toBe(403);
  });

  it('runs the full lifecycle: reply, internal note, resolve, author follow-up, close', async () => {
    const created = await api().post('/api/v1/tickets').set(auth(priya)).send(newTicket());
    const id = created.body.ticket.id;

    await api().post(`/api/v1/tickets/${id}/messages`).set(auth(admin)).send({ body: 'Checking payout file', kind: 'NOTE' }).expect(201);

    await api().post(`/api/v1/tickets/${id}/messages`).set(auth(admin)).send({ body: 'Hi Priya, here is the breakdown.' }).expect(201);
    let adminView = (await api().get(`/api/v1/tickets/${id}`).set(auth(admin))).body.ticket;
    expect(adminView).toMatchObject({ status: 'IN_PROGRESS', awaitingTeam: false, assignee: { name: 'Aisha Khan' } });
    expect(adminView.firstResponseAt).not.toBeNull();
    expect(adminView.messages).toHaveLength(2);

    const authorView = (await api().get(`/api/v1/tickets/${id}`).set(auth(priya))).body.ticket;
    expect(authorView.messages.map((m: { type: string }) => m.type)).toEqual(['ADMIN_REPLY']);

    await api().post(`/api/v1/tickets/${id}/messages`).set(auth(admin)).send({ body: 'Resolved!', status: 'RESOLVED' }).expect(201);
    await api().post(`/api/v1/tickets/${id}/messages`).set(auth(priya)).send({ body: 'One more question...' }).expect(201);
    adminView = (await api().get(`/api/v1/tickets/${id}`).set(auth(admin))).body.ticket;
    expect(adminView).toMatchObject({ status: 'OPEN', awaitingTeam: true });

    await api().patch(`/api/v1/tickets/${id}`).set(auth(admin)).send({ status: 'CLOSED' }).expect(200);
    const blocked = await api().post(`/api/v1/tickets/${id}/messages`).set(auth(priya)).send({ body: 'Still there?' });
    expect(blocked.status).toBe(409);
  });

  it('refuses to send an admin reply that still contains [placeholders]; notes are allowed', async () => {
    const id = (await api().post('/api/v1/tickets').set(auth(priya)).send(newTicket())).body.ticket.id;

    const reply = await api().post(`/api/v1/tickets/${id}/messages`).set(auth(admin)).send({ body: 'Paid on [confirm date].' });
    expect(reply.status).toBe(422);
    expect(reply.body.error.details[0]).toMatchObject({ path: 'body', message: expect.stringContaining('[confirm date]') });

    await api().post(`/api/v1/tickets/${id}/messages`).set(auth(admin)).send({ body: 'Check [bank details] first', kind: 'NOTE' }).expect(201);
    const authorView = (await api().get(`/api/v1/tickets/${id}`).set(auth(priya))).body.ticket;
    expect(authorView.messages).toHaveLength(0);
  });

  it('filters and sorts the queue by urgency', async () => {
    await api().post('/api/v1/tickets').set(auth(priya)).send(newTicket({ subject: 'Can I update my author bio?', description: 'Just wanted to know how to update my bio.', bookId: null }));
    await api().post('/api/v1/tickets').set(auth(priya)).send(newTicket({ subject: 'No royalty for over a year', description: "I haven't received any royalty for 12 months now." }));

    const res = await api().get('/api/v1/tickets?sort=urgency').set(auth(admin));
    expect(res.body.items.map((t: { priority: string }) => t.priority)).toEqual(['CRITICAL', 'LOW']);

    const lowOnly = await api().get('/api/v1/tickets?priority=LOW').set(auth(admin));
    expect(lowOnly.body.total).toBe(1);

    const invalid = await api().get('/api/v1/tickets?priority=URGENT').set(auth(admin));
    expect(invalid.status).toBe(422);
  });

  it('shows books in production without fake numbers', async () => {
    const kavita = await tokenFor('kavita.deshmukh@email.com');
    const res = await api().get('/api/v1/books').set(auth(kavita));
    const inProduction = res.body.books.find((b: { id: string }) => b.id === 'BK015');
    expect(inProduction).toMatchObject({ isPublished: false, productionStage: 'Typesetting', mrp: null, publicationDate: null });
    const nagpur = res.body.books.find((b: { id: string }) => b.id === 'BK016');
    expect(nagpur.royalty).toMatchObject({ pending: 850, belowThreshold: true });
  });
});
