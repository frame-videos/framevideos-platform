// Enums do sistema — valores alinhados com o schema D1

export const UserRole = {
  SUPER_ADMIN: 'super_admin',
  TENANT_ADMIN: 'tenant_admin',
  TENANT_USER: 'tenant_user',
  ADVERTISER: 'advertiser',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const TenantStatus = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  TRIAL: 'trial',
  CANCELLED: 'cancelled',
} as const;
export type TenantStatus = (typeof TenantStatus)[keyof typeof TenantStatus];

export const VideoStatus = {
  DRAFT: 'draft',
  PROCESSING: 'processing',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const;
export type VideoStatus = (typeof VideoStatus)[keyof typeof VideoStatus];

export const DomainStatus = {
  PENDING_VERIFICATION: 'pending_verification',
  ACTIVE: 'active',
  FAILED: 'failed',
  REMOVED: 'removed',
} as const;
export type DomainStatus = (typeof DomainStatus)[keyof typeof DomainStatus];

export const SubscriptionStatus = {
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELLED: 'cancelled',
  TRIALING: 'trialing',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const PlanSlug = {
  FREE: 'free',
  PRO: 'pro',
  BUSINESS: 'business',
  ENTERPRISE: 'enterprise',
} as const;
export type PlanSlug = (typeof PlanSlug)[keyof typeof PlanSlug];

export const Locale = {
  PT_BR: 'pt_BR',
  EN: 'en',
  ES: 'es',
  DE: 'de',
  FR: 'fr',
  IT: 'it',
  JA: 'ja',
  KO: 'ko',
  ZH: 'zh',
  RU: 'ru',
} as const;
export type Locale = (typeof Locale)[keyof typeof Locale];

export const AdCampaignStatus = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;
export type AdCampaignStatus = (typeof AdCampaignStatus)[keyof typeof AdCampaignStatus];

export const AdCreativeStatus = {
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ACTIVE: 'active',
  PAUSED: 'paused',
} as const;
export type AdCreativeStatus = (typeof AdCreativeStatus)[keyof typeof AdCreativeStatus];

export const CrawlerStatus = {
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  PAUSED: 'paused',
} as const;
export type CrawlerStatus = (typeof CrawlerStatus)[keyof typeof CrawlerStatus];

export const LlmTransactionType = {
  CREDIT: 'credit',
  DEBIT: 'debit',
  REFUND: 'refund',
} as const;
export type LlmTransactionType = (typeof LlmTransactionType)[keyof typeof LlmTransactionType];

export const LlmTransactionReason = {
  PLAN_ALLOCATION: 'plan_allocation',
  TRANSLATION: 'translation',
  SEO_GENERATION: 'seo_generation',
  DESCRIPTION_GENERATION: 'description_generation',
  TAG_SUGGESTION: 'tag_suggestion',
  CONTENT_MODERATION: 'content_moderation',
  MANUAL_ADJUSTMENT: 'manual_adjustment',
  BONUS: 'bonus',
} as const;
export type LlmTransactionReason =
  (typeof LlmTransactionReason)[keyof typeof LlmTransactionReason];
