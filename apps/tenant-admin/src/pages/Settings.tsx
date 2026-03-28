import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface SiteSettings {
  siteName: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  googleAnalyticsId: string;
  customCss: string;
  customScriptsHead: string;
  customScriptsBody: string;
}

interface LocaleSettings {
  enabledLocales: string[];
  defaultLocale: string;
  supportedLocales: string[];
  localeLabels: Record<string, string>;
}

const defaultSettings: SiteSettings = {
  siteName: '',
  logoUrl: '',
  faviconUrl: '',
  primaryColor: '#9333ea',
  secondaryColor: '#6366f1',
  googleAnalyticsId: '',
  customCss: '',
  customScriptsHead: '',
  customScriptsBody: '',
};

export function SettingsPage() {
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [localeSettings, setLocaleSettings] = useState<LocaleSettings>({
    enabledLocales: ['pt'],
    defaultLocale: 'pt',
    supportedLocales: [],
    localeLabels: {},
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingLocales, setSavingLocales] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    async function loadSettings() {
      try {
        const [data, locales] = await Promise.all([
          api<SiteSettings>('/api/v1/content/settings'),
          api<LocaleSettings>('/api/v1/content/settings/locales'),
        ]);
        setSettings({ ...defaultSettings, ...data });
        setLocaleSettings(locales);
      } catch (err) {
        // Settings may not exist yet — use defaults
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await api('/api/v1/content/settings', { method: 'PUT', body: settings });
      setSuccess('Configurações salvas com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  const inputClass =
    'w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 text-sm';
  const labelClass = 'block text-sm font-medium text-gray-300 mb-1.5';

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Configurações</h1>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-900/30 border border-red-800/50 text-red-400 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 rounded-lg bg-green-900/30 border border-green-800/50 text-green-400 text-sm">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* General */}
        <section className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold mb-4">Geral</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="field-siteName" className={labelClass}>Nome do Site *</label>
              <input
                id="field-siteName"
                name="siteName"
                type="text"
                value={settings.siteName}
                onChange={(e) => updateField('siteName', e.target.value)}
                required
                className={inputClass}
                placeholder="Meu Site de Vídeos"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="field-logoUrl" className={labelClass}>URL do Logo</label>
                <input
                  id="field-logoUrl"
                  name="logoUrl"
                  type="url"
                  value={settings.logoUrl}
                  onChange={(e) => updateField('logoUrl', e.target.value)}
                  className={inputClass}
                  placeholder="https://..."
                />
                {settings.logoUrl && (
                  <div className="mt-2 p-2 bg-gray-800 rounded-lg inline-block">
                    <img
                      src={settings.logoUrl}
                      alt="Logo preview"
                      className="h-10 object-contain"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="field-faviconUrl" className={labelClass}>URL do Favicon</label>
                <input
                  id="field-faviconUrl"
                  name="faviconUrl"
                  type="url"
                  value={settings.faviconUrl}
                  onChange={(e) => updateField('faviconUrl', e.target.value)}
                  className={inputClass}
                  placeholder="https://..."
                />
                {settings.faviconUrl && (
                  <div className="mt-2 inline-block">
                    <img
                      src={settings.faviconUrl}
                      alt="Favicon preview"
                      className="h-6 w-6 object-contain"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Colors */}
        <section className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold mb-4">Cores</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="field-primaryColor" className={labelClass}>Cor Primária</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings.primaryColor}
                  onChange={(e) => updateField('primaryColor', e.target.value)}
                  className="w-10 h-10 rounded-lg border border-gray-700 bg-transparent cursor-pointer"
                />
                <input
                  id="field-primaryColor"
                  name="primaryColor"
                  type="text"
                  value={settings.primaryColor}
                  onChange={(e) => updateField('primaryColor', e.target.value)}
                  className={inputClass}
                  placeholder="#9333ea"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
            </div>
            <div>
              <label htmlFor="field-secondaryColor" className={labelClass}>Cor Secundária</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings.secondaryColor}
                  onChange={(e) => updateField('secondaryColor', e.target.value)}
                  className="w-10 h-10 rounded-lg border border-gray-700 bg-transparent cursor-pointer"
                />
                <input
                  id="field-secondaryColor"
                  name="secondaryColor"
                  type="text"
                  value={settings.secondaryColor}
                  onChange={(e) => updateField('secondaryColor', e.target.value)}
                  className={inputClass}
                  placeholder="#6366f1"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
            </div>
          </div>
          {/* Color preview */}
          <div className="flex items-center gap-3 mt-4">
            <span className="text-xs text-gray-500">Preview:</span>
            <div
              className="h-8 w-24 rounded-lg"
              style={{ backgroundColor: settings.primaryColor }}
            />
            <div
              className="h-8 w-24 rounded-lg"
              style={{ backgroundColor: settings.secondaryColor }}
            />
          </div>
        </section>

        {/* Analytics */}
        <section className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold mb-4">Analytics</h2>
          <div>
            <label htmlFor="field-googleAnalyticsId" className={labelClass}>Google Analytics ID</label>
            <input
              id="field-googleAnalyticsId"
              name="googleAnalyticsId"
              type="text"
              value={settings.googleAnalyticsId}
              onChange={(e) => updateField('googleAnalyticsId', e.target.value)}
              className={inputClass}
              placeholder="G-XXXXXXXXXX"
            />
            <p className="mt-1.5 text-xs text-gray-500">
              ID de medição do Google Analytics 4 (formato: G-XXXXXXXXXX)
            </p>
          </div>
        </section>

        {/* Custom Code */}
        <section className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold mb-4">Código Personalizado</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="field-customCss" className={labelClass}>CSS Personalizado</label>
              <textarea
                id="field-customCss"
                name="customCss"
                value={settings.customCss}
                onChange={(e) => updateField('customCss', e.target.value)}
                rows={6}
                className={`${inputClass} font-mono text-xs leading-relaxed`}
                placeholder={`/* Estilos personalizados */\n.header {\n  background: #000;\n}`}
              />
            </div>

            <div>
              <label htmlFor="field-customScriptsHead" className={labelClass}>Scripts no &lt;head&gt;</label>
              <textarea
                id="field-customScriptsHead"
                name="customScriptsHead"
                value={settings.customScriptsHead}
                onChange={(e) => updateField('customScriptsHead', e.target.value)}
                rows={4}
                className={`${inputClass} font-mono text-xs leading-relaxed`}
                placeholder={`<!-- Scripts carregados no <head> -->\n<script src="..."></script>`}
              />
              <p className="mt-1.5 text-xs text-gray-500">
                Carregado antes do conteúdo da página. Use para meta tags, scripts de tracking, etc.
              </p>
            </div>

            <div>
              <label htmlFor="field-customScriptsBody" className={labelClass}>Scripts no &lt;body&gt;</label>
              <textarea
                id="field-customScriptsBody"
                name="customScriptsBody"
                value={settings.customScriptsBody}
                onChange={(e) => updateField('customScriptsBody', e.target.value)}
                rows={4}
                className={`${inputClass} font-mono text-xs leading-relaxed`}
                placeholder={`<!-- Scripts carregados no final do <body> -->\n<script src="..."></script>`}
              />
              <p className="mt-1.5 text-xs text-gray-500">
                Carregado após o conteúdo da página. Use para widgets, chat, etc.
              </p>
            </div>
          </div>
        </section>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </form>

      {/* i18n / Locales */}
      <section className="bg-gray-900 rounded-xl border border-gray-800 p-6 mt-8">
        <h2 className="text-lg font-semibold mb-4">🌐 Idiomas (i18n)</h2>
        <p className="text-sm text-gray-400 mb-4">
          Selecione os idiomas que deseja habilitar para o seu site. O idioma padrão será usado quando nenhum prefixo de idioma estiver na URL.
        </p>

        {localeSettings.supportedLocales.length > 0 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="field-defaultLocale" className={labelClass}>Idioma Padrão</label>
              <select
                id="field-defaultLocale"
                name="defaultLocale"
                value={localeSettings.defaultLocale}
                onChange={(e) => {
                  const newDefault = e.target.value;
                  setLocaleSettings((prev) => ({
                    ...prev,
                    defaultLocale: newDefault,
                    enabledLocales: prev.enabledLocales.includes(newDefault)
                      ? prev.enabledLocales
                      : [...prev.enabledLocales, newDefault],
                  }));
                }}
                className={inputClass}
              >
                {localeSettings.enabledLocales.map((loc) => (
                  <option key={loc} value={loc}>
                    {localeSettings.localeLabels[loc] ?? loc}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Idiomas Habilitados</label>
              <div className="flex flex-wrap gap-2 p-3 bg-gray-800 rounded-lg border border-gray-700">
                {localeSettings.supportedLocales.map((loc) => {
                  const isEnabled = localeSettings.enabledLocales.includes(loc);
                  const isDefault = localeSettings.defaultLocale === loc;
                  return (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => {
                        if (isDefault) return; // Can't disable default
                        setLocaleSettings((prev) => ({
                          ...prev,
                          enabledLocales: isEnabled
                            ? prev.enabledLocales.filter((l) => l !== loc)
                            : [...prev.enabledLocales, loc],
                        }));
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        isEnabled
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      } ${isDefault ? 'ring-2 ring-yellow-500/50' : ''}`}
                      title={isDefault ? 'Idioma padrão (não pode ser desabilitado)' : ''}
                    >
                      {localeSettings.localeLabels[loc] ?? loc}
                      {isDefault && ' ★'}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                ★ = idioma padrão. Clique para habilitar/desabilitar idiomas.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={savingLocales}
                onClick={async () => {
                  setSavingLocales(true);
                  setError('');
                  setSuccess('');
                  try {
                    await api('/api/v1/content/settings/locales', {
                      method: 'PUT',
                      body: {
                        enabledLocales: localeSettings.enabledLocales,
                        defaultLocale: localeSettings.defaultLocale,
                      },
                    });
                    setSuccess('Idiomas salvos com sucesso!');
                    setTimeout(() => setSuccess(''), 3000);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Erro ao salvar idiomas');
                  } finally {
                    setSavingLocales(false);
                  }
                }}
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
              >
                {savingLocales ? 'Salvando...' : 'Salvar Idiomas'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
