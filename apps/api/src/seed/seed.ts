import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import { classifyByRules } from '../ai/rules';
import { auditDataset, loadDataset, type Dataset } from './dataset';
import { DEMO_TICKETS } from './demoTickets';

export const DEMO_AUTHOR_PASSWORD = 'Author@123';
export const DEMO_ADMIN_PASSWORD = 'Admin@123';

export const DEMO_ADMINS = [
  { email: 'lead@bookleaf.demo', name: 'Aisha Khan' },
  { email: 'agent@bookleaf.demo', name: 'Rahul Verma' },
];

const HOUR_MS = 60 * 60 * 1000;
const toDate = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00.000Z`) : null);

export interface SeedResult {
  authors: number;
  books: number;
  admins: number;
  demoTicketsCreated: number;
  warnings: string[];
}

export async function runSeed(
  prisma: PrismaClient,
  options: { dataset?: Dataset; demoTickets?: boolean } = {},
): Promise<SeedResult> {
  const data = options.dataset ?? loadDataset();
  const warnings = auditDataset(data);
  const [authorHash, adminHash] = await Promise.all([
    bcrypt.hash(DEMO_AUTHOR_PASSWORD, 10),
    bcrypt.hash(DEMO_ADMIN_PASSWORD, 10),
  ]);

  const adminIds: string[] = [];
  for (const admin of DEMO_ADMINS) {
    const user = await prisma.user.upsert({
      where: { email: admin.email },
      update: { name: admin.name, role: 'ADMIN' },
      create: { email: admin.email, name: admin.name, role: 'ADMIN', passwordHash: adminHash },
    });
    adminIds.push(user.id);
  }

  let books = 0;
  for (const a of data.authors) {
    const email = a.email.toLowerCase();
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { email },
        update: { name: a.name },
        create: { email, name: a.name, role: 'AUTHOR', passwordHash: authorHash },
      });
      const profile = { phone: a.phone, city: a.city, joinedDate: toDate(a.joined_date)! };
      await tx.author.upsert({
        where: { id: a.author_id },
        update: profile,
        create: { id: a.author_id, userId: user.id, ...profile },
      });
      for (const b of a.books) {
        const fields = {
          authorId: a.author_id,
          title: b.title,
          isbn: b.isbn,
          genre: b.genre,
          publicationDate: toDate(b.publication_date),
          status: b.status,
          mrp: b.mrp,
          royaltyPerCopy: b.author_royalty_per_copy,
          copiesSold: b.total_copies_sold,
          royaltyEarned: b.total_royalty_earned,
          royaltyPaid: b.royalty_paid,
          royaltyPending: b.royalty_pending,
          lastPayoutDate: toDate(b.last_royalty_payout_date),
          printPartner: b.print_partner,
          platforms: b.available_on,
        };
        await tx.book.upsert({ where: { id: b.book_id }, update: fields, create: { id: b.book_id, ...fields } });
        books++;
      }
    });
  }

  const demoTicketsCreated = options.demoTickets === false ? 0 : await seedDemoTickets(prisma, adminIds[0]!);

  return { authors: data.authors.length, books, admins: adminIds.length, demoTicketsCreated, warnings };
}

async function seedDemoTickets(prisma: PrismaClient, leadAdminId: string): Promise<number> {
  const now = Date.now();
  let created = 0;

  for (const demo of DEMO_TICKETS) {
    const exists = await prisma.ticket.findUnique({ where: { id: demo.id }, select: { id: true } });
    if (exists) continue;

    const author = await prisma.author.findUnique({ where: { id: demo.authorId }, select: { userId: true } });
    if (!author) continue;

    const rules = classifyByRules(demo.subject, demo.description);
    const thread = demo.thread ?? [];
    const publicThread = thread.filter((m) => m.type !== 'INTERNAL_NOTE');
    const lastPublic = publicThread[publicThread.length - 1];
    const firstReply = thread.filter((m) => m.type === 'ADMIN_REPLY').sort((x, y) => y.ageHours - x.ageHours)[0];
    const at = (ageHours: number) => new Date(now - ageHours * HOUR_MS);

    await prisma.ticket.create({
      data: {
        id: demo.id,
        authorId: demo.authorId,
        bookId: demo.bookId,
        subject: demo.subject,
        description: demo.description,
        status: demo.status,
        category: rules.category,
        priority: rules.priority,
        categorySource: 'RULES',
        prioritySource: 'RULES',
        triageStatus: 'PENDING',
        assigneeId: demo.assignToLead || firstReply ? leadAdminId : null,
        awaitingTeam: !lastPublic || lastPublic.type === 'AUTHOR_MESSAGE',
        firstResponseAt: firstReply ? at(firstReply.ageHours) : null,
        resolvedAt: demo.status === 'RESOLVED' || demo.status === 'CLOSED' ? at(thread[thread.length - 1]?.ageHours ?? 0) : null,
        createdAt: at(demo.ageHours),
        messages: {
          create: thread.map((m) => ({
            type: m.type,
            body: m.body,
            senderId: m.type === 'AUTHOR_MESSAGE' ? author.userId : leadAdminId,
            createdAt: at(m.ageHours),
          })),
        },
      },
    });
    created++;
  }
  return created;
}
