// Credit system routes — Sprint 8
// Balance, transactions, usage, debit/check operations

import { Hono } from 'hono';
import type { AppContext } from '../env.js';
import { D1Client } from '@frame-videos/db';
import { authMiddleware } from '@frame-videos/auth';
import { generateUlid } from '@frame-videos/shared/utils';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@frame-videos/shared/errors';

const credits = new Hono<AppContext>();

// ─── Auth middleware (all routes) ────────────────────────────────────────────

credits.use('*', async (c, next) => {
  return authMiddleware(c.env.JWT_SECRET)(c, next);
});

credits.use('*', async (c, next) => {
  const role = c.get('userRole');
  if (role !== 'tenant_admin' && role !== 'super_admin') {
    throw new ForbiddenError('Apenas administradores podem acessar créditos');
  }
  await next();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function paginationParams(c: { req: { query: (k: string) => string | undefined } }, defaultLimit = 20) {
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') ?? String(defaultLimit), 10) || defaultLimit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// ─── Internal functions (exported for use by AI routes) ──────────────────────

/**
 * Get current credit balance for a tenant.
 */
export async function getBalance(db: D1Client, tenantId: string): Promise<number> {
  const wallet = await db.queryOne<{ balance: number }>(
    'SELECT balance FROM llm_wallets WHERE tenant_id = ?',
    [tenantId],
  );

  if (!wallet) {
    // Auto-create wallet with 0 balance if missing
    const walletId = generateUlid();
    await db.execute(
      'INSERT INTO llm_wallets (id, tenant_id, balance, total_credited, total_debited) VALUES (?, ?, 0, 0, 0)',
      [walletId, tenantId],
    );
    return 0;
  }

  return wallet.balance;
}

/**
 * Check if tenant has enough credits. Throws ForbiddenError if not.
 */
export async function requireCredits(db: D1Client, tenantId: string, amount: number): Promise<void> {
  const balance = await getBalance(db, tenantId);
  if (balance < amount) {
    throw new ForbiddenError(
      `Créditos insuficientes. Necessário: ${amount}, disponível: ${balance}. Adquira mais créditos para continuar.`,
    );
  }
}

/**
 * Debit credits from a tenant's wallet and log the transaction.
 */
export async function debitCredits(
  db: D1Client,
  tenantId: string,
  amount: number,
  operation: string,
  referenceId?: string,
): Promise<void> {
  // Verify balance first
  await requireCredits(db, tenantId, amount);

  const transactionId = generateUlid();

  await db.batch([
    {
      sql: 'UPDATE llm_wallets SET balance = balance - ?, total_debited = total_debited + ?, updated_at = datetime(\'now\') WHERE tenant_id = ?',
      params: [amount, amount, tenantId],
    },
    {
      sql: `INSERT INTO wallet_transactions (id, tenant_id, type, amount, description, operation_type, reference_id)
            VALUES (?, ?, 'debit', ?, ?, ?, ?)`,
      params: [transactionId, tenantId, amount, `AI: ${operation}`, operation, referenceId ?? null],
    },
  ]);
}

/**
 * Log LLM usage for a tenant.
 */
export async function logLlmUsage(
  db: D1Client,
  tenantId: string,
  operationType: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  creditsUsed: number,
  referenceId?: string,
): Promise<void> {
  const id = generateUlid();
  await db.execute(
    `INSERT INTO llm_usage_log (id, tenant_id, operation_type, model, input_tokens, output_tokens, credits_used, reference_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, tenantId, operationType, model, inputTokens, outputTokens, creditsUsed, referenceId ?? null],
  );
}

// ─── GET /credits/balance ────────────────────────────────────────────────────

credits.get('/balance', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);

  const wallet = await db.queryOne<{
    balance: number;
    total_credited: number;
    total_debited: number;
  }>(
    'SELECT balance, total_credited, total_debited FROM llm_wallets WHERE tenant_id = ?',
    [tenantId],
  );

  if (!wallet) {
    return c.json({
      balance: 0,
      totalCredited: 0,
      totalDebited: 0,
    });
  }

  return c.json({
    balance: wallet.balance,
    totalCredited: wallet.total_credited,
    totalDebited: wallet.total_debited,
  });
});

// ─── GET /credits/transactions ───────────────────────────────────────────────

credits.get('/transactions', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);
  const { page, limit, offset } = paginationParams(c);

  const countResult = await db.queryOne<{ total: number }>(
    'SELECT COUNT(*) as total FROM wallet_transactions WHERE tenant_id = ?',
    [tenantId],
  );
  const total = countResult?.total ?? 0;

  const transactions = await db.query<{
    id: string;
    type: string;
    amount: number;
    description: string;
    operation_type: string;
    reference_id: string | null;
    created_at: string;
  }>(
    `SELECT id, type, amount, description, operation_type, reference_id, created_at
     FROM wallet_transactions
     WHERE tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [tenantId, limit, offset],
  );

  return c.json({
    data: transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      description: t.description,
      operationType: t.operation_type,
      referenceId: t.reference_id,
      createdAt: t.created_at,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// ─── GET /credits/usage ──────────────────────────────────────────────────────

credits.get('/usage', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = new D1Client(c.env.DB);
  const { page, limit, offset } = paginationParams(c);

  const countResult = await db.queryOne<{ total: number }>(
    'SELECT COUNT(*) as total FROM llm_usage_log WHERE tenant_id = ?',
    [tenantId],
  );
  const total = countResult?.total ?? 0;

  const usage = await db.query<{
    id: string;
    operation_type: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    credits_used: number;
    reference_id: string | null;
    created_at: string;
  }>(
    `SELECT id, operation_type, model, input_tokens, output_tokens, credits_used, reference_id, created_at
     FROM llm_usage_log
     WHERE tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [tenantId, limit, offset],
  );

  return c.json({
    data: usage.map((u) => ({
      id: u.id,
      operationType: u.operation_type,
      model: u.model,
      inputTokens: u.input_tokens,
      outputTokens: u.output_tokens,
      creditsUsed: u.credits_used,
      referenceId: u.reference_id,
      createdAt: u.created_at,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// ─── POST /credits/check ────────────────────────────────────────────────────

credits.post('/check', async (c) => {
  const tenantId = c.get('tenantId')!;
  const body = await c.req.json();

  if (!body.amount || typeof body.amount !== 'number' || body.amount <= 0) {
    throw new ValidationError('Campo "amount" é obrigatório e deve ser positivo');
  }

  const db = new D1Client(c.env.DB);
  const balance = await getBalance(db, tenantId);

  return c.json({
    sufficient: balance >= body.amount,
    balance,
    required: body.amount,
  });
});

export { credits };
