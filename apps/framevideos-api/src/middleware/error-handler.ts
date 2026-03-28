// Error handler global — converte AppError em JSON response consistente

import type { Context } from 'hono';
import { AppError } from '@frame-videos/shared/errors';

/**
 * Handler de erros catch-all pra Hono.
 * Converte AppError em resposta JSON padronizada.
 * Erros não-operacionais (bugs) retornam 500 genérico.
 */
export function errorHandler(err: Error, c: Context): Response {
  const requestId = c.get('requestId') as string | undefined;

  // Erro conhecido da aplicação
  if (err instanceof AppError) {
    const body = err.toJSON() as Record<string, Record<string, unknown>>;

    // Adicionar requestId ao response
    if (requestId && body['error']) {
      body['error']['requestId'] = requestId;
    }

    return c.json(body, err.statusCode as 400 | 401 | 403 | 404 | 409 | 429 | 500);
  }

  // Erro desconhecido — log e retorna 500 com detalhes pra debug
  console.error(`[${requestId ?? 'unknown'}] Unhandled error:`, err.message, err.stack);

  return c.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: err.message,
        requestId: requestId ?? null,
      },
    },
    500,
  );
}
