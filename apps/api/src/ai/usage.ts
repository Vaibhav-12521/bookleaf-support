import type { AiOperation } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import type { LlmUsage } from './provider';

interface Price {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

const PRICING: Record<string, Price> = {
  'openai/gpt-oss-120b': { input: 0.15, output: 0.6, cacheRead: 0.5, cacheWrite: 1 },
  'openai/gpt-oss-20b': { input: 0.075, output: 0.3, cacheRead: 0.5, cacheWrite: 1 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.1, cacheWrite: 1.25 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 1.25 },
};

export function estimateCostUsd(model: string, usage: LlmUsage): number {
  const price = PRICING[model] ?? PRICING['openai/gpt-oss-120b']!;
  const perToken = (usd: number) => usd / 1_000_000;
  return (
    usage.inputTokens * perToken(price.input) +
    usage.cacheReadTokens * perToken(price.input * price.cacheRead) +
    usage.cacheWriteTokens * perToken(price.input * price.cacheWrite) +
    usage.outputTokens * perToken(price.output)
  );
}

interface AiEventInput {
  ticketId: string | null;
  operation: AiOperation;
  model: string;
  success: boolean;
  usage?: LlmUsage;
  latencyMs: number;
  errorCode?: string;
}

export async function recordAiEvent(event: AiEventInput): Promise<void> {
  try {
    await prisma.aiEvent.create({
      data: {
        ticketId: event.ticketId,
        operation: event.operation,
        model: event.model,
        success: event.success,
        inputTokens: event.usage?.inputTokens ?? 0,
        outputTokens: event.usage?.outputTokens ?? 0,
        cacheReadTokens: event.usage?.cacheReadTokens ?? 0,
        cacheWriteTokens: event.usage?.cacheWriteTokens ?? 0,
        latencyMs: event.latencyMs,
        errorCode: event.errorCode,
      },
    });
  } catch (err) {
    logger.warn('Failed to record AI event', { error: String(err) });
  }
  logger.info('ai_call', { ...event, usage: event.usage });
}
