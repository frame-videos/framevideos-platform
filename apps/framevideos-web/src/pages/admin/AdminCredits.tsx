import { useEffect, useState, useCallback } from 'react';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

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
}

interface RevenueData {
  credits: { revenueCents: number; totalCreditsSold: number };
  llmCost: { totalCostCents: number };
  margin: { marginCents: number; totalRevenueCents: number; totalCostCents: number };
}

export function AdminCredits() {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [config, setConfig] = useState<LlmConfig>({ id: null, markup_percent: 150, provider: 'openai', model: 'gpt-4o-mini' });
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
        fetch('/api/v1/admin/llm-packages', { headers }).then(r => r.json()).catch(() => ({ data: [] })),
        fetch('/api/v1/admin/llm-config', { headers }).then(r => r.json()).catch(() => ({ data: { id: null, markup_percent: 150, provider: 'openai', model: 'gpt-4o-mini' } })),
        fetch('/api/v1/admin/revenue', { headers }).then(r => r.json()).catch(() => ({ data: null })),
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
      await fetch(`/api/v1/admin/llm-packages/${editingPkg.id}`, {
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
    setShowConfigModal(true);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch('/api/v1/admin/llm-config', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          markup_percent: parseInt(cfgMarkup),
          provider: cfgProvider,
          model: cfgModel,
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
          <Button size="sm" variant="ghost" onClick={openConfigModal}>Editar</Button>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-dark-500 text-xs">Markup</p>
            <p className="text-dark-200 font-medium">{config.markup_percent}%</p>
          </div>
          <div>
            <p className="text-dark-500 text-xs">Provider</p>
            <p className="text-dark-200 font-medium">{config.provider}</p>
          </div>
          <div>
            <p className="text-dark-500 text-xs">Modelo</p>
            <p className="text-dark-200 font-medium">{config.model}</p>
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
        <form onSubmit={handleSaveConfig} className="space-y-4">
          <Input
            id="field-cfgMarkup"
            name="cfgMarkup"
            label="Markup (%)"
            type="number"
            value={cfgMarkup}
            onChange={(e) => setCfgMarkup(e.target.value)}
            placeholder="150"
          />
          <Input
            id="field-cfgProvider"
            name="cfgProvider"
            label="Provider"
            value={cfgProvider}
            onChange={(e) => setCfgProvider(e.target.value)}
            placeholder="openai"
          />
          <Input
            id="field-cfgModel"
            name="cfgModel"
            label="Modelo"
            value={cfgModel}
            onChange={(e) => setCfgModel(e.target.value)}
            placeholder="gpt-4o-mini"
          />
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
