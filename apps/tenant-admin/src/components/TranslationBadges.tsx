// TranslationBadges — shows flag badges for translated/untranslated locales
// Reusable across all content type listings

const LOCALE_FLAGS: Record<string, string> = {
  pt: '🇧🇷',
  en: '🇺🇸',
  es: '🇪🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
  it: '🇮🇹',
  ja: '🇯🇵',
  zh: '🇨🇳',
  ko: '🇰🇷',
  ru: '🇷🇺',
  nl: '🇳🇱',
  pl: '🇵🇱',
  tr: '🇹🇷',
  ar: '🇸🇦',
};

const LOCALE_NAMES: Record<string, string> = {
  pt: 'Português',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  ja: '日本語',
  zh: '中文',
  ko: '한국어',
  ru: 'Русский',
  nl: 'Nederlands',
  pl: 'Polski',
  tr: 'Türkçe',
  ar: 'العربية',
};

export const ALL_LOCALES = ['pt', 'en', 'es', 'fr', 'de', 'it', 'ja', 'zh', 'ko', 'ru', 'nl', 'pl', 'tr', 'ar'] as const;

interface TranslationBadgesProps {
  /** Locales that have translations */
  translatedLocales: string[];
  /** Default locale (always shown as active) */
  defaultLocale?: string;
  /** Whether to show untranslated locales as faded */
  showAll?: boolean;
  /** Click handler for a locale badge */
  onLocaleClick?: (locale: string) => void;
  /** Compact mode — only show translated */
  compact?: boolean;
}

export function TranslationBadges({
  translatedLocales,
  defaultLocale = 'pt',
  showAll = false,
  onLocaleClick,
  compact = false,
}: TranslationBadgesProps) {
  const translated = new Set(translatedLocales);

  const localesToShow = showAll
    ? ALL_LOCALES
    : compact
      ? ALL_LOCALES.filter((l) => translated.has(l))
      : ALL_LOCALES;

  if (compact && localesToShow.length === 0) {
    return <span className="text-xs text-gray-600">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-0.5">
      {localesToShow.map((locale) => {
        const isTranslated = translated.has(locale);
        const isDefault = locale === defaultLocale;
        const flag = LOCALE_FLAGS[locale] ?? locale;
        const name = LOCALE_NAMES[locale] ?? locale;

        return (
          <button
            key={locale}
            type="button"
            onClick={() => onLocaleClick?.(locale)}
            disabled={!onLocaleClick}
            title={`${name}${isTranslated ? ' ✓' : ' (sem tradução)'}${isDefault ? ' — padrão' : ''}`}
            className={`text-sm leading-none transition-all ${
              onLocaleClick ? 'cursor-pointer hover:scale-110' : 'cursor-default'
            } ${
              isTranslated
                ? 'opacity-100'
                : 'opacity-25 grayscale'
            }`}
          >
            {flag}
          </button>
        );
      })}
    </div>
  );
}

export { LOCALE_FLAGS, LOCALE_NAMES };
