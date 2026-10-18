import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role, SessionUser } from '@bookleaf/shared';
import { env } from '../config/env';
import { forbidden, unauthorized } from '../lib/errors';
import { prisma } from '../lib/prisma';

export const SESSION_COOKIE = 'bl_session';
const JWT_ALGORITHM = 'HS256';

declare module 'express-serve-static-core' {
  interface Request {
    user?: SessionUser;
  }
}

interface TokenPayload {
  sub: string;
  role: Role;
}

export function signSession(user: { id: string; role: Role }): string {
  return jwt.sign({ role: user.role } satisfies Omit<TokenPayload, 'sub'>, env.JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    subject: user.id,
    expiresIn: `${env.JWT_TTL_HOURS}h`,
  });
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : (req.cookies?.[SESSION_COOKIE] as string | undefined);
  if (!token) throw unauthorized();

  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: [JWT_ALGORITHM] }) as TokenPayload;
  } catch {
    throw unauthorized('Your session has expired. Please sign in again.');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, role: true, author: { select: { id: true } } },
  });
  if (!user) throw unauthorized('Your session is no longer valid. Please sign in again.');

  req.user = { id: user.id, email: user.email, name: user.name, role: user.role, authorId: user.author?.id ?? null };
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };
}

export function currentUser(req: Request): SessionUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
