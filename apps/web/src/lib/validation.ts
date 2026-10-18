import type { z } from 'zod';

export const fieldErrors = (error: z.ZodError): Record<string, string> =>
  Object.fromEntries(error.issues.map((issue) => [String(issue.path[0]), issue.message]));
