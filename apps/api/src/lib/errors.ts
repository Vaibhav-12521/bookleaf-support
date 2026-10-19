export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const validationError = (details: unknown) =>
  new AppError(422, 'VALIDATION_ERROR', 'The request contains invalid fields', details);

export const unauthorized = (message = 'You need to sign in to do that') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'You do not have permission to do that') =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (resource: string) =>
  new AppError(404, 'NOT_FOUND', `${resource} not found`);

export const conflict = (message: string) => new AppError(409, 'CONFLICT', message);
