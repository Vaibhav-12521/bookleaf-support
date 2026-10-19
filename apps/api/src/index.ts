import { env } from './config/env';
import { createApp } from './app';
import { getAiProvider } from './ai/index';
import { resumePendingTriage } from './ai/triage.service';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info('API listening', {
    port: env.PORT,
    env: env.NODE_ENV,
    ai: getAiProvider()
      ? `enabled (${env.AI_PROVIDER}: ${env.AI_MODEL})`
      : `disabled: no API key for ${env.AI_PROVIDER}, using rules + templates`,
  });
  resumePendingTriage().catch((err: unknown) =>
    logger.error('Could not resume pending triage', { error: err instanceof Error ? err.message.trim().split('\n').pop() : String(err) }),
  );
});

async function shutdown(signal: string) {
  logger.info('Shutting down', { signal });
  server.close();
  server.closeAllConnections();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
