import { PLANS } from '@/lib/constants';
import { PlanCard } from '@/components/dashboard/PlanCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export function Plan() {
  // Mock: plano atual é Starter
  const currentPlan = 'starter';

  const currentPlanData = PLANS.find((p) => p.id === currentPlan);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Meu Plano</h1>
        <p className="text-sm text-dark-400 mt-1">
          Gerencie sua assinatura e veja os recursos disponíveis.
        </p>
      </div>

      {/* Current Plan Summary */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-semibold text-white">
                Plano {currentPlanData?.name}
              </h3>
              <Badge variant="primary">Ativo</Badge>
            </div>
            <p className="text-sm text-dark-400">
              {currentPlanData?.description}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-white">
              ${currentPlanData?.price}
              <span className="text-sm text-dark-400 font-normal">
                /{currentPlanData?.period}
              </span>
            </p>
            <p className="text-xs text-dark-500">Próxima cobrança: 28/04/2026</p>
          </div>
        </div>

        {/* Usage */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
          <div>
            <p className="text-xs text-dark-500 mb-1">Sites</p>
            <p className="text-sm font-semibold text-white">
              2 / {currentPlanData?.limits.sites}
            </p>
            <div className="mt-1 h-1.5 rounded-full bg-dark-700">
              <div
                className="h-full rounded-full bg-primary-600"
                style={{ width: `${(2 / (currentPlanData?.limits.sites || 1)) * 100}%` }}
              />
            </div>
          </div>
          <div>
            <p className="text-xs text-dark-500 mb-1">Vídeos</p>
            <p className="text-sm font-semibold text-white">
              47 / {currentPlanData?.limits.videos?.toLocaleString('pt-BR')}
            </p>
            <div className="mt-1 h-1.5 rounded-full bg-dark-700">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${(47 / (currentPlanData?.limits.videos || 1)) * 100}%` }}
              />
            </div>
          </div>
          <div>
            <p className="text-xs text-dark-500 mb-1">Armazenamento</p>
            <p className="text-sm font-semibold text-white">
              2.3 GB / {currentPlanData?.limits.storage}
            </p>
            <div className="mt-1 h-1.5 rounded-full bg-dark-700">
              <div className="h-full rounded-full bg-green-600" style={{ width: '23%' }} />
            </div>
          </div>
          <div>
            <p className="text-xs text-dark-500 mb-1">Bandwidth</p>
            <p className="text-sm font-semibold text-white">
              34 GB / {currentPlanData?.limits.bandwidth}
            </p>
            <div className="mt-1 h-1.5 rounded-full bg-dark-700">
              <div className="h-full rounded-full bg-yellow-600" style={{ width: '34%' }} />
            </div>
          </div>
        </div>
      </Card>

      {/* All Plans */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">
          Comparar Planos
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              name={plan.name}
              price={plan.price}
              period={plan.period}
              features={plan.features}
              isCurrent={plan.id === currentPlan}
              isHighlighted={plan.highlighted}
              onSelect={() => {
                // Placeholder — integração com billing
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
