import type { z } from 'zod';
import { AiError, type AiErrorCode, type LlmProvider, type LlmRequest, type LlmResult } from '../../src/ai/provider';

const USAGE = { inputTokens: 120, outputTokens: 40, cacheReadTokens: 600, cacheWriteTokens: 0 };

export class FakeProvider implements LlmProvider {
  readonly model = 'fake-model';
  calls: LlmRequest[] = [];

  constructor(
    private readonly behaviour: {
      structured?: unknown;
      text?: string;
      failWith?: AiErrorCode;
      /** Simulates a slow model so tests can interleave other requests. */
      delayMs?: number;
    },
  ) {}

  async generateStructured<S extends z.ZodType>(req: LlmRequest, schema: S): Promise<LlmResult<z.infer<S>>> {
    this.calls.push(req);
    if (this.behaviour.failWith) throw new AiError(this.behaviour.failWith, 'simulated failure', undefined, 5);
    return { value: schema.parse(this.behaviour.structured), usage: USAGE, model: this.model, latencyMs: 5 };
  }

  async generateText(req: LlmRequest): Promise<LlmResult<string>> {
    this.calls.push(req);
    if (this.behaviour.delayMs) await new Promise((r) => setTimeout(r, this.behaviour.delayMs));
    if (this.behaviour.failWith) throw new AiError(this.behaviour.failWith, 'simulated failure', undefined, 5);
    return { value: this.behaviour.text ?? 'Hi there,\n\nDraft.\n\nWarm regards,\nBookLeaf Author Support', usage: USAGE, model: this.model, latencyMs: 5 };
  }
}
