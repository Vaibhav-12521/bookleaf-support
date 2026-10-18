import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/globalSetup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://invalid:invalid@localhost:1/none',
      JWT_SECRET: 'test-secret-test-secret-test-secret-123456',
      GROQ_API_KEY: '',
      ANTHROPIC_API_KEY: '',
    },
  },
});
