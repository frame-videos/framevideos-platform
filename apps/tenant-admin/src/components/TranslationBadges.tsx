// TranslationBadges — shows locale code badges for translated/untranslated locales
// Reusable across all content type listings
// Uses text labels instead of emoji flags for universal font compatibility

const LOCALE_LABELS: Record<string, string> = {
  pt: 'PT',
  en: 'EN',
  es: 'ES',
  fr: 'FR',
  de: 'DE',
  it: 'IT',
  ja: 'JA',
  zh: 'ZH',
  ko: 'KO',
  ru: 'RU',
  nl: 'NL',
  pl: 'PL',
  tr: 'TR',
  ar: 'AR',
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
    <div className="flex flex-wrap gap-1">
      {localesToShow.map((locale) => {
        const isTranslated = translated.has(locale);
        const isDefault = locale === defaultLocale;
        const label = LOCALE_LABELS[locale] ?? locale.toUpperCase();
        const name = LOCALE_NAMES[locale] ?? locale;

        return (
          <button
            key={locale}
            type="button"
            onClick={() => onLocaleClick?.(locale)}
            disabled={!onLocaleClick}
            title={`${name}${isTranslated ? ' ✓' : ' (sem tradução)'}${isDefault ? ' — padrão' : ''}`}
            className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold leading-none transition-all ${
              onLocaleClick ? 'cursor-pointer hover:scale-105' : 'cursor-default'
            } ${
              isTranslated
                ? isDefault
                  ? 'bg-purple-600 text-white'
                  : 'bg-green-600/80 text-white'
                : 'bg-gray-700/50 text-gray-500'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export { LOCALE_LABELS, LOCALE_NAMES };
