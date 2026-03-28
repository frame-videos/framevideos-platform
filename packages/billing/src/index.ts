// @frame-videos/billing — módulo de billing (Stripe)

// Stripe client wrapper (fetch-based, Workers-compatible)
export {
  createCustomer,
  getCustomer,
  createCheckoutSession,
  getCheckoutSession,
  createCustomerPortalSession,
  getSubscription,
  cancelSubscription,
  verifyWebhookSignature,
} from './stripe.js';

// Checkout logic
export {
  createPlanCheckout,
  createCreditsCheckout,
  createPortalSession,
  CREDIT_PACKAGES,
} from './checkout.js';

// Webhook handler
export { handleWebhookEvent } from './webhook.js';

// Types
export type {
  CheckoutSession,
  WebhookEvent,
  InvoiceInfo,
  SubscriptionInfo,
  CreditsBalance,
  CreditTransaction,
  CreditPackage,
} from './types.js';

export type {
  StripeCheckoutSession,
  StripeSubscription,
  StripeCustomer,
  StripePortalSession,
  StripeWebhookEvent,
} from './stripe.js';
