import type { Request } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { isProduction } from '../config/env';

const message = (text: string) => ({ error: { code: 'RATE_LIMITED', message: text } });

const userOrIp = (req: Request) => req.user?.id ?? ipKeyGenerator(req.ip ?? '');

const skip = () => process.env.NODE_ENV === 'test';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProduction ? 10 : 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip,
  message: message('Too many sign-in attempts. Please wait a few minutes and try again.'),
});

export const ticketCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  keyGenerator: userOrIp,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip,
  message: message('You have raised a lot of tickets in the last hour. Please wait before raising another.'),
});

// Opening a ticket reads its draft, which is usually served from cache at no AI cost,
// so reads get an abuse-only ceiling; generating work (regenerate, re-triage) keeps the tight one.
export const draftReadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 300,
  keyGenerator: userOrIp,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip,
  message: message('Too many draft requests. Please wait a few minutes and try again.'),
});

export const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  keyGenerator: userOrIp,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip,
  message: message('Too many AI requests. Please wait a few minutes before regenerating again.'),
});
