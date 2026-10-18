import Groq from 'groq-sdk';
import { describe, expect, it, vi } from 'vitest';
import { GroqProvider } from '../../src/ai/groqProvider';
import { triageOutputSchema } from '../../src/ai/prompts';
import { AiError } from '../../src/ai/provider';

const REQ = {
  system: [{ text: 'STATIC INSTRUCTIONS', cache: true }, { text: 'CATEGORY KB', cache: true }],
  user: 'TICKET',
  maxTokens: 1500,
  effort: 'low' as const,
};

function completion(content: string, overrides: Record<string, unknown> = {}) {
  return {
    model: 'openai/gpt-oss-120b',
    choices: [{ message: { content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 900, completion_tokens: 80, total_tokens: 980, prompt_tokens_details: { cached_tokens: 700 } },
    ...overrides,
  };
}

function providerReturning(result: unknown | (() => never), model = 'openai/gpt-oss-120b') {
  const provider = new GroqProvider({ apiKey: 'test', model, timeoutMs: 1000 });
  const create = vi.fn(async () => (typeof result === 'function' ? (result as () => never)() : result));
  (provider as unknown as { client: { chat: { completions: { create: typeof create } } } }).client = {
    chat: { completions: { create } },
  };
  return { provider, create };
}

const validTriage = JSON.stringify({ category: 'ISBN_METADATA', priority: 'HIGH', confidence: 0.9, reasoning: 'ISBN mismatch.' });

describe('GroqProvider', () => {
  it('sends a strict JSON schema, reasoning effort, and the stable prefix first', async () => {
    const { provider, create } = providerReturning(completion(validTriage));
    await provider.generateStructured(REQ, triageOutputSchema);

    const [params] = create.mock.calls[0] as unknown as [Record<string, any>];
    expect(params.model).toBe('openai/gpt-oss-120b');
    expect(params.reasoning_effort).toBe('low');
    expect(params.max_completion_tokens).toBe(1500);
    expect(params.response_format.json_schema.strict).toBe(true);
    expect(params.response_format.json_schema.schema.$schema).toBeUndefined();
    expect(params.response_format.json_schema.schema.additionalProperties).toBe(false);
    expect(params.messages[0]).toEqual({ role: 'system', content: 'STATIC INSTRUCTIONS\n\nCATEGORY KB' });
    expect(params.messages[1]).toEqual({ role: 'user', content: 'TICKET' });
  });

  it('parses and validates structured output, splitting cached from uncached input tokens', async () => {
    const { provider } = providerReturning(completion(validTriage));
    const result = await provider.generateStructured(REQ, triageOutputSchema);
    expect(result.value).toMatchObject({ category: 'ISBN_METADATA', priority: 'HIGH' });
    expect(result.usage).toEqual({ inputTokens: 200, cacheReadTokens: 700, outputTokens: 80, cacheWriteTokens: 0 });
  });

  it('does not send reasoning_effort to non-reasoning models', async () => {
    const { provider, create } = providerReturning(completion('Hi'), 'llama-3.3-70b-versatile');
    await provider.generateText(REQ);
    expect((create.mock.calls[0] as unknown as [Record<string, unknown>])[0]).not.toHaveProperty('reasoning_effort');
  });

  it.each([
    ['invalid JSON', completion('not json')],
    ['JSON that breaks the schema', completion(JSON.stringify({ category: 'MADE_UP', priority: 'HIGH', confidence: 1, reasoning: 'x' }))],
    ['a truncated response', completion(validTriage, { choices: [{ message: { content: validTriage }, finish_reason: 'length' }] })],
  ])('rejects %s as INVALID_OUTPUT', async (_label, response) => {
    const { provider } = providerReturning(response);
    await expect(provider.generateStructured(REQ, triageOutputSchema)).rejects.toMatchObject({ code: 'INVALID_OUTPUT' });
  });

  it('rejects an empty text reply', async () => {
    const { provider } = providerReturning(completion('   '));
    await expect(provider.generateText(REQ)).rejects.toMatchObject({ code: 'INVALID_OUTPUT' });
  });

  it('switches to the fallback model when the primary is rate-limited', async () => {
    const provider = new GroqProvider({ apiKey: 'test', model: 'openai/gpt-oss-120b', fallbackModel: 'openai/gpt-oss-20b', timeoutMs: 1000 });
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Groq.RateLimitError(429, undefined, 'slow down', new Headers()))
      .mockResolvedValueOnce(completion('Hi from the fallback', { model: 'openai/gpt-oss-20b' }));
    (provider as unknown as { client: unknown }).client = { chat: { completions: { create } } };

    const result = await provider.generateText(REQ);
    expect(result.model).toBe('openai/gpt-oss-20b');
    expect(create.mock.calls.map((c) => (c[0] as { model: string }).model)).toEqual(['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
    expect((create.mock.calls[0]![1] as { maxRetries: number }).maxRetries).toBe(0);
  });

  it('does not use the fallback for non-rate-limit errors', async () => {
    const provider = new GroqProvider({ apiKey: 'test', model: 'openai/gpt-oss-120b', fallbackModel: 'openai/gpt-oss-20b', timeoutMs: 1000 });
    const create = vi.fn().mockRejectedValue(new Groq.AuthenticationError(401, undefined, 'bad key', new Headers()));
    (provider as unknown as { client: unknown }).client = { chat: { completions: { create } } };
    await expect(provider.generateText(REQ)).rejects.toMatchObject({ code: 'AUTH' });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('reports RATE_LIMITED when both models are rate-limited', async () => {
    const provider = new GroqProvider({ apiKey: 'test', model: 'openai/gpt-oss-120b', fallbackModel: 'openai/gpt-oss-20b', timeoutMs: 1000 });
    const create = vi.fn().mockRejectedValue(new Groq.RateLimitError(429, undefined, 'slow down', new Headers()));
    (provider as unknown as { client: unknown }).client = { chat: { completions: { create } } };
    await expect(provider.generateText(REQ)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['RATE_LIMITED', () => new Groq.RateLimitError(429, undefined, 'slow down', new Headers())],
    ['AUTH', () => new Groq.AuthenticationError(401, undefined, 'bad key', new Headers())],
    ['UNAVAILABLE', () => new Groq.InternalServerError(503, undefined, 'down', new Headers())],
    ['TIMEOUT', () => new Groq.APIConnectionTimeoutError()],
  ])('maps SDK failures to %s', async (code, makeError) => {
    const { provider } = providerReturning(() => {
      throw makeError();
    });
    const err = await provider.generateText(REQ).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.code).toBe(code);
  });
});
