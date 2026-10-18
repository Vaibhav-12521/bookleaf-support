import { PrismaClient } from '@prisma/client';
import { DEMO_ADMINS, DEMO_ADMIN_PASSWORD, DEMO_AUTHOR_PASSWORD, runSeed } from '../src/seed/seed';

const prisma = new PrismaClient();

async function main() {
  const demoTickets = !process.argv.includes('--no-demo-tickets');
  const result = await runSeed(prisma, { demoTickets });

  console.log(`Seeded ${result.authors} authors, ${result.books} books, ${result.admins} admins, ${result.demoTicketsCreated} new demo tickets.`);
  if (result.warnings.length) {
    console.warn(`Dataset warnings (seeded as-is):\n - ${result.warnings.join('\n - ')}`);
  } else {
    console.log('Dataset audit: no inconsistencies found.');
  }
  console.log(`\nAuthor logins: <author email from dataset> / ${DEMO_AUTHOR_PASSWORD}`);
  console.log(`Admin logins:  ${DEMO_ADMINS.map((a) => a.email).join(', ')} / ${DEMO_ADMIN_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
