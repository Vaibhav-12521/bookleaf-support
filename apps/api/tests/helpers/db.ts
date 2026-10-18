import supertest from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { DEMO_ADMIN_PASSWORD, DEMO_AUTHOR_PASSWORD, runSeed } from '../../src/seed/seed';

export const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

export async function resetDatabase() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "AiEvent", "AiDraft", "TicketMessage", "Ticket", "Book", "Author", "User" RESTART IDENTITY CASCADE',
  );
  await runSeed(prisma, { demoTickets: false });
}

export const api = () => supertest(createApp());

export async function tokenFor(email: string) {
  const password = email.endsWith('@bookleaf.demo') ? DEMO_ADMIN_PASSWORD : DEMO_AUTHOR_PASSWORD;
  const res = await api().post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status}`);
  return res.body.token as string;
}

export const ADMIN = 'lead@bookleaf.demo';
export const PRIYA = 'priya.sharma@email.com';
export const ROHIT = 'rohit.kapoor@email.com';
