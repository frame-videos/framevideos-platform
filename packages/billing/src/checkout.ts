// Lógica de checkout — cria sessions do Stripe pra planos e créditos

import type { D1Client } from '@frame-videos/db';
import {
  createCustomer,
  createCheckoutSession,
  createCustomerPortalSession,
  type StripeCheckoutSession,
  type StripePortalSession,
} from './stripe.js';

// ─── Mapeamento de pacotes de créditos → Stripe Price IDs ────────────────────

const CREDIT_PACKAGES: Record<
  string,
  { priceId: string; credits: number; amountCents: number }
> = {
  '500': {
    priceId: 'price_1TFn0oQUoH3HjIlrKe0eAUEi',
    credits: 500,
    amountCents: 500,
  },
  '2000': {
    priceId: 'price_1TFn0pQUoH3HjIlrRlno5ePu',
    credits: 2000,
    amountCents: 1500,
  },
  '10000': {
    priceId: 'price_1TFn0pQUoH3HjIlrbxAVih1A',
    credits: 10000,
    amountCents: 5000,
  },
  '50000': {
    priceId: 'price_1TFn0qQUoH3HjIlrhApM5wZ9',
    credits: 50000,
    amountCents: 15000,
  },
};

export { CREDIT_PACKAGES };

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Busca ou cria Stripe Customer pro tenant.
 * Salva stripe_customer_id na tabela tenants.
 */
async function getOrCreateStripeCustomer(
  db: D1Client,
  stripeSecretKey: string,
  tenantId: string,
): Promise<string> {
  // Buscar tenant com stripe_customer_id
  const tenant = await db.queryOne<{
    id: string;
    name: string;
    stripe_customer_id: string | null;
  }>(
    `SELECT t.id, t.name, t.stripe_customer_id
     FROM tenants t WHERE t.id = ?`,
    [tenantId],
  );

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  // Se já tem customer, retorna
  if (tenant.stripe_customer_id) {
    return tenant.stripe_customer_id;
  }

  // Buscar email do owner
  const owner = await db.queryOne<{ email: string; name: string }>(
    `SELECT email, name FROM users WHERE tenant_id = ? AND role = 'tenant_admin' LIMIT 1`,
    [tenantId],
  );

  if (!owner) {
    throw new Error('Tenant owner not found');
  }

  // Criar customer no Stripe
  const customer = await createCustomer(
    stripeSecretKey,
    owner.email,
    owner.name,
    { tenantId },
  );

  // Salvar no D1
  await db.execute(
    `UPDATE tenants SET stripe_customer_id = ? WHERE id = ?`,
    [customer.id, tenantId],
  );

  return customer.id;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Cria checkout session pra assinatura de plano.
 */
export async function createPlanCheckout(
  db: D1Client,
  stripeSecretKey: string,
  tenantId: string,
  planSlug: string,
  successUrl: string,
  cancelUrl: string,
): Promise<StripeCheckoutSession> {
  // Buscar plano no D1
  const plan = await db.queryOne<{
    id: string;
    slug: string;
    name: string;
    stripe_price_id: string | null;
  }>(`SELECT id, slug, name, stripe_price_id FROM plans WHERE slug = ?`, [
    planSlug,
  ]);

  if (!plan) {
    throw new Error(`Plan '${planSlug}' not found`);
  }

  if (!plan.stripe_price_id) {
    throw new Error(`Plan '${planSlug}' has no Stripe price configured`);
  }

  // Buscar ou criar customer
  const customerId = await getOrCreateStripeCustomer(
    db,
    stripeSecretKey,
    tenantId,
  );

  // Criar checkout session
  return createCheckoutSession(stripeSecretKey, {
    customer: customerId,
    mode: 'subscription',
    lineItems: [{ price: plan.stripe_price_id, quantity: 1 }],
    successUrl,
    cancelUrl,
    metadata: {
      tenantId,
      planSlug: plan.slug,
      planId: plan.id,
      type: 'plan',
    },
  });
}

/**
 * Cria checkout session pra compra de créditos LLM.
 */
export async function createCreditsCheckout(
  db: D1Client,
  stripeSecretKey: string,
  tenantId: string,
  packageSlug: string,
  successUrl: string,
  cancelUrl: string,
): Promise<StripeCheckoutSession> {
  const pkg = CREDIT_PACKAGES[packageSlug];

  if (!pkg) {
    throw new Error(
      `Credit package '${packageSlug}' not found. Valid: ${Object.keys(CREDIT_PACKAGES).join(', ')}`,
    );
  }

  // Buscar ou criar customer
  const customerId = await getOrCreateStripeCustomer(
    db,
    stripeSecretKey,
    tenantId,
  );

  // Criar checkout session (one-time payment)
  return createCheckoutSession(stripeSecretKey, {
    customer: customerId,
    mode: 'payment',
    lineItems: [{ price: pkg.priceId, quantity: 1 }],
    successUrl,
    cancelUrl,
    metadata: {
      tenantId,
      credits: String(pkg.credits),
      packageSlug,
      type: 'credits',
    },
  });
}

/**
 * Cria portal session pra gerenciar assinatura.
 */
export async function createPortalSession(
  db: D1Client,
  stripeSecretKey: string,
  tenantId: string,
  returnUrl: string,
): Promise<StripePortalSession> {
  const customerId = await getOrCreateStripeCustomer(
    db,
    stripeSecretKey,
    tenantId,
  );

  return createCustomerPortalSession(stripeSecretKey, customerId, returnUrl);
}
