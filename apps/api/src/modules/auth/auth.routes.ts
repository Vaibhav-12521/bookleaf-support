import { Router, type CookieOptions } from 'express';
import { loginSchema } from '@bookleaf/shared';
import { env, isProduction } from '../../config/env';
import { SESSION_COOKIE, authenticate, currentUser } from '../../middleware/authenticate';
import { loginLimiter } from '../../middleware/rateLimits';
import { validateBody } from '../../middleware/validate';
import { login } from './auth.service';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isProduction,
  path: '/',
};

export const authRouter = Router();

authRouter.post('/login', loginLimiter, validateBody(loginSchema), async (req, res) => {
  const { token, user } = await login(req.body);
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: env.JWT_TTL_HOURS * 60 * 60 * 1000 });
  res.json({ user, token });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
  res.status(204).end();
});

authRouter.get('/me', authenticate, (req, res) => {
  res.json({ user: currentUser(req) });
});
