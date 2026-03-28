// Tipagem dos bindings do Cloudflare Worker

export type Env = {
  DB: D1Database;
  STORAGE: R2Bucket;
  CACHE: KVNamespace;
  ENVIRONMENT: string;
  JWT_SECRET: string;
  TURNSTILE_SECRET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  SENDGRID_API_KEY: string;
};

export type AppContext = {
  Bindings: Env;
  Variables: {
    requestId: string;
    tenantId?: string;
    userId?: string;
    userRole?: string;
  };
};
