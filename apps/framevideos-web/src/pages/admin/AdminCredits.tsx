import { useEffect, useState, useCallback } from 'react';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { API_URL } from '@/lib/constants';

interface CreditPackage {
  id: string;
  credits: number;
  price_cents: number;
  cost_cents: number;
  is_active: number;
}

interface LlmConfig {
  id: string | null;
  markup_percent: number;
  provider: string;
  model: string;
  api_key_masked: string;
  has_api_key: boolean;
  base_url: string;
  provider_name: string;
  max_tokens: number;
  temperature: number;
  is_active: number;
}

interface ProviderPreset {
  id: string;
  name: string;
  baseUrl?: string;
  models: string[];
  defaultModel: string;
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4o-mini',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
    defaultModel: 'claude-3-5-haiku-20241022',
  },
  {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    models: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    defaultModel: 'llama-3.1-70b-versatile',
  },
  {
    id: 'together',
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1/chat/completions',
    models: ['meta-llama/Llama-3.1-70B-Instruct-Turbo', 'meta-llama/Llama-3.1-8B-Instruct-Turbo'],
    defaultModel: 'meta-llama/Llama-3.1-70B-Instruct-Turbo',
  },
  {
    id: 'mistral',
    name: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1/chat/completions',
    models: ['mistral-large-latest', 'mistral-small-latest', 'open-mixtral-8x22b'],
    defaultModel: 'mistral-large-latest',
  },
  {
    id: 'custom',
    name: 'Personalizado',
    models: [],
    defaultModel: '',
  },
];

interface TestResult {
  success: boolean;
  model?: string;
  latencyMs?: number;
  response?: string;
  error?: string;
}

interface RevenueData {
  credits: { revenueCents: number; totalCreditsSold: number };
  llmCost: { totalCostCents: number };
  margin: { marginCents: number; totalRevenueCents: number; totalCostCents: number };
}

