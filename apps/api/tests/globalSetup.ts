import { execSync } from 'node:child_process';

export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    console.warn('\nTEST_DATABASE_URL not set: integration tests will be skipped (unit tests still run).\n');
    return;
  }
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } });
}
