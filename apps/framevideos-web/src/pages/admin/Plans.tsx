import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

interface PlanData {
  id: string;
  slug: string;
  name: string;
  price_cents: number;
  max_videos: number;
  max_domains: number;
  max_languages: number;
  llm_credits_monthly: number;
  is_active: number;
}

export function Plans() {
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<PlanData | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editMaxVideos, setEditMaxVideos] = useState('');
  const [editMaxDomains, setEditMaxDomains] = useState('');
  const [editMaxLanguages, setEditMaxLanguages] = useState('');
  const [editLlmCredits, setEditLlmCredits] = useState('');

  const getHeaders = () => {
    const token = localStorage.getItem('accessToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const loadPlans = async () => {
    try {
      const res = await fetch('/api/v1/admin/plans', { headers: getHeaders() });
      const data = await res.json();
      setPlans(data?.data ?? []);
    } catch (err) {
      console.error('Failed to load plans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPlans(); }, []);

  const openEdit = (plan: PlanData) => {
    setEditingPlan(plan);
    setEditName(plan.name);
    setEditPrice(String(plan.price_cents / 100));
    setEditMaxVideos(String(plan.max_videos));
    setEditMaxDomains(String(plan.max_domains));
    setEditMaxLanguages(String(plan.max_languages));
    setEditLlmCredits(String(plan.llm_credits_monthly));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    setSaving(true);
    try {
      await fetch(`/api/v1/admin/plans/${editingPlan.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          name: editName,
          price_cents: Math.round(parseFloat(editPrice) * 100),
          max_videos: parseInt(editMaxVideos),
          max_domains: parseInt(editMaxDomains),
          max_languages: parseInt(editMaxLanguages),
          llm_credits_monthly: parseInt(editLlmCredits),
        }),
      });
      setEditingPlan(null);
      await loadPlans();
    } catch (err) {
      console.error('Failed to save plan:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (plan: PlanData) => {
    setToggling(plan.id);
    try {
      await fetch(`/api/v1/admin/plans/${plan.id}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ is_active: !plan.is_active }),
      });
      await loadPlans();
    } catch (err) {
      console.error('Failed to toggle plan status:', err);
    } finally {
      setToggling(null);
    }
  };

  const formatPrice = (cents: number) => cents === 0 ? 'Grátis' : `$${(cents / 100).toFixed(0)}/mês`;
  const formatLimit = (n: number) => n === -1 ? 'Ilimitado' : n.toLocaleString('pt-BR');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Planos</h1>
        <p className="text-sm text-dark-400 mt-1">
          Planos de assinatura da plataforma. Edite limites e preços.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-dark-900 rounded-xl p-6 border border-dark-800 animate-pulse">
              <div className="h-6 bg-dark-800 rounded w-24 mb-3" />
              <div className="h-10 bg-dark-800 rounded w-20 mb-4" />
              <div className="space-y-2">
                <div className="h-4 bg-dark-800 rounded w-32" />
                <div className="h-4 bg-dark-800 rounded w-28" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plans.map((plan) => (
            <Card key={plan.id} hover>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                  <p className="text-2xl font-bold text-primary-400 mt-1">
                    {formatPrice(plan.price_cents)}
                  </p>
                </div>
                <Badge variant={plan.is_active ? 'success' : 'default'}>
                  {plan.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-dark-500 text-xs">Vídeos</p>
                  <p className="text-dark-200 font-medium">{formatLimit(plan.max_videos)}</p>
                </div>
                <div>
                  <p className="text-dark-500 text-xs">Domínios</p>
                  <p className="text-dark-200 font-medium">{formatLimit(plan.max_domains)}</p>
                </div>
                <div>
                  <p className="text-dark-500 text-xs">Idiomas</p>
                  <p className="text-dark-200 font-medium">{formatLimit(plan.max_languages)}</p>
                </div>
                <div>
                  <p className="text-dark-500 text-xs">Créditos IA/mês</p>
                  <p className="text-dark-200 font-medium">{plan.llm_credits_monthly}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-dark-800">
                <Button size="sm" variant="ghost" onClick={() => openEdit(plan)}>
                  ✏️ Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleToggleStatus(plan)}
                  disabled={toggling === plan.id}
                >
                  {plan.is_active ? '⏸ Desativar' : '▶ Ativar'}
                </Button>
              </div>
            </Card>
          ))}
          {plans.length === 0 && (
            <p className="text-dark-500 col-span-2 text-center py-8">Nenhum plano encontrado.</p>
          )}
        </div>
      )}

      {/* Edit Plan Modal */}
      <Modal
        isOpen={!!editingPlan}
        onClose={() => setEditingPlan(null)}
        title={`Editar Plano: ${editingPlan?.name ?? ''}`}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            id="field-planName"
            name="planName"
            label="Nome do plano"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
          />
          <Input
            id="field-planPrice"
            name="planPrice"
            label="Preço (USD/mês)"
            type="number"
            value={editPrice}
            onChange={(e) => setEditPrice(e.target.value)}
            min="0"
            step="1"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="field-maxVideos"
              name="maxVideos"
              label="Max vídeos (-1 = ilimitado)"
              type="number"
              value={editMaxVideos}
              onChange={(e) => setEditMaxVideos(e.target.value)}
            />
            <Input
              id="field-maxDomains"
              name="maxDomains"
              label="Max domínios"
              type="number"
              value={editMaxDomains}
              onChange={(e) => setEditMaxDomains(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="field-maxLanguages"
              name="maxLanguages"
              label="Max idiomas"
              type="number"
              value={editMaxLanguages}
              onChange={(e) => setEditMaxLanguages(e.target.value)}
            />
            <Input
              id="field-llmCredits"
              name="llmCredits"
              label="Créditos IA/mês"
              type="number"
              value={editLlmCredits}
              onChange={(e) => setEditLlmCredits(e.target.value)}
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" type="button" onClick={() => setEditingPlan(null)}>
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
