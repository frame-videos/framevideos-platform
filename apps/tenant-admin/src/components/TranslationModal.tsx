// TranslationModal — reusable modal for managing translations of any content type
// Supports: category, tag, video, performer, channel, page

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { ALL_LOCALES, LOCALE_FLAGS, LOCALE_NAMES } from './TranslationBadges';

type ContentType = 'categories' | 'tags' | 'videos' | 'performers' | 'channels' | 'pages';

interface TranslationData {
  locale: string;
  title?: string;
  name?: string;
  slug?: string;
  description?: string;
  bio?: string;
  content?: string;
  seoTitle?: string;
  seoDescription?: string;
  metaDescription?: string;
}

interface TranslationModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  contentType: ContentType;
  contentId: string;
  /** Locales that already have translations */
  existingLocales: string[];
  defaultLocale?: string;
  /** Item name for display */
  itemName?: string;
}

// Fields configuration per content type
const CONTENT_FIELDS: Record<ContentType, Array<{
  key: string;
  label: string;
  type: 'text' | 'textarea';
  required?: boolean;
  placeholder?: string;
}>> = {
  categories: [
    { key: 'title', label: 'Nome', type: 'text', required: true, placeholder: 'Nome da categoria' },
    { key: 'description', label: 'Descrição', type: 'textarea', placeholder: 'Descrição da categoria' },
    { key: 'slug', label: 'Slug', type: 'text', placeholder: 'slug-localizado' },
    { key: 'seoTitle', label: 'Título SEO', type: 'text', placeholder: 'Título para mecanismos de busca' },
    { key: 'seoDescription', label: 'Descrição SEO', type: 'text', placeholder: 'Descrição para mecanismos de busca' },
  ],
  tags: [
    { key: 'title', label: 'Nome', type: 'text', required: true, placeholder: 'Nome da tag' },
    { key: 'slug', label: 'Slug', type: 'text', placeholder: 'slug-localizado' },
  ],
  videos: [
    { key: 'title', label: 'Título', type: 'text', required: true, placeholder: 'Título do vídeo' },
    { key: 'description', label: 'Descrição', type: 'textarea', placeholder: 'Descrição do vídeo' },
    { key: 'slug', label: 'Slug', type: 'text', placeholder: 'slug-localizado' },
    { key: 'seoTitle', label: 'Título SEO', type: 'text', placeholder: 'Título para mecanismos de busca' },
    { key: 'seoDescription', label: 'Descrição SEO', type: 'text', placeholder: 'Descrição para mecanismos de busca' },
  ],
  performers: [
    { key: 'title', label: 'Nome', type: 'text', required: true, placeholder: 'Nome do modelo' },
    { key: 'description', label: 'Bio', type: 'textarea', placeholder: 'Biografia do modelo' },
    { key: 'slug', label: 'Slug', type: 'text', placeholder: 'slug-localizado' },
  ],
  channels: [
    { key: 'title', label: 'Nome', type: 'text', required: true, placeholder: 'Nome do canal' },
    { key: 'description', label: 'Descrição', type: 'textarea', placeholder: 'Descrição do canal' },
    { key: 'slug', label: 'Slug', type: 'text', placeholder: 'slug-localizado' },
  ],
  pages: [
    { key: 'title', label: 'Título', type: 'text', required: true, placeholder: 'Título da página' },
    { key: 'description', label: 'Conteúdo', type: 'textarea', placeholder: 'Conteúdo da página' },
    { key: 'slug', label: 'Slug', type: 'text', placeholder: 'slug-localizado' },
    { key: 'seoTitle', label: 'Título SEO', type: 'text', placeholder: 'Título para mecanismos de busca' },
    { key: 'seoDescription', label: 'Descrição SEO', type: 'text', placeholder: 'Descrição para mecanismos de busca' },
  ],
};

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  categories: 'Categoria',
  tags: 'Tag',
  videos: 'Vídeo',
  performers: 'Modelo',
  channels: 'Canal',
  pages: 'Página',
};

