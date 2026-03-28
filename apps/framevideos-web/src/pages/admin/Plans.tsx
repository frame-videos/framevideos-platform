import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

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

  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem('accessToken');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/api/v1/admin/plans', { headers });
        const data = await res.json();
        setPlans(data?.data ?? []);
      } catch (err) {
        console.error('Failed to load plans:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const formatPrice = (cents: number) => cents === 0 ? 'Grátis' : `$${(cents / 100).toFixed(0)}/mês`;
  const formatLimit = (n: number) => n === -1 ? 'Ilimitado' : n.toLocaleString('pt-BR');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Planos</h1>
        <p className="text-sm text-dark-400 mt-1">
          Planos de assinatura da plataforma.
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
            </Card>
          ))}
          {plans.length === 0 && (
            <p className="text-dark-500 col-span-2 text-center py-8">Nenhum plano encontrado.</p>
          )}
        </div>
      )}
    </div>
  );
}
