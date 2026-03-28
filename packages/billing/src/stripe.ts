// Stripe API client via fetch — sem SDK (Workers não suporta)
// Todas as chamadas usam a REST API do Stripe diretamente

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StripeCheckoutSession {
  id: string;
  url: string | null;
  payment_status: string;
  status: string;
  customer: string;
  subscription: string | null;
  metadata: Record<string, string>;
  mode: string;
}

export interface StripeSubscription {
  id: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  cancel_at: number | null;
  cancel_at_period_end: boolean;
  items: {
    data: Array<{
      id: string;
      price: {
        id: string;
        unit_amount: number;
        currency: string;
        recurring: { interval: string } | null;
      };
    }>;
  };
  metadata: Record<string, string>;
}

export interface StripeCustomer {
  id: string;
  email: string | null;
  name: string | null;
  metadata: Record<string, string>;
}

export interface StripePortalSession {
  id: string;
  url: string;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

export interface StripeInvoice {
  id: string;
  subscription: string | null;
  status: string;
  payment_intent: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Converte objeto pra URL-encoded form data (formato que a Stripe API espera).
 * Suporta nested objects e arrays no formato Stripe: metadata[key]=value
 */
function toFormData(obj: Record<string, unknown>, prefix = ''): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;

    const fullKey = prefix ? `${prefix}[${key}]` : key;

    if (typeof value === 'object' && !Array.isArray(value)) {
      parts.push(toFormData(value as Record<string, unknown>, fullKey));
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object') {
          parts.push(toFormData(item as Record<string, unknown>, `${fullKey}[${index}]`));
        } else {
          parts.push(`${encodeURIComponent(`${fullKey}[${index}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else {
      parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`);
    }
  }

  return parts.filter(Boolean).join('&');
}

/**
 * Faz request pra Stripe API.
 */
async function stripeRequest<T>(
  secretKey: string,
  method: string,
  endpoint: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  const config: RequestInit = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    config.body = toFormData(body);
  }

  const url = `${STRIPE_API_BASE}${endpoint}`;
  const response = await fetch(url, config);

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage = `Stripe API error: ${response.status}`;
    try {
      const parsed = JSON.parse(errorBody);
      errorMessage = parsed?.error?.message || errorMessage;
    } catch {
      // keep default message
    }
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Cria um Stripe Customer.
 */
export async function createCustomer(
  secretKey: string,
  email: string,
  name: string,
  metadata: Record<string, string> = {},
): Promise<StripeCustomer> {
  return stripeRequest<StripeCustomer>(secretKey, 'POST', '/customers', {
    email,
    name,
    metadata,
  });
}

/**
 * Busca um Stripe Customer por ID.
 */
export async function getCustomer(
  secretKey: string,
  customerId: string,
): Promise<StripeCustomer> {
  return stripeRequest<StripeCustomer>(secretKey, 'GET', `/customers/${customerId}`);
}

/**
 * Cria uma Checkout Session.
 */
export async function createCheckoutSession(
  secretKey: string,
  params: {
    customer: string;
    mode: 'subscription' | 'payment';
    lineItems: Array<{ price: string; quantity: number }>;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  },
): Promise<StripeCheckoutSession> {
  const body: Record<string, unknown> = {
    customer: params.customer,
    mode: params.mode,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    line_items: params.lineItems.map((item) => ({
      price: item.price,
      quantity: item.quantity,
    })),
  };

  if (params.metadata) {
    body.metadata = params.metadata;
  }

  // Pra subscriptions, permitir promo codes
  if (params.mode === 'subscription') {
    body.allow_promotion_codes = 'true';
  }

  return stripeRequest<StripeCheckoutSession>(
    secretKey,
    'POST',
    '/checkout/sessions',
    body,
  );
}

/**
 * Busca uma Checkout Session por ID (com expand).
 */
export async function getCheckoutSession(
  secretKey: string,
  sessionId: string,
): Promise<StripeCheckoutSession> {
  return stripeRequest<StripeCheckoutSession>(
    secretKey,
    'GET',
    `/checkout/sessions/${sessionId}`,
  );
}

/**
 * Cria uma Customer Portal Session.
 */
export async function createCustomerPortalSession(
  secretKey: string,
  customerId: string,
  returnUrl: string,
): Promise<StripePortalSession> {
  return stripeRequest<StripePortalSession>(
    secretKey,
    'POST',
    '/billing_portal/sessions',
    {
      customer: customerId,
      return_url: returnUrl,
    },
  );
}

/**
 * Busca uma Subscription por ID.
 */
export async function getSubscription(
  secretKey: string,
  subscriptionId: string,
): Promise<StripeSubscription> {
  return stripeRequest<StripeSubscription>(
    secretKey,
    'GET',
    `/subscriptions/${subscriptionId}`,
  );
}

/**
 * Cancela uma Subscription (ao final do período).
 */
export async function cancelSubscription(
  secretKey: string,
  subscriptionId: string,
): Promise<StripeSubscription> {
  return stripeRequest<StripeSubscription>(
    secretKey,
    'POST',
    `/subscriptions/${subscriptionId}`,
    {
      cancel_at_period_end: 'true',
    },
  );
}

// ─── Webhook Signature Verification ─────────────────────────────────────────

/**
 * Verifica a assinatura do webhook do Stripe usando crypto.subtle (HMAC SHA-256).
 * Implementação compatível com Cloudflare Workers.
 *
 * O Stripe usa o formato: t=timestamp,v1=signature
 * A payload assinada é: timestamp.body
 */
export async function verifyWebhookSignature(
  body: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300,
): Promise<StripeWebhookEvent> {
  // Parsear o header Stripe-Signature
  const elements = signatureHeader.split(',');
  const sigMap: Record<string, string> = {};

  for (const element of elements) {
    const [key, value] = element.split('=');
    if (key && value) {
      sigMap[key.trim()] = value.trim();
    }
  }

  const timestamp = sigMap['t'];
  const signature = sigMap['v1'];

  if (!timestamp || !signature) {
    throw new Error('Invalid Stripe webhook signature header');
  }

  // Verificar tolerância de tempo (proteção contra replay attacks)
  const timestampNum = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);

  if (Math.abs(now - timestampNum) > toleranceSeconds) {
    throw new Error('Stripe webhook timestamp too old');
  }

  // Calcular expected signature: HMAC-SHA256(secret, timestamp.body)
  const signedPayload = `${timestamp}.${body}`;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(signedPayload);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Comparação timing-safe (constant-time)
  if (!timingSafeEqual(expectedSignature, signature)) {
    throw new Error('Invalid Stripe webhook signature');
  }

  // Signature válida — parsear o body
  return JSON.parse(body) as StripeWebhookEvent;
}

/**
 * Comparação timing-safe de duas strings.
 * Evita timing attacks na verificação de signature.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
