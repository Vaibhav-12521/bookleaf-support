import { z } from 'zod';

const optionalSecret = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_TTL_HOURS: z.coerce.number().int().positive().default(12),
  CORS_ORIGIN: z.string().optional().transform((v) => (v?.trim() ? v.trim() : undefined)),
  AI_PROVIDER: z.enum(['groq', 'anthropic']).default('groq'),
  GROQ_API_KEY: optionalSecret,
  ANTHROPIC_API_KEY: optionalSecret,
  AI_MODEL: z.string().optional().transform((v) => (v?.trim() ? v.trim() : undefined)),
  AI_FALLBACK_MODEL: z.string().optional().transform((v) => (v?.trim() ? v.trim() : undefined)),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),
});

const DEFAULT_MODELS = { groq: 'openai/gpt-oss-120b', anthropic: 'claude-haiku-5-5' } as const;

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = {
  ...parsed.data,
  AI_MODEL: parsed.data.AI_MODEL ?? DEFAULT_MODELS[parsed.data.AI_PROVIDER],
  AI_FALLBACK_MODEL:
    parsed.data.AI_FALLBACK_MODEL === 'none' ? undefined : (parsed.data.AI_FALLBACK_MODEL ?? 'openai/gpt-oss-20b'),
};
export const isProduction = env.NODE_ENV === 'production';
