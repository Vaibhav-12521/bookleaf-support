import type { z } from 'zod';

export interface PromptBlock {
  text: string;
  cache?: boolean;
}

export interface LlmRequest {
  system: PromptBlock[];
  user: string;
  maxTokens: number;
  effort: 'low' | 'medium' | 'high';
  maxRetries?: number;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface LlmResult<T> {
  value: T;
  usage: LlmUsage;
  model: string;
  latencyMs: number;
}

export interface LlmProvider {
  readonly model: string;
  generateStructured<S extends z.ZodType>(req: LlmRequest, schema: S): Promise<LlmResult<z.infer<S>>>;
  generateText(req: LlmRequest): Promise<LlmResult<string>>;
}

export type AiErrorCode =
  | 'NOT_CONFIGURED'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'UNAVAILABLE'
  | 'AUTH'
  | 'BAD_REQUEST'
  | 'REFUSED'
  | 'INVALID_OUTPUT';

export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string,
    readonly usage?: LlmUsage,
    readonly latencyMs?: number,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

export function describeAiError(code: AiErrorCode): string {
  switch (code) {
    case 'NOT_CONFIGURED':
      return 'AI is not configured on this server.';
    case 'RATE_LIMITED':
      return 'The AI service is rate-limiting requests right now.';
    case 'TIMEOUT':
      return 'The AI service took too long to respond.';
    case 'UNAVAILABLE':
      return 'The AI service is temporarily unavailable.';
    case 'AUTH':
      return 'The AI service rejected our credentials.';
    case 'REFUSED':
      return 'The AI declined to answer this request.';
    case 'INVALID_OUTPUT':
      return 'The AI returned a response we could not use.';
    default:
      return 'The AI request failed.';
  }
}
