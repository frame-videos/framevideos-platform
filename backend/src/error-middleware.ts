/**
 * Error Handling Middleware for Hono
 * Wraps all route handlers with try-catch and error logging
 */

import { Context, HonoRequest } from 'hono';
import {
  FrameVideosError,
  ErrorCode,
  getStatusCode,
  logError,
  ErrorContext,
  createErrorResponse,
} from './error-handler';

/**
 * Extract error context from request
 */
export function extractErrorContext(c: Context): ErrorContext {
  const req = c.req;

  return {
    endpoint: req.path,
    method: req.method,
    ip: req.header('x-forwarded-for') || req.header('x-real-ip'),
    userAgent: req.header('user-agent'),
    // tenantId and userId will be added if available in the route
  };
}

/**
 * Wrap a route handler with error handling
 */
export function withErrorHandling(
  handler: (c: Context) => Promise<Response>
) {
  return async (c: Context): Promise<Response> => {
    try {
      return await handler(c);
    } catch (error: any) {
      // Handle FrameVideosError
      if (error instanceof FrameVideosError) {
        const context = extractErrorContext(c);
        logError(error, context);

        return c.json(
          createErrorResponse(
            error.code,
            error.message,
            error.statusCode,
            error.details
          ),
          error.statusCode
        );
      }

      // Handle JWT errors
      if (error.message?.includes('JWT')) {
        const context = extractErrorContext(c);
        const jwtError = new FrameVideosError(
          ErrorCode.INVALID_TOKEN,
          401,
          'Invalid or expired token'
        );
        logError(jwtError, context);

        return c.json(
          createErrorResponse(
            ErrorCode.INVALID_TOKEN,
            'Invalid or expired token',
            401
          ),
          401
        );
      }

      // Handle unknown errors
      console.error('[Unhandled Error]', error);
      const context = extractErrorContext(c);
      const unknownError = new FrameVideosError(
        ErrorCode.INTERNAL_ERROR,
        500,
        'An unexpected error occurred',
        { originalError: error.message }
      );
      logError(unknownError, context);

      return c.json(
        createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          'An unexpected error occurred',
          500
        ),
        500
      );
    }
  };
}

/**
 * Middleware to add error handling to all routes
 */
export function errorHandlingMiddleware() {
  return async (c: Context, next: () => Promise<void>) => {
    try {
      await next();
    } catch (error: any) {
      // Handle FrameVideosError
      if (error instanceof FrameVideosError) {
        const context = extractErrorContext(c);
        logError(error, context);

        return c.json(
          createErrorResponse(
            error.code,
            error.message,
            error.statusCode,
            error.details
          ),
          error.statusCode
        );
      }

      // Handle JWT errors
      if (error.message?.includes('JWT')) {
        const context = extractErrorContext(c);
        const jwtError = new FrameVideosError(
          ErrorCode.INVALID_TOKEN,
          401,
          'Invalid or expired token'
        );
        logError(jwtError, context);

        return c.json(
          createErrorResponse(
            ErrorCode.INVALID_TOKEN,
            'Invalid or expired token',
            401
          ),
          401
        );
      }

      // Handle unknown errors
      console.error('[Unhandled Error]', error);
      const context = extractErrorContext(c);
      const unknownError = new FrameVideosError(
        ErrorCode.INTERNAL_ERROR,
        500,
        'An unexpected error occurred',
        { originalError: error.message }
      );
      logError(unknownError, context);

      return c.json(
        createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          'An unexpected error occurred',
          500
        ),
        500
      );
    }
  };
}
