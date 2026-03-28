// Rotas de billing — Sprint 3
// Checkout, portal, subscription, créditos, webhook

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from '../env.js';
import { D1Client } from '@frame-videos/db';
import { authMiddleware } from '@frame-videos/auth';
import {
  createPlanCheckout,
  createCreditsCheckout,
  createPortalSession,
  verifyWebhookSignature,
  handleWebhookEvent,
} from '@frame-videos/billing';
import { ValidationError, NotFoundError } from '@frame-videos/shared/errors';

const billing = new Hono<AppContext>();

// ─── Schemas de validação ────────────────────────────────────────────────────

const planCheckoutSchema = z.object({
  planSlug: z.enum(['pro', 'business', 'enterprise'], {
    errorMap: () => ({
      message: 'Invalid plan. Must be pro, business, or enterprise.',
    }),
  }),
});

const creditsCheckoutSchema = z.object({
  package: z.enum(['500', '2000', '10000', '50000'], {
    errorMap: () => ({
      message: 'Invalid credit package. Must be 500, 2000, 10000, or 50000.',
    }),
  }),
});

// ─── POST /webhook — SEM auth (Stripe envia direto) ─────────────────────────

billing.post('/webhook', async (c) => {
  const signatureHeader = c.req.header('stripe-signature');

  if (!signatureHeader) {
    return c.json(
      {
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'Missing Stripe-Signature header',
        },
      },
      400,
    );
  }

  const body = await c.req.text();

  let event;
  try {
    event = await verifyWebhookSignature(
      body,
      signatureHeader,
      c.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    console.error(
      `[billing/webhook] Signature verification failed: ${message}`,
    );
    return c.json(
      { error: { code: 'INVALID_SIGNATURE', message } },
      400,
    );
  }

  const db = new D1Client(c.env.DB);

  try {
    await handleWebhookEvent(db, c.env.STRIPE_SECRET_KEY, event);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Webhook processing failed';
    console.error(`[billing/webhook] Processing error: ${message}`);
    // Retornar 200 mesmo com erro de processamento pra Stripe não re-enviar infinitamente
    // O erro é logado pra investigação
    return c.json({ received: true, error: message });
  }

  return c.json({ received: true });
});

// ─── Auth middleware — aplicado em todas as rotas ABAIXO ─────────────────────
// IMPORTANTE: webhook já foi registrado ANTES deste use(), então não é afetado

// ─── GET /plans (public, no auth) ────────────────────────────────────────────

billing.get('/plans', async (c) => {
  const db = new D1Client(c.env.DB);
  const plans = await db.query<{
    id: string; name: string; slug: string; price_cents: number;
    currency: string; max_videos: number; max_domains: number;
    max_languages: number; llm_credits_monthly: number;
    features_json: string | null; stripe_price_id: string | null;
    billing_interval: string | null;
  }>(
    'SELECT id, name, slug, price_cents, currency, max_videos, max_domains, max_languages, llm_credits_monthly, features_json, stripe_price_id, billing_interval FROM plans WHERE is_active = 1 ORDER BY price_cents ASC',
    [],
  );
  return c.json({ data: plans });
});

// Auth middleware for all other billing routes
billing.use('*', async (c, next) => {
  return authMiddleware(c.env.JWT_SECRET)(c, next);
});

// ─── POST /checkout/plan ─────────────────────────────────────────────────────

billing.post('/checkout/plan', async (c) => {
  const body = await c.req.json();
  const parsed = planCheckoutSchema.safeParse(body);

  if (!parsed.success) {
    const fieldErrors = parsed.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    throw new ValidationError('Invalid checkout data', fieldErrors);
  }

  const tenantId = c.get('tenantId');
  if (!tenantId) {
    throw new ValidationError('Tenant ID not found in session');
  }

  const db = new D1Client(c.env.DB);

  const session = await createPlanCheckout(
    db,
    c.env.STRIPE_SECRET_KEY,
    tenantId,
    parsed.data.planSlug,
    'https://framevideos.com/checkout/success?session_id={CHECKOUT_SESSION_ID}',
    'https://framevideos.com/checkout/cancel',
  );

  if (!session.url) {
    throw new Error('Failed to create checkout session URL');
  }

  return c.json({ checkoutUrl: session.url });
});

// ─── POST /checkout/credits ──────────────────────────────────────────────────

