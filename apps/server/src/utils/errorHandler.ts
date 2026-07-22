import { ValidationException } from './validation';

/**
 * Sanitize error messages to avoid information leakage
 * Removes sensitive paths, stack traces, and other internal details
 */
export function sanitizeErrorMessage(error: unknown): string {
  const errorStr = error instanceof Error ? error.message : String(error);

  // Remove sensitive path information
  const sanitized = errorStr
    .replace(/\/Users\/[^/\s]+/g, '/***')
    .replace(/\/home\/[^/\s]+/g, '/***')
    .replace(/C:\\Users\\[^\\]+/g, 'C:\\***')
    .replace(/at\s+.*\(.*:\d+:\d+\)/g, '') // Remove stack trace lines
    .trim();

  return sanitized || 'An error occurred';
}

/**
 * Generic error handler for route handlers
 * Logs full error server-side and returns sanitized error to client
 */
export function handleRouteError(error: unknown, reply: any) {
  if (error instanceof ValidationException) {
    reply.status(400);
    return { success: false, error: error.message };
  }

  // Log full error server-side for debugging
  console.error('[ERROR]', error);

  reply.status(500);
  return { success: false, error: sanitizeErrorMessage(error) };
}
