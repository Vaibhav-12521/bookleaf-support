import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import type { ApiErrorBody } from '@bookleaf/shared';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { formatIssues } from './validate';

function send(res: Response, status: number, body: ApiErrorBody) {
  res.status(status).json(body);
}

export function notFoundHandler(req: Request, res: Response) {
  send(res, 404, { error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return send(res, err.status, { error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof ZodError) {
    return send(res, 422, {
      error: { code: 'VALIDATION_ERROR', message: 'The request contains invalid fields', details: formatIssues(err) },
    });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') return send(res, 404, { error: { code: 'NOT_FOUND', message: 'Resource not found' } });
    if (err.code === 'P2002') return send(res, 409, { error: { code: 'CONFLICT', message: 'Resource already exists' } });
  }
  const bodyError = err as { type?: string; status?: number };
  if (bodyError?.type === 'entity.parse.failed') {
    return send(res, 400, { error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
  }
  if (bodyError?.type === 'entity.too.large') {
    return send(res, 413, { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } });
  }

  logger.error('Unhandled error', {
    method: req.method,
    path: req.path,
    error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
  });
  return send(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side. Please try again.' } });
}
