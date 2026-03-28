// Tipos do módulo billing — será implementado nos próximos sprints

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
