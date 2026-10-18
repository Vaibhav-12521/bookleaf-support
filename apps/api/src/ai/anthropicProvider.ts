import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';
import { AiError, type LlmProvider, type LlmRequest, type LlmResult, type LlmUsage } from './provider';

interface Options {
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export class AnthropicProvider implements LlmProvider {
  private readonly client: Anthropic;
  readonly model: string;

  constructor({ apiKey, model, timeoutMs }: Options) {
    this.client = new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 2 });
    this.model = model;
  }

  async generateStructured<S extends z.ZodType>(req: LlmRequest, schema: S): Promise<LlmResult<z.infer<S>>> {
    const started = Date.now();
    let response;
    try {
      response = await this.client.messages.parse(
        { ...this.baseParams(req), output_config: { effort: req.effort, format: zodOutputFormat(schema) } },
        { maxRetries: req.maxRetries },
      );
    } catch (err) {
      throw toAiError(err, Date.now() - started);
    }

    const latencyMs = Date.now() - started;
    const usage = toUsage(response.usage);
    this.assertCompleted(response.stop_reason, usage, latencyMs);
    if (response.parsed_output == null) {
      throw new AiError('INVALID_OUTPUT', 'Structured output was empty', usage, latencyMs);
    }
    return { value: response.parsed_output as z.infer<S>, usage, model: response.model, latencyMs };
  }

  async generateText(req: LlmRequest): Promise<LlmResult<string>> {
    const started = Date.now();
    let response;
    try {
      response = await this.client.messages.create(
        { ...this.baseParams(req), output_config: { effort: req.effort } },
        { maxRetries: req.maxRetries },
      );
    } catch (err) {
      throw toAiError(err, Date.now() - started);
    }

    const latencyMs = Date.now() - started;
    const usage = toUsage(response.usage);
    this.assertCompleted(response.stop_reason, usage, latencyMs);
    const text = response.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('')
      .trim();
    if (!text) throw new AiError('INVALID_OUTPUT', 'Model returned no text', usage, latencyMs);
    return { value: text, usage, model: response.model, latencyMs };
  }

  private baseParams(req: LlmRequest) {
    return {
      model: this.model,
      max_tokens: req.maxTokens,
      system: req.system.map(
        (block): Anthropic.TextBlockParam => ({
          type: 'text',
          text: block.text,
          ...(block.cache ? { cache_control: { type: 'ephemeral' as const } } : {}),
        }),
      ),
      messages: [{ role: 'user' as const, content: req.user }],
    };
  }

  private assertCompleted(stopReason: string | null, usage: LlmUsage, latencyMs: number) {
    if (stopReason === 'refusal') throw new AiError('REFUSED', 'Model declined the request', usage, latencyMs);
    if (stopReason === 'max_tokens') throw new AiError('INVALID_OUTPUT', 'Response was truncated', usage, latencyMs);
  }
}

function toUsage(u: Anthropic.Usage): LlmUsage {
  return {
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
  };
}

function toAiError(err: unknown, latencyMs: number): AiError {
  if (err instanceof AiError) return err;
  if (err instanceof Anthropic.RateLimitError) return new AiError('RATE_LIMITED', err.message, undefined, latencyMs);
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new AiError('TIMEOUT', err.message, undefined, latencyMs);
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new AiError('AUTH', err.message, undefined, latencyMs);
  }
  if (err instanceof Anthropic.BadRequestError) return new AiError('BAD_REQUEST', err.message, undefined, latencyMs);
  if (err instanceof Anthropic.APIError) return new AiError('UNAVAILABLE', err.message, undefined, latencyMs);
  const message = err instanceof Error ? err.message : String(err);
  return new AiError('INVALID_OUTPUT', message, undefined, latencyMs);
}
