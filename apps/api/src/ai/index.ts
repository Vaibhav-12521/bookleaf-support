import { env } from '../config/env';
import { AnthropicProvider } from './anthropicProvider';
import { GroqProvider } from './groqProvider';
import type { LlmProvider } from './provider';

let provider: LlmProvider | null | undefined;

export function getAiProvider(): LlmProvider | null {
  if (provider === undefined) {
    const common = { model: env.AI_MODEL, timeoutMs: env.AI_TIMEOUT_MS };
    if (env.AI_PROVIDER === 'groq') {
      provider = env.GROQ_API_KEY
        ? new GroqProvider({ apiKey: env.GROQ_API_KEY, fallbackModel: env.AI_FALLBACK_MODEL, ...common })
        : null;
    } else {
      provider = env.ANTHROPIC_API_KEY ? new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY, ...common }) : null;
    }
  }
  return provider;
}

export function setAiProvider(next: LlmProvider | null | undefined): void {
  provider = next;
}