billing.post('/checkout/credits', async (c) => {
  const body = await c.req.json();
  const parsed = creditsCheckoutSchema.safeParse(body);

  if (!parsed.success) {
    const fieldErrors = parsed.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    throw new ValidationError('Invalid checkout data', fieldErrors);
  }

  const tenantId = c.get('tenantId');
  if (!tenantId) {
    throw new ValidationError('Tenant ID not found in session');
  }

  const db = new D1Client(c.env.DB);

  const session = await createCreditsCheckout(
    db,
    c.env.STRIPE_SECRET_KEY,
    tenantId,
    parsed.data.package,
    'https://framevideos.com/checkout/success?session_id={CHECKOUT_SESSION_ID}',
    'https://framevideos.com/checkout/cancel',
  );

  if (!session.url) {
    throw new Error('Failed to create checkout session URL');
  }

  return c.json({ checkoutUrl: session.url });
});

// ─── POST /portal ────────────────────────────────────────────────────────────

billing.post('/portal', async (c) => {
  const tenantId = c.get('tenantId');
  if (!tenantId) {
    throw new ValidationError('Tenant ID not found in session');
  }

  const db = new D1Client(c.env.DB);

  const session = await createPortalSession(
    db,
    c.env.STRIPE_SECRET_KEY,
    tenantId,
    'https://framevideos.com/dashboard/plan',
  );

  return c.json({ portalUrl: session.url });
});

// ─── GET /subscription ───────────────────────────────────────────────────────

billing.get('/subscription', async (c) => {
  const tenantId = c.get('tenantId');
  if (!tenantId) {
    throw new ValidationError('Tenant ID not found in session');
  }

  const db = new D1Client(c.env.DB);

  const subscription = await db.queryOne<{
    id: string;
    plan_id: string;
    status: string;
    stripe_subscription_id: string | null;
    current_period_start: string;
    current_period_end: string;
    cancel_at: string | null;
  }>(
    `SELECT s.id, s.plan_id, s.status, s.stripe_subscription_id,
            s.current_period_start, s.current_period_end, s.cancel_at
     FROM subscriptions s
     WHERE s.tenant_id = ? AND s.status IN ('active', 'trialing', 'past_due')
     ORDER BY s.created_at DESC
     LIMIT 1`,
    [tenantId],
  );

  if (!subscription) {
    throw new NotFoundError('Subscription');
  }

  // Buscar dados do plano
  const plan = await db.queryOne<{
    id: string;
    slug: string;
    name: string;
    price_cents: number;
  }>(`SELECT id, slug, name, price_cents FROM plans WHERE id = ?`, [
    subscription.plan_id,
  ]);

  return c.json({
    plan: plan
      ? {
          slug: plan.slug,
          name: plan.name,
          priceCents: plan.price_cents,
        }
      : null,
    status: subscription.status,
    currentPeriodStart: subscription.current_period_start,
    currentPeriodEnd: subscription.current_period_end,
    cancelAt: subscription.cancel_at,
    stripeSubscriptionId: subscription.stripe_subscription_id,
  });
});

// ─── GET /credits ────────────────────────────────────────────────────────────

billing.get('/credits', async (c) => {
  const tenantId = c.get('tenantId');
  if (!tenantId) {
    throw new ValidationError('Tenant ID not found in session');
  }

  const db = new D1Client(c.env.DB);

  const wallet = await db.queryOne<{
    balance: number;
    total_credited: number;
    total_debited: number;
  }>(
    `SELECT balance, total_credited, total_debited FROM llm_wallets WHERE tenant_id = ?`,
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

// ─── GET /credits/history ────────────────────────────────────────────────────

billing.get('/credits/history', async (c) => {
  const tenantId = c.get('tenantId');
  if (!tenantId) {
    throw new ValidationError('Tenant ID not found in session');
  }

  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);
  const offset = Math.max(parseInt(c.req.query('offset') || '0', 10), 0);

  const db = new D1Client(c.env.DB);

  const transactions = await db.query<{
    id: string;
    type: string;
    amount: number;
    reason: string;
    description: string | null;
    balance_after: number;
    created_at: string;
  }>(
    `SELECT t.id, t.type, t.amount, t.reason, t.description, t.balance_after, t.created_at
     FROM llm_transactions t
     WHERE t.tenant_id = ?
     ORDER BY t.created_at DESC
     LIMIT ? OFFSET ?`,
    [tenantId, limit, offset],
  );

  return c.json({
    transactions: transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      reason: t.reason,
      description: t.description,
      balanceAfter: t.balance_after,
      createdAt: t.created_at,
    })),
  });
});

export { billing };