export function AdminCredits() {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [config, setConfig] = useState<LlmConfig>({
    id: null, markup_percent: 150, provider: 'openai', model: 'gpt-4o-mini',
    api_key_masked: '', has_api_key: false, base_url: '', provider_name: '',
    max_tokens: 2048, temperature: 0.7, is_active: 0,
  });
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [editingPkg, setEditingPkg] = useState<CreditPackage | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form
  const [editCredits, setEditCredits] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editActive, setEditActive] = useState(true);

  // Config form
  const [cfgMarkup, setCfgMarkup] = useState('');
  const [cfgProvider, setCfgProvider] = useState('');
  const [cfgModel, setCfgModel] = useState('');
  const [cfgApiKey, setCfgApiKey] = useState('');
  const [cfgBaseUrl, setCfgBaseUrl] = useState('');
  const [cfgProviderName, setCfgProviderName] = useState('');
  const [cfgMaxTokens, setCfgMaxTokens] = useState('2048');
  const [cfgTemperature, setCfgTemperature] = useState('0.7');
  const [cfgIsActive, setCfgIsActive] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);

  const getHeaders = () => {
    const token = localStorage.getItem('accessToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const loadData = useCallback(async () => {
    try {
      const headers = getHeaders();
      const [pkgRes, cfgRes, revRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/admin/llm-packages`, { headers }).then(r => r.json()).catch(() => ({ data: [] })),
        fetch(`${API_URL}/api/v1/admin/llm-config`, { headers }).then(r => r.json()).catch(() => ({
          data: { id: null, markup_percent: 150, provider: 'openai', model: 'gpt-4o-mini',
            api_key_masked: '', has_api_key: false, base_url: '', provider_name: '',
            max_tokens: 2048, temperature: 0.7, is_active: 0 }
        })),
        fetch(`${API_URL}/api/v1/admin/revenue`, { headers }).then(r => r.json()).catch(() => ({ data: null })),
      ]);
      setPackages(pkgRes?.data ?? []);
      setConfig(cfgRes?.data ?? config);
      setRevenue(revRes?.data ?? null);
    } catch (err) {
      console.error('Failed to load credits data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openEditPkg = (pkg: CreditPackage) => {
    setEditingPkg(pkg);
    setEditCredits(String(pkg.credits));
    setEditPrice(String(pkg.price_cents / 100));
    setEditCost(String(pkg.cost_cents / 100));
    setEditActive(!!pkg.is_active);
  };

  const handleSavePkg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPkg) return;
    setSaving(true);
    try {
      await fetch(`${API_URL}/api/v1/admin/llm-packages/${editingPkg.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          credits: parseInt(editCredits),
          price_cents: Math.round(parseFloat(editPrice) * 100),
          cost_cents: Math.round(parseFloat(editCost) * 100),
          is_active: editActive,
        }),
      });
      setEditingPkg(null);
      await loadData();
    } catch (err) {
      console.error('Failed to save package:', err);
    } finally {
      setSaving(false);
    }
  };

  const openConfigModal = () => {
    setCfgMarkup(String(config.markup_percent));
    setCfgProvider(config.provider);
    setCfgModel(config.model);
    setCfgApiKey(config.has_api_key ? config.api_key_masked : '');
    setCfgBaseUrl(config.base_url || '');
    setCfgProviderName(config.provider_name || '');
    setCfgMaxTokens(String(config.max_tokens ?? 2048));
    setCfgTemperature(String(config.temperature ?? 0.7));
    setCfgIsActive(!!config.is_active);
    setShowApiKey(false);
    setTestResult(null);
    setShowConfigModal(true);
  };

  const handleProviderChange = (presetId: string) => {
    setCfgProvider(presetId);
    const preset = PROVIDER_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setCfgProviderName(preset.name);
      setCfgBaseUrl(preset.baseUrl ?? '');
      if (preset.defaultModel) {
        setCfgModel(preset.defaultModel);
      }
    }
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/llm-config/test`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          provider: cfgProvider,
          api_key: cfgApiKey.startsWith('••••') ? '' : cfgApiKey,
          model: cfgModel,
          base_url: cfgBaseUrl || undefined,
        }),
      });
      const data = await res.json();
      setTestResult(data as TestResult);
    } catch (err) {
      setTestResult({ success: false, error: 'Erro de rede ao testar conexão.' });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`${API_URL}/api/v1/admin/llm-config`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          markup_percent: parseInt(cfgMarkup),
          provider: cfgProvider,
          model: cfgModel,
          api_key: cfgApiKey,
          base_url: cfgBaseUrl,
          provider_name: cfgProviderName,
          max_tokens: parseInt(cfgMaxTokens) || 2048,
          temperature: parseFloat(cfgTemperature) || 0.7,
          is_active: cfgIsActive,
        }),
      });
      setShowConfigModal(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save config:', err);
    } finally {
      setSaving(false);
    }
  };

  const creditsSold = revenue?.credits?.totalCreditsSold ?? 0;
  const creditsRevenue = revenue?.credits?.revenueCents ?? 0;
  const llmCost = revenue?.llmCost?.totalCostCents ?? 0;
  const marginPct = creditsRevenue > 0 ? Math.round(((creditsRevenue - llmCost) / creditsRevenue) * 100) : 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Créditos LLM</h1>
          <p className="text-sm text-dark-400 mt-1">
            Gerencie pacotes, markup e consumo global de créditos.
          </p>
        </div>
        <Button onClick={openConfigModal}>⚙️ Config LLM</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Créditos Vendidos"
          value={creditsSold.toLocaleString('pt-BR')}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
        <StatsCard
          title="Receita Créditos"
          value={`$${(creditsRevenue / 100).toFixed(0)}`}
          iconColor="bg-green-600/20 text-green-400"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatsCard
          title="Custo LLM"
          value={`$${(llmCost / 100).toFixed(0)}`}
          iconColor="bg-red-600/20 text-red-400"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          }
        />
        <StatsCard
          title="Margem"
          value={`${marginPct}%`}
          iconColor="bg-yellow-600/20 text-yellow-400"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />
      </div>

      {/* Config Summary */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-white">Configuração LLM</h3>
          <div className="flex items-center gap-2">
            <Badge variant={config.is_active ? 'success' : 'default'}>
              {config.is_active ? '🟢 Ativo' : '⚪ Inativo'}
            </Badge>
            <Button size="sm" variant="ghost" onClick={openConfigModal}>Editar</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-dark-500 text-xs">Provedor</p>
            <p className="text-dark-200 font-medium">{config.provider_name || config.provider}</p>
          </div>
          <div>
            <p className="text-dark-500 text-xs">Modelo</p>
            <p className="text-dark-200 font-medium">{config.model}</p>
          </div>
          <div>
            <p className="text-dark-500 text-xs">API Key</p>
            <p className="text-dark-200 font-medium">{config.has_api_key ? config.api_key_masked : 'Não configurada'}</p>
          </div>
          <div>
            <p className="text-dark-500 text-xs">Markup</p>
            <p className="text-dark-200 font-medium">{config.markup_percent}%</p>
          </div>
        </div>
      </Card>

      {/* Packages */}
      <Card>
        <h3 className="text-lg font-semibold text-white mb-4">Pacotes de Créditos</h3>
        {loading ? (
          <div className="text-center py-8 text-dark-500">Carregando...</div>
        ) : packages.length === 0 ? (
          <div className="text-center py-8 text-dark-500">Nenhum pacote cadastrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 font-medium text-dark-400">Créditos</th>
                  <th className="pb-3 font-medium text-dark-400">Preço Venda</th>
                  <th className="pb-3 font-medium text-dark-400">Custo</th>
                  <th className="pb-3 font-medium text-dark-400">Markup</th>
                  <th className="pb-3 font-medium text-dark-400">Status</th>
                  <th className="pb-3 font-medium text-dark-400"></th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => {
                  const priceDollars = pkg.price_cents / 100;
                  const costDollars = pkg.cost_cents / 100;
                  const markup = costDollars > 0 ? (((priceDollars - costDollars) / costDollars) * 100).toFixed(0) : '∞';
                  return (
                    <tr key={pkg.id} className="border-b border-border/50 last:border-0">
                      <td className="py-3 font-semibold text-white">
                        {pkg.credits.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 text-dark-200">${priceDollars}</td>
                      <td className="py-3 text-dark-400">${costDollars}</td>
                      <td className="py-3">
                        <Badge variant="success">{markup}%</Badge>
                      </td>
                      <td className="py-3">
                        <Badge variant={pkg.is_active ? 'success' : 'default'}>
                          {pkg.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <Button size="sm" variant="ghost" onClick={() => openEditPkg(pkg)}>
                          Editar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Edit Package Modal */}
      <Modal
        isOpen={!!editingPkg}
        onClose={() => setEditingPkg(null)}
        title="Editar Pacote de Créditos"
      >
        <form onSubmit={handleSavePkg} className="space-y-4">
          <Input
            id="field-pkgCredits"
            name="pkgCredits"
            label="Quantidade de créditos"
            type="number"
            value={editCredits}
            onChange={(e) => setEditCredits(e.target.value)}
          />
          <Input
            id="field-pkgPrice"
            name="pkgPrice"
            label="Preço de venda (USD)"
            type="number"
            value={editPrice}
            onChange={(e) => setEditPrice(e.target.value)}
            step="0.01"
          />
          <Input
            id="field-pkgCost"
            name="pkgCost"
            label="Custo estimado (USD)"
            type="number"
            value={editCost}
            onChange={(e) => setEditCost(e.target.value)}
            step="0.01"
          />
          <div className="flex items-center gap-2">
            <input
              id="field-pkgActive"
              name="pkgActive"
              type="checkbox"
              checked={editActive}
              onChange={(e) => setEditActive(e.target.checked)}
              className="rounded border-dark-600"
            />
            <label htmlFor="field-pkgActive" className="text-sm text-dark-300">Ativo</label>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" type="button" onClick={() => setEditingPkg(null)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* LLM Config Modal */}
      <Modal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        title="Configuração LLM"
      >
        <form onSubmit={handleSaveConfig} className="space-y-5">
          {/* Provider Section */}
          <div className="border-b border-border pb-4">
            <h4 className="text-sm font-semibold text-dark-300 mb-3">Provedor LLM</h4>

            {/* Provider Dropdown */}
            <div className="mb-3">
              <label htmlFor="field-cfgProvider" className="block text-sm font-medium text-dark-300 mb-1">
                Provedor
              </label>
              <select
                id="field-cfgProvider"
                value={cfgProvider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="w-full rounded-lg border border-dark-600 bg-dark-800 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {PROVIDER_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Provider Name (editable for custom) */}
            <Input
              id="field-cfgProviderName"
              name="cfgProviderName"
              label="Nome do Provedor"
              value={cfgProviderName}
              onChange={(e) => setCfgProviderName(e.target.value)}
              placeholder="Ex: Groq, Ollama, vLLM..."
            />

            {/* Base URL — show for non-native providers */}
            {cfgProvider !== 'openai' && cfgProvider !== 'anthropic' && (
              <div className="mt-3">
                <Input
                  id="field-cfgBaseUrl"
                  name="cfgBaseUrl"
                  label="URL Base (endpoint OpenAI-compatible)"
                  value={cfgBaseUrl}
                  onChange={(e) => setCfgBaseUrl(e.target.value)}
                  placeholder="https://api.exemplo.com/v1/chat/completions"
                />
              </div>
            )}

            {/* API Key */}
            <div className="mt-3 relative">
              <Input
                id="field-cfgApiKey"
                name="cfgApiKey"
                label="API Key"
                type={showApiKey ? 'text' : 'password'}
                value={cfgApiKey}
                onChange={(e) => setCfgApiKey(e.target.value)}
                placeholder={config.has_api_key ? 'Deixe vazio para manter a atual' : 'sk-...'}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-8 text-xs text-dark-400 hover:text-dark-200"
              >
                {showApiKey ? '🙈 Esconder' : '👁️ Mostrar'}
              </button>
            </div>

            {/* Model */}
            <div className="mt-3">
              <label htmlFor="field-cfgModel" className="block text-sm font-medium text-dark-300 mb-1">
                Modelo
              </label>
              {(() => {
                const preset = PROVIDER_PRESETS.find((p) => p.id === cfgProvider);
                const models = preset?.models ?? [];
                if (models.length > 0) {
                  return (
                    <>
                      <select
                        id="field-cfgModel"
                        value={models.includes(cfgModel) ? cfgModel : '__custom__'}
                        onChange={(e) => {
                          if (e.target.value !== '__custom__') setCfgModel(e.target.value);
                        }}
                        className="w-full rounded-lg border border-dark-600 bg-dark-800 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {models.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                        <option value="__custom__">Outro (digitar)</option>
                      </select>
                      {!models.includes(cfgModel) && (
                        <Input
                          id="field-cfgModelCustom"
                          name="cfgModelCustom"
                          value={cfgModel}
                          onChange={(e) => setCfgModel(e.target.value)}
                          placeholder="Nome do modelo"
                        />
                      )}
                    </>
                  );
                }
                return (
                  <Input
                    id="field-cfgModel"
                    name="cfgModel"
                    value={cfgModel}
                    onChange={(e) => setCfgModel(e.target.value)}
                    placeholder="Nome do modelo"
                  />
                );
              })()}
            </div>

            {/* Max Tokens */}
            <div className="mt-3">
              <Input
                id="field-cfgMaxTokens"
                name="cfgMaxTokens"
                label="Max Tokens"
                type="number"
                value={cfgMaxTokens}
                onChange={(e) => setCfgMaxTokens(e.target.value)}
                placeholder="2048"
              />
            </div>

            {/* Temperature */}
            <div className="mt-3">
              <label htmlFor="field-cfgTemperature" className="block text-sm font-medium text-dark-300 mb-1">
                Temperature: {cfgTemperature}
              </label>
              <input
                id="field-cfgTemperature"
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={cfgTemperature}
                onChange={(e) => setCfgTemperature(e.target.value)}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-dark-500 mt-1">
                <span>0 (preciso)</span>
                <span>1 (balanceado)</span>
                <span>2 (criativo)</span>
              </div>
            </div>

            {/* Active Toggle */}
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCfgIsActive(!cfgIsActive)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  cfgIsActive ? 'bg-primary' : 'bg-dark-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    cfgIsActive ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <label className="text-sm text-dark-300">
                {cfgIsActive ? 'Configuração ativa (usa banco de dados)' : 'Inativo (usa variáveis de ambiente)'}
              </label>
            </div>
          </div>

          {/* Markup Section */}
          <div className="border-b border-border pb-4">
            <h4 className="text-sm font-semibold text-dark-300 mb-3">Markup & Custos</h4>
            <Input
              id="field-cfgMarkup"
              name="cfgMarkup"
              label="Markup (%)"
              type="number"
              value={cfgMarkup}
              onChange={(e) => setCfgMarkup(e.target.value)}
              placeholder="150"
            />
            <p className="text-xs text-dark-500 mt-1">
              Percentual aplicado sobre o custo real da API para calcular o preço dos créditos.
            </p>
          </div>

          {/* Test Connection */}
          <div className="border-b border-border pb-4">
            <Button
              type="button"
              variant="ghost"
              onClick={handleTestConnection}
              disabled={testing || !cfgApiKey || cfgApiKey.startsWith('••••')}
            >
              {testing ? '⏳ Testando...' : '🔌 Testar Conexão'}
            </Button>
            {testResult && (
              <div className={`mt-2 p-3 rounded-lg text-sm ${
                testResult.success
                  ? 'bg-green-900/20 border border-green-800 text-green-300'
                  : 'bg-red-900/20 border border-red-800 text-red-300'
              }`}>
                {testResult.success ? (
                  <>
                    ✅ Conectado — modelo: <strong>{testResult.model}</strong>, latência: {testResult.latencyMs}ms
                  </>
                ) : (
                  <>❌ Erro: {testResult.error}</>
                )}
              </div>
            )}
            {cfgApiKey.startsWith('••••') && (
              <p className="text-xs text-dark-500 mt-1">
                Digite uma nova API Key para testar a conexão.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowConfigModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
