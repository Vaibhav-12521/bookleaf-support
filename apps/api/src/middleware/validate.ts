import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';
import { validationError } from '../lib/errors';

export function formatIssues(error: z.ZodError) {
  return error.issues.map((i) => ({ path: i.path.join('.') || '(root)', message: i.message }));
}

export function validateBody(schema: z.ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) throw validationError(formatIssues(result.error));
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) throw validationError(formatIssues(result.error));
    res.locals.query = result.data;
    next();
  };
}
