import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setAiProvider } from '../../src/ai/index';
import { triageQueueIdle } from '../../src/ai/triage.service';
import { prisma } from '../../src/lib/prisma';
import { FakeProvider } from '../helpers/fakeProvider';
import { ADMIN, PRIYA, ROHIT, api, hasTestDb, resetDatabase, tokenFor } from '../helpers/db';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe.skipIf(!hasTestDb)('AI integration: triage, drafts, graceful degradation', () => {
  let admin: string;
  let priya: string;
  let rohit: string;

  beforeAll(async () => {
    await resetDatabase();
    [admin, priya, rohit] = await Promise.all([tokenFor(ADMIN), tokenFor(PRIYA), tokenFor(ROHIT)]);
  });
  beforeEach(async () => {
    await prisma.ticket.deleteMany();
    await prisma.aiEvent.deleteMany();
  });
  afterAll(async () => {
    setAiProvider(undefined);
    await prisma.$disconnect();
  });

  async function raise(token: string, body: Record<string, unknown>) {
    const res = await api().post('/api/v1/tickets').set(auth(token)).send(body);
    expect(res.status).toBe(201);
    await triageQueueIdle();
    return res.body.ticket.id as string;
  }

  it('applies AI classification and records token usage', async () => {
    setAiProvider(
      new FakeProvider({ structured: { category: 'DISTRIBUTION_AVAILABILITY', priority: 'HIGH', confidence: 0.92, reasoning: 'Published book missing from a platform.' } }),
    );
    const id = await raise(priya, { bookId: 'BK001', subject: 'Book missing', description: 'Readers say they cannot buy my book anywhere online.' });

    const t = await prisma.ticket.findUniqueOrThrow({ where: { id } });
    expect(t).toMatchObject({ category: 'DISTRIBUTION_AVAILABILITY', priority: 'HIGH', categorySource: 'AI', triageStatus: 'COMPLETED', aiConfidence: 0.92 });
    expect(await prisma.aiEvent.count({ where: { ticketId: id, operation: 'TRIAGE', success: true } })).toBe(1);
  });

  it('enforces the ISBN policy floor even if the model under-prioritises', async () => {
    setAiProvider(new FakeProvider({ structured: { category: 'ISBN_METADATA', priority: 'LOW', confidence: 0.8, reasoning: 'ISBN question.' } }));
    const id = await raise(rohit, { bookId: 'BK003', subject: 'ISBN mismatch', description: 'Amazon shows a different ISBN from my printed copy.' });

    const t = await prisma.ticket.findUniqueOrThrow({ where: { id } });
    expect(t.priority).toBe('HIGH');
    expect(t.aiReasoning).toMatch(/Raised from Low to High/);
  });

  it('degrades gracefully when the AI is rate-limited: ticket kept, rules used, failure logged', async () => {
    setAiProvider(new FakeProvider({ failWith: 'RATE_LIMITED' }));
    const id = await raise(priya, { bookId: 'BK001', subject: 'Royalty question', description: 'How was my royalty for last quarter calculated?' });

    const t = await prisma.ticket.findUniqueOrThrow({ where: { id } });
    expect(t).toMatchObject({ triageStatus: 'FAILED', categorySource: 'RULES', category: 'ROYALTY_PAYMENTS' });
    expect(t.triageError).toMatch(/rate-limiting/);
    expect(await prisma.aiEvent.findFirst({ where: { ticketId: id } })).toMatchObject({ success: false, errorCode: 'RATE_LIMITED' });
  });

  it('never lets a later AI run overwrite an admin override', async () => {
    setAiProvider(new FakeProvider({ structured: { category: 'ROYALTY_PAYMENTS', priority: 'MEDIUM', confidence: 0.7, reasoning: 'x' } }));
    const id = await raise(priya, { bookId: 'BK001', subject: 'Question', description: 'A question about my royalty statement please.' });

    await api().patch(`/api/v1/tickets/${id}`).set(auth(admin)).send({ category: 'GENERAL_INQUIRY', priority: 'LOW' }).expect(200);
    await api().post(`/api/v1/tickets/${id}/triage`).set(auth(admin)).expect(202);
    await triageQueueIdle();

    const t = await prisma.ticket.findUniqueOrThrow({ where: { id } });
    expect(t).toMatchObject({ category: 'GENERAL_INQUIRY', priority: 'LOW', categorySource: 'ADMIN', aiCategory: 'ROYALTY_PAYMENTS' });
  });

  it('caches drafts and only calls the model again when the thread changes', async () => {
    const provider = new FakeProvider({
      structured: { category: 'ROYALTY_PAYMENTS', priority: 'MEDIUM', confidence: 0.9, reasoning: 'x' },
      text: 'Hi Priya,\n\nHere is your royalty breakdown.\n\nWarm regards,\nBookLeaf Author Support',
    });
    setAiProvider(provider);
    const id = await raise(priya, { bookId: 'BK001', subject: 'Royalty breakdown', description: 'Can I get a breakdown of my royalty please?' });
    const callsAfterTriage = provider.calls.length;

    const first = await api().get(`/api/v1/tickets/${id}/draft`).set(auth(admin));
    expect(first.body.draft).toMatchObject({ source: 'AI', content: expect.stringContaining('Hi Priya') });
    await api().get(`/api/v1/tickets/${id}/draft`).set(auth(admin));
    expect(provider.calls.length).toBe(callsAfterTriage + 1);

    await api().post(`/api/v1/tickets/${id}/messages`).set(auth(priya)).send({ body: 'Also, when is the next payout?' });
    await api().get(`/api/v1/tickets/${id}/draft`).set(auth(admin));
    expect(provider.calls.length).toBe(callsAfterTriage + 2);
  });

  it('gives the model the right context and keeps it lean', async () => {
    const provider = new FakeProvider({ structured: { category: 'ROYALTY_PAYMENTS', priority: 'MEDIUM', confidence: 0.9, reasoning: 'x' } });
    setAiProvider(provider);
    const id = await raise(priya, { bookId: 'BK001', subject: 'Royalty', description: 'When will my pending royalty be paid?' });
    await api().post(`/api/v1/tickets/${id}/messages`).set(auth(admin)).send({ body: 'SECRET-INTERNAL-NOTE', kind: 'NOTE' });
    await api().get(`/api/v1/tickets/${id}/draft`).set(auth(admin));

    const draftCall = provider.calls.at(-1)!;
    expect(draftCall.user).toContain('Whispers of the Ganges');
    expect(draftCall.user).toContain('pending: ₹3,570');
    expect(draftCall.user).not.toContain('The Saffron Diaries');
    expect(draftCall.user).toContain('internal_note');
    expect(draftCall.system.map((s) => s.text).join()).not.toContain('Printing & quality');
  });

  it('leaves royalty figures out of drafts for non-money tickets', async () => {
    const provider = new FakeProvider({ structured: { category: 'PRINTING_QUALITY', priority: 'HIGH', confidence: 0.9, reasoning: 'x' } });
    setAiProvider(provider);
    const id = await raise(priya, { bookId: 'BK001', subject: 'Blurry pages', description: 'My author copies have blurry images and misaligned pages.' });
    await api().get(`/api/v1/tickets/${id}/draft`).set(auth(admin));

    const triageCall = provider.calls[0]!;
    const draftCall = provider.calls.at(-1)!;
    expect(triageCall.user).toContain('Royalty earned');
    expect(draftCall.user).toContain('Whispers of the Ganges');
    expect(draftCall.user).not.toContain('Royalty earned');
    expect(draftCall.user).not.toContain('royalty_schedule');
  });

  it('dates a draft from when its context was read, so a reply that lands mid-generation makes it stale', async () => {
    setAiProvider(new FakeProvider({ structured: { category: 'ROYALTY_PAYMENTS', priority: 'MEDIUM', confidence: 0.9, reasoning: 'x' }, delayMs: 400 }));
    const id = await raise(priya, { bookId: 'BK001', subject: 'Royalty', description: 'When will my pending royalty be paid?' });

    const draftRequest = api().get(`/api/v1/tickets/${id}/draft`).set(auth(admin)).then((r) => r.body.draft);
    await new Promise((r) => setTimeout(r, 150));
    const followUp = (await api().post(`/api/v1/tickets/${id}/messages`).set(auth(priya)).send({ body: 'Also, which bank account?' })).body.message;
    const draft = await draftRequest;

    expect(new Date(draft.createdAt).getTime()).toBeLessThan(new Date(followUp.createdAt).getTime());
  });

  it('falls back to a template draft when the AI is down', async () => {
    setAiProvider(new FakeProvider({ failWith: 'UNAVAILABLE' }));
    const id = await raise(priya, { bookId: 'BK001', subject: 'Royalty', description: 'When will my pending royalty be paid?' });

    const res = await api().get(`/api/v1/tickets/${id}/draft`).set(auth(admin));
    expect(res.status).toBe(200);
    expect(res.body.draft).toMatchObject({ source: 'TEMPLATE', notice: expect.stringMatching(/temporarily unavailable/) });
    expect(res.body.draft.content).toContain('Hi Priya');
  });
});
