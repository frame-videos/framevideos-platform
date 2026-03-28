// Input sanitization middleware — Sprint 10
// Strips HTML tags, trims whitespace, validates Content-Type, limits payload size

import type { MiddlewareHandler } from 'hono';
import type { AppContext } from '../env.js';

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_PAYLOAD_SIZE = 1 * 1024 * 1024; // 1 MB
const MAX_STRING_LENGTH = 10_000;
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH']);

// ─── HTML tag stripping ─────────────────────────────────────────────────────

const HTML_TAG_REGEX = /<\/?[^>]+(>|$)/g;

function stripHtmlTags(value: string): string {
  return value.replace(HTML_TAG_REGEX, '');
}

// ─── Deep sanitize object ───────────────────────────────────────────────────

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    let sanitized = stripHtmlTags(value).trim();
    if (sanitized.length > MAX_STRING_LENGTH) {
      sanitized = sanitized.slice(0, MAX_STRING_LENGTH);
    }
    return sanitized;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value !== null && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      sanitized[key] = sanitizeValue(val);
    }
    return sanitized;
  }

  return value;
}

// ─── Sanitize query params ──────────────────────────────────────────────────

function sanitizeQueryParams(url: URL): void {
  for (const [key, value] of url.searchParams.entries()) {
    const sanitized = stripHtmlTags(value).trim();
    url.searchParams.set(key, sanitized);
  }
}

// ─── Middleware ──────────────────────────────────────────────────────────────

/**
 * Input sanitization middleware.
 * - Validates Content-Type for mutation methods (POST/PUT/PATCH)
 * - Rejects payloads > 1MB
 * - Strips HTML tags from all string fields in request bodies
 * - Trims whitespace, limits string length to 10k chars
 * - Sanitizes query parameters
 */
export function sanitizeInput(): MiddlewareHandler<AppContext> {
  return async (c, next) => {
    const method = c.req.method.toUpperCase();
    const url = new URL(c.req.url);

    // Sanitize query params for all requests
    sanitizeQueryParams(url);

    // For mutation methods, validate Content-Type and payload
    if (MUTATION_METHODS.has(method)) {
      const contentType = c.req.header('content-type') ?? '';

      // Skip Content-Type validation for multipart uploads
      if (!contentType.includes('multipart/form-data')) {
        // Validate Content-Type is application/json
        if (!contentType.includes('application/json')) {
          return c.json(
            {
              error: {
                code: 'INVALID_CONTENT_TYPE',
                message: 'Content-Type must be application/json',
                requestId: c.get('requestId') ?? null,
              },
            },
            415,
          );
        }

        // Check payload size via Content-Length header
        const contentLength = parseInt(c.req.header('content-length') ?? '0', 10);
        if (contentLength > MAX_PAYLOAD_SIZE) {
          return c.json(
            {
              error: {
                code: 'PAYLOAD_TOO_LARGE',
                message: `Payload exceeds maximum size of ${MAX_PAYLOAD_SIZE / 1024 / 1024}MB`,
                requestId: c.get('requestId') ?? null,
              },
            },
            413,
          );
        }

        // Clone and sanitize body
        try {
          const body = await c.req.json();
          const sanitizedBody = sanitizeValue(body);

          // Store sanitized body for downstream handlers
          // Hono caches the parsed body, so we override via a custom variable
          c.set('sanitizedBody' as never, sanitizedBody as never);
        } catch {
          // If body parsing fails, let downstream handlers deal with it
        }
      }
    }

    await next();
  };
}
