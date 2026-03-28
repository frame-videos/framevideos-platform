// Processamento de webhooks do Stripe
// Lida com: checkout.session.completed, subscription updates, invoices

import type { D1Client } from '@frame-videos/db';
import type { StripeWebhookEvent } from './stripe.js';
import { getSubscription } from './stripe.js';

// ─── Types internos ──────────────────────────────────────────────────────────

interface CheckoutSessionObject {
  id: string;
  customer: string;
  subscription: string | null;
  mode: string;
  payment_status: string;
  metadata: Record<string, string>;
}

interface SubscriptionObject {
  id: string;
  status: string;
  customer: string;
  current_period_start: number;
  current_period_end: number;
  cancel_at: number | null;
  cancel_at_period_end: boolean;
  metadata: Record<string, string>;
  items: {
    data: Array<{
      price: {
        id: string;
      };
    }>;
  };
}

interface InvoiceObject {
  id: string;
  subscription: string | null;
  customer: string;
  status: string;
  payment_intent: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function unixToIso(ts: number): string {
  return new Date(ts * 1000).toISOString().replace('T', ' ').replace('Z', '');
}

/**
 * Gera um ULID simples (mesmo algoritmo do shared/utils).
 */
function generateUlid(): string {
  const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const ENCODING_LEN = ENCODING.length;
  const TIME_LEN = 10;
  const RANDOM_LEN = 16;

  let now = Date.now();
  const timeChars: string[] = new Array(TIME_LEN);
  for (let i = TIME_LEN - 1; i >= 0; i--) {
    timeChars[i] = ENCODING[now % ENCODING_LEN]!;
    now = Math.floor(now / ENCODING_LEN);
  }

  const randomChars: string[] = new Array(RANDOM_LEN);
  const randomBytes = new Uint8Array(RANDOM_LEN);
  crypto.getRandomValues(randomBytes);
  for (let i = 0; i < RANDOM_LEN; i++) {
    randomChars[i] = ENCODING[randomBytes[i]! % ENCODING_LEN]!;
  }

  return timeChars.join('') + randomChars.join('');
}

// ─── Event Handlers ──────────────────────────────────────────────────────────

/**
 * checkout.session.completed
 * - Subscription: ativa a subscription no D1
 * - Payment (créditos): adiciona créditos à wallet
 */
async function handleCheckoutCompleted(
  db: D1Client,
  stripeSecretKey: string,
  session: CheckoutSessionObject,
): Promise<void> {
  const { metadata } = session;
  const tenantId = metadata?.tenantId;

  if (!tenantId) {
    console.warn('[webhook] checkout.session.completed sem tenantId no metadata');
    return;
  }

  if (session.mode === 'subscription' && session.subscription) {
    // ─── Ativar subscription ─────────────────────────────────────────
    const planSlug = metadata.planSlug;
    const planId = metadata.planId;

    if (!planSlug || !planId) {
      console.warn('[webhook] checkout subscription sem planSlug/planId');
      return;
    }

    // Buscar dados da subscription no Stripe
    const stripeSub = await getSubscription(stripeSecretKey, session.subscription);

    // Cancelar subscriptions existentes do tenant (manter só a nova)
    await db.execute(
      `UPDATE subscriptions SET status = 'cancelled' WHERE tenant_id = ? AND status IN ('active', 'trialing')`,
      [tenantId],
    );

    // Criar nova subscription no D1
    await db.execute(
      `INSERT INTO subscriptions (id, tenant_id, plan_id, status, stripe_subscription_id, current_period_start, current_period_end)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        generateUlid(),
        tenantId,
        planId,
        stripeSub.status === 'active' ? 'active' : 'trialing',
        session.subscription,
        unixToIso(stripeSub.current_period_start),
        unixToIso(stripeSub.current_period_end),
      ],
    );

    // Atualizar plano do tenant
    await db.execute(
      `UPDATE tenants SET plan_id = ?, status = 'active' WHERE id = ?`,
      [planId, tenantId],
    );

    console.log(`[webhook] Subscription ativada: tenant=${tenantId} plan=${planSlug} stripe_sub=${session.subscription}`);
  } else if (session.mode === 'payment' && metadata.type === 'credits') {
    // ─── Adicionar créditos LLM ──────────────────────────────────────
    const credits = parseInt(metadata.credits || '0', 10);

    if (credits <= 0) {
      console.warn('[webhook] checkout credits com amount inválido');
      return;
    }

    // Buscar wallet do tenant
    const wallet = await db.queryOne<{
      id: string;
      balance: number;
      total_credited: number;
    }>(
      `SELECT id, balance, total_credited FROM llm_wallets WHERE tenant_id = ?`,
      [tenantId],
    );

    if (!wallet) {
      console.warn(`[webhook] Wallet não encontrada pra tenant=${tenantId}`);
      return;
    }

    const newBalance = wallet.balance + credits;
    const newTotalCredited = wallet.total_credited + credits;

    // Atualizar wallet e criar transação em batch (atômico)
    await db.batch([
      {
        sql: `UPDATE llm_wallets SET balance = ?, total_credited = ? WHERE id = ?`,
        params: [newBalance, newTotalCredited, wallet.id],
      },
      {
        sql: `INSERT INTO llm_transactions (id, wallet_id, tenant_id, type, amount, reason, description, reference_id, balance_after)
              VALUES (?, ?, ?, 'credit', ?, 'bonus', ?, ?, ?)`,
        params: [
          generateUlid(),
          wallet.id,
          tenantId,
          credits,
          `Compra de ${credits.toLocaleString()} créditos LLM`,
          session.id,
          newBalance,
        ],
      },
    ]);

    console.log(`[webhook] Créditos adicionados: tenant=${tenantId} credits=${credits} newBalance=${newBalance}`);
  }
}

/**
 * customer.subscription.updated
 * Atualiza status da subscription no D1.
 */
async function handleSubscriptionUpdated(
  db: D1Client,
  subscription: SubscriptionObject,
): Promise<void> {
  const stripeSubId = subscription.id;

  // Mapear status do Stripe → status do D1
  let dbStatus: string;
  switch (subscription.status) {
    case 'active':
      dbStatus = 'active';
      break;
    case 'past_due':
      dbStatus = 'past_due';
      break;
    case 'canceled':
    case 'unpaid':
      dbStatus = 'cancelled';
      break;
    case 'trialing':
      dbStatus = 'trialing';
      break;
    default:
      dbStatus = 'active';
  }

  const cancelAt = subscription.cancel_at
    ? unixToIso(subscription.cancel_at)
    : null;

  await db.execute(
    `UPDATE subscriptions
     SET status = ?,
         current_period_start = ?,
         current_period_end = ?,
         cancel_at = ?
     WHERE stripe_subscription_id = ?`,
    [
      dbStatus,
      unixToIso(subscription.current_period_start),
      unixToIso(subscription.current_period_end),
      cancelAt,
      stripeSubId,
    ],
  );

  // Se cancelou, atualizar status do tenant
  if (dbStatus === 'cancelled') {
    const sub = await db.queryOne<{ tenant_id: string }>(
      `SELECT tenant_id FROM subscriptions WHERE stripe_subscription_id = ?`,
      [stripeSubId],
    );
    if (sub) {
      // Buscar plano free
      const freePlan = await db.queryOne<{ id: string }>(
        `SELECT id FROM plans WHERE slug = 'free'`,
        [],
      );
      if (freePlan) {
        await db.execute(
          `UPDATE tenants SET plan_id = ? WHERE id = ?`,
          [freePlan.id, sub.tenant_id],
        );
      }
    }
  }

  console.log(`[webhook] Subscription updated: stripe_sub=${stripeSubId} status=${dbStatus}`);
}

/**
 * customer.subscription.deleted
 * Cancela a subscription no D1.
 */
async function handleSubscriptionDeleted(
  db: D1Client,
  subscription: SubscriptionObject,
): Promise<void> {
  const stripeSubId = subscription.id;

  await db.execute(
    `UPDATE subscriptions SET status = 'cancelled' WHERE stripe_subscription_id = ?`,
    [stripeSubId],
  );

  // Voltar tenant pro plano free
  const sub = await db.queryOne<{ tenant_id: string }>(
    `SELECT tenant_id FROM subscriptions WHERE stripe_subscription_id = ?`,
    [stripeSubId],
  );

  if (sub) {
    const freePlan = await db.queryOne<{ id: string }>(
      `SELECT id FROM plans WHERE slug = 'free'`,
      [],
    );
    if (freePlan) {
      await db.execute(
        `UPDATE tenants SET plan_id = ? WHERE id = ?`,
        [freePlan.id, sub.tenant_id],
      );
    }
  }

  console.log(`[webhook] Subscription deleted: stripe_sub=${stripeSubId}`);
}

/**
 * invoice.paid — renovação bem-sucedida.
 * Atualiza período da subscription.
 */
async function handleInvoicePaid(
  db: D1Client,
  stripeSecretKey: string,
  invoice: InvoiceObject,
): Promise<void> {
  if (!invoice.subscription) return;

  // Buscar subscription atualizada no Stripe
  const stripeSub = await getSubscription(stripeSecretKey, invoice.subscription);

  await db.execute(
    `UPDATE subscriptions
     SET status = 'active',
         current_period_start = ?,
         current_period_end = ?
     WHERE stripe_subscription_id = ?`,
    [
      unixToIso(stripeSub.current_period_start),
      unixToIso(stripeSub.current_period_end),
      invoice.subscription,
    ],
  );

  console.log(`[webhook] Invoice paid: subscription=${invoice.subscription}`);
}

/**
 * invoice.payment_failed — pagamento falhou.
 * Marca subscription como past_due.
 */
async function handleInvoicePaymentFailed(
  db: D1Client,
  invoice: InvoiceObject,
): Promise<void> {
  if (!invoice.subscription) return;

  await db.execute(
    `UPDATE subscriptions SET status = 'past_due' WHERE stripe_subscription_id = ?`,
    [invoice.subscription],
  );

  console.log(`[webhook] Invoice payment failed: subscription=${invoice.subscription}`);
}

// ─── Main Handler ────────────────────────────────────────────────────────────

/**
 * Processa um evento de webhook do Stripe.
 * Retorna true se processou, false se ignorou.
 */
export async function handleWebhookEvent(
  db: D1Client,
  stripeSecretKey: string,
  event: StripeWebhookEvent,
): Promise<boolean> {
  const obj = event.data.object;

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(
        db,
        stripeSecretKey,
        obj as unknown as CheckoutSessionObject,
      );
      return true;

    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(
        db,
        obj as unknown as SubscriptionObject,
      );
      return true;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(
        db,
        obj as unknown as SubscriptionObject,
      );
      return true;

    case 'invoice.paid':
      await handleInvoicePaid(
        db,
        stripeSecretKey,
        obj as unknown as InvoiceObject,
      );
      return true;

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(
        db,
        obj as unknown as InvoiceObject,
      );
      return true;

    default:
      console.log(`[webhook] Evento ignorado: ${event.type}`);
      return false;
  }
}
