import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { API_URL } from '@/lib/constants';

interface PlatformConfig {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
}

const CONFIG_GROUPS: Record<string, { label: string; icon: string; keys: string[] }> = {
  crawler: {
    label: 'Crawler / Proxy',
    icon: '🕷️',
    keys: ['crawler_proxy_enabled', 'crawler_proxy_url'],
  },
};

const CONFIG_LABELS: Record<string, { label: string; type: 'text' | 'toggle' | 'url'; placeholder?: string }> = {
  crawler_proxy_enabled: { label: 'Proxy Ativado', type: 'toggle' },
  crawler_proxy_url: {
    label: 'URL do Proxy',
    type: 'url',
    placeholder: 'https://api.scraperapi.com?api_key=SUA_KEY&url={url}',
  },
};

export default function AdminConfig() {
  const [configs, setConfigs] = useState<PlatformConfig[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const getHeaders = () => {
    const token = localStorage.getItem('accessToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const loadConfigs = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/platform-config`, { headers: getHeaders() });
      const data = await res.json();
      const rows = (data.data || []) as PlatformConfig[];
      setConfigs(rows);
      const vals: Record<string, string> = {};
      rows.forEach((r) => { vals[r.key] = r.value; });
      setEditValues(vals);
    } catch {
      setError('Erro ao carregar configurações');
    }
  }, []);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const changedConfigs = configs
        .filter((c) => editValues[c.key] !== c.value)
        .map((c) => ({ key: c.key, value: editValues[c.key] ?? '' }));

      if (changedConfigs.length === 0) {
        setSaved(true);
        setSaving(false);
        return;
      }

      const res = await fetch(`${API_URL}/api/v1/admin/platform-config`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ configs: changedConfigs }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Erro ao salvar');
      }

      setSaved(true);
      await loadConfigs();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleTestProxy = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const proxyUrl = editValues['crawler_proxy_url'] || '';
      if (!proxyUrl) {
        setTestResult({ success: false, message: 'Configure a URL do proxy primeiro' });
        return;
      }

      // Test: fetch xvideos.com through the proxy from the Worker
      const res = await fetch(`${API_URL}/api/v1/admin/test-proxy`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ proxyUrl, testUrl: 'https://www.xvideos.com/' }),
      });
      const data = await res.json();
      setTestResult(data as { success: boolean; message: string });
    } catch {
      setTestResult({ success: false, message: 'Erro de rede ao testar proxy' });
    } finally {
      setTesting(false);
    }
  };

  const isProxyEnabled = editValues['crawler_proxy_enabled'] === 'true';
  const hasChanges = configs.some((c) => editValues[c.key] !== c.value);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configurações da Plataforma</h1>
          <p className="text-gray-400 mt-1">Configurações globais do Frame Videos</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          variant="primary"
        >
          {saving ? 'Salvando...' : saved ? '✅ Salvo!' : 'Salvar Alterações'}
        </Button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Crawler / Proxy Section */}
      <Card>
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🕷️</span>
            <div>
              <h2 className="text-lg font-semibold">Crawler / Proxy</h2>
              <p className="text-sm text-gray-400">
                Configure um proxy para o crawler acessar sites que bloqueiam IPs da Cloudflare
              </p>
            </div>
          </div>

          {/* Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
            <div>
              <p className="font-medium">Proxy Ativado</p>
              <p className="text-sm text-gray-400">Quando ativado, todas as requisições do crawler passam pelo proxy</p>
            </div>
            <button
              type="button"
              onClick={() => setEditValues((prev) => ({
                ...prev,
                crawler_proxy_enabled: prev['crawler_proxy_enabled'] === 'true' ? 'false' : 'true',
              }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isProxyEnabled ? 'bg-purple-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isProxyEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Proxy URL */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              URL do Proxy
            </label>
            <Input
              name="crawler_proxy_url"
              id="crawler_proxy_url"
              value={editValues['crawler_proxy_url'] || ''}
              onChange={(e) => setEditValues((prev) => ({ ...prev, crawler_proxy_url: e.target.value }))}
              placeholder="https://api.scraperapi.com?api_key=SUA_KEY&url={url}"
            />
            <p className="text-xs text-gray-500">
              Use <code className="bg-gray-700 px-1 rounded">{'{url}'}</code> como placeholder para a URL alvo.
              Compatível com: ScraperAPI, Bright Data, ScrapingBee, ou qualquer proxy HTTP.
            </p>
          </div>

          {/* Proxy providers info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 bg-gray-800/50 rounded-lg">
              <p className="font-medium text-sm">ScraperAPI</p>
              <p className="text-xs text-gray-400 mt-1">5.000 req/mês grátis</p>
              <code className="text-xs text-purple-400 block mt-1 break-all">
                https://api.scraperapi.com?api_key=KEY&url={'{url}'}
              </code>
            </div>
            <div className="p-3 bg-gray-800/50 rounded-lg">
              <p className="font-medium text-sm">ScrapingBee</p>
              <p className="text-xs text-gray-400 mt-1">1.000 req/mês grátis</p>
              <code className="text-xs text-purple-400 block mt-1 break-all">
                https://app.scrapingbee.com/api/v1?api_key=KEY&url={'{url}'}
              </code>
            </div>
            <div className="p-3 bg-gray-800/50 rounded-lg">
              <p className="font-medium text-sm">Proxy Customizado</p>
              <p className="text-xs text-gray-400 mt-1">Qualquer proxy HTTP</p>
              <code className="text-xs text-purple-400 block mt-1 break-all">
                https://seu-proxy.com/fetch?url={'{url}'}
              </code>
            </div>
          </div>

          {/* Test button */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleTestProxy}
              disabled={testing || !editValues['crawler_proxy_url']}
              variant="secondary"
            >
              {testing ? '⏳ Testando...' : '🧪 Testar Proxy'}
            </Button>
            {testResult && (
              <Badge variant={testResult.success ? 'success' : 'danger'}>
                {testResult.message}
              </Badge>
            )}
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full ${isProxyEnabled && editValues['crawler_proxy_url'] ? 'bg-green-500' : 'bg-gray-500'}`} />
            <span className="text-gray-400">
              {isProxyEnabled && editValues['crawler_proxy_url']
                ? 'Proxy configurado e ativo'
                : isProxyEnabled
                  ? 'Proxy ativado mas sem URL configurada'
                  : 'Proxy desativado — crawler usa conexão direta'}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
