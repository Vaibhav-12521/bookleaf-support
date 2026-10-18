import Groq from 'groq-sdk';
import type { ChatCompletionCreateParamsNonStreaming } from 'groq-sdk/resources/chat/completions';
import { z } from 'zod';
import { AiError, type LlmProvider, type LlmRequest, type LlmResult, type LlmUsage } from './provider';

interface Options {
  apiKey: string;
  model: string;
  fallbackModel?: string;
  timeoutMs: number;
}

type ChatParams = ChatCompletionCreateParamsNonStreaming;
type Completion = Groq.Chat.ChatCompletion;

export class GroqProvider implements LlmProvider {
  private readonly client: Groq;
  readonly model: string;
  private readonly fallbackModel?: string;

  constructor({ apiKey, model, fallbackModel, timeoutMs }: Options) {
    this.client = new Groq({ apiKey, timeout: timeoutMs, maxRetries: 2 });
    this.model = model;
    this.fallbackModel = fallbackModel && fallbackModel !== model ? fallbackModel : undefined;
  }

  async generateStructured<S extends z.ZodType>(req: LlmRequest, schema: S): Promise<LlmResult<z.infer<S>>> {
    const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(schema, { target: 'draft-7' }) as Record<string, unknown>;
    const { response, usage, latencyMs } = await this.complete(req, {
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'triage_result', strict: true, schema: jsonSchema },
      },
    });

    const raw = response.choices[0]?.message.content ?? '';
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new AiError('INVALID_OUTPUT', 'Model returned invalid JSON', usage, latencyMs);
    }
    const result = schema.safeParse(parsed);
    if (!result.success) throw new AiError('INVALID_OUTPUT', 'Model output did not match the schema', usage, latencyMs);
    return { value: result.data, usage, model: response.model, latencyMs };
  }

  async generateText(req: LlmRequest): Promise<LlmResult<string>> {
    const { response, usage, latencyMs } = await this.complete(req, {});
    const text = response.choices[0]?.message.content?.trim() ?? '';
    if (!text) throw new AiError('INVALID_OUTPUT', 'Model returned no text', usage, latencyMs);
    return { value: text, usage, model: response.model, latencyMs };
  }

  private async complete(req: LlmRequest, extra: Partial<ChatParams>) {
    const started = Date.now();
    let response: Completion;
    try {
      response = await this.request(this.model, req, extra, this.fallbackModel ? 0 : req.maxRetries);
    } catch (err) {
      if (!(err instanceof Groq.RateLimitError) || !this.fallbackModel) throw toAiError(err, Date.now() - started);
      try {
        response = await this.request(this.fallbackModel, req, extra, req.maxRetries);
      } catch (fallbackErr) {
        throw toAiError(fallbackErr, Date.now() - started);
      }
    }

    const latencyMs = Date.now() - started;
    const usage = toUsage(response.usage);
    const finish = response.choices[0]?.finish_reason;
    if (finish === 'length') throw new AiError('INVALID_OUTPUT', 'Response was truncated', usage, latencyMs);
    return { response, usage, latencyMs };
  }

  private request(model: string, req: LlmRequest, extra: Partial<ChatParams>, maxRetries: number | undefined) {
    return this.client.chat.completions.create(
      {
        model,
        max_completion_tokens: req.maxTokens,
        ...(model.startsWith('openai/gpt-oss') ? { reasoning_effort: req.effort, include_reasoning: false } : {}),
        messages: [
          { role: 'system', content: req.system.map((b) => b.text).join('\n\n') },
          { role: 'user', content: req.user },
        ],
        ...extra,
      },
      { maxRetries },
    );
  }
}

function toUsage(u: Completion['usage']): LlmUsage {
  const cached = u?.prompt_tokens_details?.cached_tokens ?? 0;
  return {
    inputTokens: Math.max(0, (u?.prompt_tokens ?? 0) - cached),
    outputTokens: u?.completion_tokens ?? 0,
    cacheReadTokens: cached,
    cacheWriteTokens: 0,
  };
}

function toAiError(err: unknown, latencyMs: number): AiError {
  if (err instanceof AiError) return err;
  if (err instanceof Groq.RateLimitError) return new AiError('RATE_LIMITED', err.message, undefined, latencyMs);
  if (err instanceof Groq.APIConnectionTimeoutError) return new AiError('TIMEOUT', err.message, undefined, latencyMs);
  if (err instanceof Groq.AuthenticationError || err instanceof Groq.PermissionDeniedError) {
    return new AiError('AUTH', err.message, undefined, latencyMs);
  }
  if (err instanceof Groq.BadRequestError) return new AiError('BAD_REQUEST', err.message, undefined, latencyMs);
  if (err instanceof Groq.APIError) return new AiError('UNAVAILABLE', err.message, undefined, latencyMs);
  const message = err instanceof Error ? err.message : String(err);
  return new AiError('UNAVAILABLE', message, undefined, latencyMs);
}
