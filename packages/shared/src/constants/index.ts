// Constantes do sistema — limites de planos, locales suportados, limites gerais

import type { PlanSlug, Locale } from '../types/enums.js';

// ─── Limites por plano ──────────────────────────────────────────────────────

export interface PlanLimitConfig {
  max_videos: number;
  max_domains: number;
  max_languages: number;
  llm_credits_monthly: number;
}

export const PLAN_LIMITS: Record<PlanSlug, PlanLimitConfig> = {
  free: {
    max_videos: 100,
    max_domains: 1,
    max_languages: 1,
    llm_credits_monthly: 50,
  },
  pro: {
    max_videos: 5_000,
    max_domains: 3,
    max_languages: 3,
    llm_credits_monthly: 500,
  },
  business: {
    max_videos: 50_000,
    max_domains: 10,
    max_languages: 10,
    llm_credits_monthly: 5_000,
  },
  enterprise: {
    max_videos: -1, // ilimitado
    max_domains: -1,
    max_languages: -1,
    llm_credits_monthly: 50_000,
  },
} as const;

// ─── Locales suportados ─────────────────────────────────────────────────────

export interface LocaleInfo {
  code: Locale;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LOCALES: LocaleInfo[] = [
  { code: 'pt_BR', name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
] as const;

// ─── Limites do sistema ─────────────────────────────────────────────────────

export const SYSTEM_LIMITS = {
  /** Tamanho máximo de upload de vídeo em bytes (5 GB) */
  MAX_UPLOAD_SIZE: 5 * 1024 * 1024 * 1024,
  /** Tamanho máximo de thumbnail em bytes (5 MB) */
  MAX_THUMBNAIL_SIZE: 5 * 1024 * 1024,
  /** Comprimento máximo do título */
  MAX_TITLE_LENGTH: 200,
  /** Comprimento máximo da descrição */
  MAX_DESCRIPTION_LENGTH: 5_000,
  /** Comprimento máximo do slug */
  MAX_SLUG_LENGTH: 150,
  /** Máximo de tags por vídeo */
  MAX_TAGS_PER_VIDEO: 30,
  /** Máximo de categorias por vídeo */
  MAX_CATEGORIES_PER_VIDEO: 5,
  /** Máximo de performers por vídeo */
  MAX_PERFORMERS_PER_VIDEO: 20,
  /** Tamanho mínimo de senha */
  MIN_PASSWORD_LENGTH: 8,
  /** Tamanho máximo de senha */
  MAX_PASSWORD_LENGTH: 128,
  /** Máximo de sessões ativas por usuário */
  MAX_SESSIONS_PER_USER: 10,
  /** Rate limit: requests por minuto (padrão) */
  DEFAULT_RATE_LIMIT_PER_MINUTE: 60,
  /** Rate limit: requests por minuto (auth) */
  AUTH_RATE_LIMIT_PER_MINUTE: 10,
} as const;

// ─── Custos de LLM (créditos por operação) ──────────────────────────────────

export const LLM_COSTS = {
  /** Tradução de um campo de texto */
  TRANSLATION: 1,
  /** Geração de SEO (title + description + keywords) */
  SEO_GENERATION: 2,
  /** Geração de descrição de vídeo */
  DESCRIPTION_GENERATION: 3,
  /** Sugestão de tags */
  TAG_SUGGESTION: 1,
  /** Moderação de conteúdo */
  CONTENT_MODERATION: 1,
} as const;
