// Tipos do módulo billing

export interface CheckoutSession {
  id: string;
  tenantId: string;
  planId: string;
  stripeSessionId: string;
  url: string;
}

export interface WebhookEvent {
  type: string;
  data: Record<string, unknown>;
}

export interface InvoiceInfo {
  id: string;
  tenantId: string;
  amountCents: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  pdfUrl?: string;
}

export interface SubscriptionInfo {
  planSlug: string;
  planName: string;
  status: 'active' | 'past_due' | 'cancelled' | 'trialing';
  currentPeriodEnd: string;
  cancelAt: string | null;
  stripeSubscriptionId: string | null;
}

export interface CreditsBalance {
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

export interface CreditPackage {
  slug: string;
  credits: number;
  priceUsd: number;
  priceId: string;
}