export function TranslationModal({
  open,
  onClose,
  onSaved,
  contentType,
  contentId,
  existingLocales,
  defaultLocale = 'pt',
  itemName,
}: TranslationModalProps) {
  const [translations, setTranslations] = useState<TranslationData[]>([]);
  const [activeLocale, setActiveLocale] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingTranslations, setLoadingTranslations] = useState(false);

  const fields = CONTENT_FIELDS[contentType] ?? [];

  const loadTranslations = useCallback(async () => {
    if (!contentId) return;
    setLoadingTranslations(true);
    try {
      const data = await api<{ data: TranslationData[] }>(
        `/api/v1/content/${contentType}/${contentId}/translations`,
      );
      setTranslations(data.data);
    } catch (err) {
      console.error('Failed to load translations:', err);
    } finally {
      setLoadingTranslations(false);
    }
  }, [contentType, contentId]);

  // Load translations when modal opens
  useEffect(() => {
    if (open && contentId) {
      loadTranslations();
      // Set first non-default locale as active
      const nonDefault = ALL_LOCALES.filter((l) => l !== defaultLocale);
      if (nonDefault.length > 0) {
        setActiveLocale(nonDefault[0]);
      }
      setError('');
      setSuccess('');
    }
  }, [open, contentId, defaultLocale, loadTranslations]);

  // Update form when active locale changes
  useEffect(() => {
    if (!activeLocale) return;
    const existing = translations.find((t) => t.locale === activeLocale);
    if (existing) {
      setForm({
        title: existing.title ?? existing.name ?? '',
        description: existing.description ?? existing.bio ?? existing.content ?? '',
        slug: existing.slug ?? '',
        seoTitle: existing.seoTitle ?? '',
        seoDescription: existing.seoDescription ?? '',
      });
    } else {
      setForm({});
    }
  }, [activeLocale, translations]);

  const handleSave = async () => {
    if (!activeLocale || !form.title?.trim()) return;
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await api(`/api/v1/content/${contentType}/${contentId}/translations/${activeLocale}`, {
        method: 'PUT',
        body: {
          title: form.title,
          description: form.description ?? '',
          slug: form.slug ?? '',
          seoTitle: form.seoTitle ?? '',
          seoDescription: form.seoDescription ?? '',
        },
      });
      await loadTranslations();
      setSuccess('Tradução salva com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar tradução');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!activeLocale) return;
    if (!confirm(`Remover tradução em ${LOCALE_NAMES[activeLocale] ?? activeLocale}?`)) return;

    try {
      await api(`/api/v1/content/${contentType}/${contentId}/translations/${activeLocale}`, {
        method: 'DELETE',
      });
      await loadTranslations();
      setForm({});
      setSuccess('Tradução removida!');
      setTimeout(() => setSuccess(''), 3000);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover tradução');
    }
  };

  if (!open) return null;

  const inputClass =
    'w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 text-sm';
  const labelClass = 'block text-sm font-medium text-gray-300 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">🌐 Traduções — {CONTENT_TYPE_LABELS[contentType]}</h2>
            {itemName && <p className="text-sm text-gray-500 mt-0.5">{itemName}</p>}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg">✕</button>
        </div>

        {/* Feedback */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-800/50 text-red-400 text-sm">{error}</div>
        )}
        {success && (
          <div className="mb-4 p-3 rounded-lg bg-green-900/30 border border-green-800/50 text-green-400 text-sm">{success}</div>
        )}

        {loadingTranslations ? (
          <div className="py-8 text-center text-gray-500">Carregando traduções...</div>
        ) : (
          <>
            {/* Locale tabs */}
            <div className="flex gap-1.5 mb-5 flex-wrap">
              {ALL_LOCALES.filter((loc) => loc !== defaultLocale).map((loc) => {
                const hasTranslation = translations.some((t) => t.locale === loc && (t.title || t.name));
                return (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => {
                      setActiveLocale(loc);
                      setError('');
                      setSuccess('');
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                      activeLocale === loc
                        ? 'bg-purple-600 text-white'
                        : hasTranslation
                          ? 'bg-green-900/30 text-green-400 border border-green-800/50 hover:bg-green-900/40'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    <span>{LOCALE_FLAGS[loc]}</span>
                    <span className="hidden sm:inline">{LOCALE_NAMES[loc] ?? loc}</span>
                    {hasTranslation && <span className="text-xs">✓</span>}
                  </button>
                );
              })}
            </div>

            {/* Form fields */}
            {activeLocale && (
              <div className="space-y-4">
                {fields.map((field) => (
                  <div key={field.key}>
                    <label className={labelClass}>
                      {field.label} {field.required && '*'}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        value={form[field.key] ?? ''}
                        onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        rows={field.key === 'description' && contentType === 'pages' ? 8 : 3}
                        className={inputClass}
                        placeholder={`${field.placeholder} em ${LOCALE_NAMES[activeLocale] ?? activeLocale}`}
                      />
                    ) : (
                      <input
                        type="text"
                        value={form[field.key] ?? ''}
                        onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        className={inputClass}
                        placeholder={`${field.placeholder} em ${LOCALE_NAMES[activeLocale] ?? activeLocale}`}
                      />
                    )}
                  </div>
                ))}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-3 border-t border-gray-800">
                  <button
                    type="button"
                    disabled={saving || !form.title?.trim()}
                    onClick={handleSave}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors text-sm"
                  >
                    {saving ? 'Salvando...' : 'Salvar Tradução'}
                  </button>

                  {translations.some((t) => t.locale === activeLocale && (t.title || t.name)) && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors text-sm"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
