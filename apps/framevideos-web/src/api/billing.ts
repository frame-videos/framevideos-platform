// API client para billing — checkout, subscription, créditos

import { apiClient } from './client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SubscriptionResponse {
  plan: {
    slug: string;
    name: string;
    priceCents: number;
  } | null;
  status: 'active' | 'past_due' | 'cancelled' | 'trialing';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAt: string | null;
  stripeSubscriptionId: string | null;
}

export interface CreditsResponse {
  balance: number;
  totalCredited: number;
  totalDebited: number;
}

export interface CreditTransaction {
  id: string;
  type: 'credit' | 'debit' | 'refund';
  amount: number;
  reason: string;
  description: string | null;
  balanceAfter: number;
  createdAt: string;
}

export interface CreditsHistoryResponse {
  transactions: CreditTransaction[];
}

// ─── API Calls ───────────────────────────────────────────────────────────────

/**
 * Cria checkout session pra assinatura de plano.
 * Retorna URL do Stripe Checkout.
 */
export async function checkoutPlan(
  planSlug: string,
): Promise<{ checkoutUrl: string }> {
  return apiClient<{ checkoutUrl: string }>('/api/v1/billing/checkout/plan', {
    method: 'POST',
    body: { planSlug },
  });
}

/**
 * Cria checkout session pra compra de créditos LLM.
 * Retorna URL do Stripe Checkout.
 */
export async function checkoutCredits(
  packageSlug: string,
): Promise<{ checkoutUrl: string }> {
  return apiClient<{ checkoutUrl: string }>(
    '/api/v1/billing/checkout/credits',
    {
      method: 'POST',
      body: { package: packageSlug },
    },
  );
}

/**
 * Busca subscription atual do tenant.
 */
export async function getSubscription(): Promise<SubscriptionResponse> {
  return apiClient<SubscriptionResponse>('/api/v1/billing/subscription');
}

/**
 * Busca saldo de créditos LLM.
 */
export async function getCredits(): Promise<CreditsResponse> {
  return apiClient<CreditsResponse>('/api/v1/billing/credits');
}

/**
 * Busca histórico de transações de créditos LLM.
 */
export async function getCreditsHistory(
  limit = 50,
  offset = 0,
): Promise<CreditsHistoryResponse> {
  return apiClient<CreditsHistoryResponse>(
    `/api/v1/billing/credits/history?limit=${limit}&offset=${offset}`,
  );
}

/**
 * Abre o Stripe Customer Portal.
 * Retorna URL do portal.
 */
export async function openPortal(): Promise<{ portalUrl: string }> {
  return apiClient<{ portalUrl: string }>('/api/v1/billing/portal', {
    method: 'POST',
  });
}
