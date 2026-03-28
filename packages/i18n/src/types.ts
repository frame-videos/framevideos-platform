// Tipos do módulo i18n — será implementado nos próximos sprints

import type { Locale } from '@frame-videos/shared/types';

export interface TranslationRequest {
  sourceLocale: Locale;
  targetLocale: Locale;
  text: string;
  context?: string;
}

export interface TranslationResult {
  translatedText: string;
  sourceLocale: Locale;
  targetLocale: Locale;
  confidence?: number;
}

export interface LocaleConfig {
  locale: Locale;
  direction: 'ltr' | 'rtl';
  dateFormat: string;
  numberFormat: string;
}
