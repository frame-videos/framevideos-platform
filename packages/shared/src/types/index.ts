// Tipos principais do sistema — alinhados com o schema D1
// Re-export dos enums
export * from './enums.js';

import type {
  UserRole,
  TenantStatus,
  VideoStatus,
  DomainStatus,
  SubscriptionStatus,
  PlanSlug,
  Locale,
  AdCampaignStatus,
  AdCreativeStatus,
  CrawlerStatus,
  LlmTransactionType,
  LlmTransactionReason,
} from './enums.js';

// ─── Core ────────────────────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  plan_id: string;
  owner_user_id: string;
  default_locale: Locale;
  created_at: string;
  updated_at: string;
}

export interface TenantConfig {
  id: string;
  tenant_id: string;
  config_key: string;
  config_value: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  email_verified_at: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  tenant_id: string;
  refresh_token_hash: string;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: string;
  created_at: string;
}

export interface Domain {
  id: string;
  tenant_id: string;
  domain: string;
  status: DomainStatus;
  is_primary: boolean;
  ssl_status: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Content ─────────────────────────────────────────────────────────────────

export interface Video {
  id: string;
  tenant_id: string;
  slug: string;
  status: VideoStatus;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  video_url: string | null;
  embed_url: string | null;
  source_url: string | null;
  view_count: number;
  like_count: number;
  is_featured: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VideoTranslation {
  id: string;
  video_id: string;
  locale: Locale;
  title: string;
  description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  tenant_id: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryTranslation {
  id: string;
  category_id: string;
  locale: Locale;
  name: string;
  description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  tenant_id: string;
  slug: string;
  created_at: string;
}

export interface TagTranslation {
  id: string;
  tag_id: string;
  locale: Locale;
  name: string;
  created_at: string;
}

export interface Performer {
  id: string;
  tenant_id: string;
  slug: string;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PerformerTranslation {
  id: string;
  performer_id: string;
  locale: Locale;
  name: string;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface Channel {
  id: string;
  tenant_id: string;
  slug: string;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChannelTranslation {
  id: string;
  channel_id: string;
  locale: Locale;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Page {
  id: string;
  tenant_id: string;
  slug: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface PageTranslation {
  id: string;
  page_id: string;
  locale: Locale;
  title: string;
  content: string;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Billing ─────────────────────────────────────────────────────────────────

export interface Plan {
  id: string;
  slug: PlanSlug;
  name: string;
  price_cents: number;
  currency: string;
  max_videos: number;
  max_domains: number;
  max_languages: number;
  llm_credits_monthly: number;
  features_json: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  stripe_subscription_id: string | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LlmWallet {
  id: string;
  tenant_id: string;
  balance: number;
  total_credited: number;
  total_debited: number;
  created_at: string;
  updated_at: string;
}

export interface LlmTransaction {
  id: string;
  wallet_id: string;
  tenant_id: string;
  type: LlmTransactionType;
  amount: number;
  reason: LlmTransactionReason;
  description: string | null;
  reference_id: string | null;
  balance_after: number;
  created_at: string;
}

// ─── Ads ─────────────────────────────────────────────────────────────────────

export interface AdCampaign {
  id: string;
  tenant_id: string;
  advertiser_id: string;
  name: string;
  status: AdCampaignStatus;
  budget_cents: number;
  spent_cents: number;
  start_date: string;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdCreative {
  id: string;
  campaign_id: string;
  tenant_id: string;
  name: string;
  status: AdCreativeStatus;
  creative_type: string;
  content_url: string;
  target_url: string;
  impressions: number;
  clicks: number;
  created_at: string;
  updated_at: string;
}

// ─── Crawler ─────────────────────────────────────────────────────────────────

export interface CrawlerSource {
  id: string;
  tenant_id: string;
  name: string;
  base_url: string;
  crawler_type: string;
  config_json: string;
  is_active: boolean;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrawlerRun {
  id: string;
  source_id: string;
  tenant_id: string;
  status: CrawlerStatus;
  videos_found: number;
  videos_imported: number;
  errors_count: number;
  started_at: string;
  completed_at: string | null;
  log_json: string | null;
  created_at: string;
}

// ─── Audit ───────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  tenant_id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details_json: string | null;
  ip_address: string | null;
  created_at: string;
}
