import { useState, useEffect, useCallback } from 'react';
import { PLANS } from '@/lib/constants';
import { PlanCard } from '@/components/dashboard/PlanCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import {
  getSubscription,
  checkoutPlan,
  openPortal,
  type SubscriptionResponse,
} from '@/api/billing';

// Mapear slug do D1 → id do frontend (slugs estão desalinhados)
// D1: pro=Starter, business=Pro, enterprise=Business
const SLUG_TO_PLAN_ID: Record<string, string> = {
  free: 'free',
  pro: 'starter',
  business: 'pro',
  enterprise: 'business',
};

const PLAN_ID_TO_SLUG: Record<string, string> = {
  free: 'free',
  starter: 'pro',
  pro: 'business',
  business: 'enterprise',
};

const STATUS_LABELS: Record<string, { label: string; variant: 'primary' | 'success' | 'warning' | 'danger' }> = {
  active: { label: 'Ativo', variant: 'success' },
  trialing: { label: 'Trial', variant: 'primary' },
  past_due: { label: 'Pagamento Pendente', variant: 'warning' },
  cancelled: { label: 'Cancelado', variant: 'danger' },
};

export function Plan() {
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSubscription();
      setSubscription(data);
    } catch (err) {
      console.error('Failed to fetch subscription:', err);
      setError('Não foi possível carregar os dados da assinatura.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const currentPlanId = subscription?.plan
    ? SLUG_TO_PLAN_ID[subscription.plan.slug] || 'free'
    : 'free';

  const currentPlanData = PLANS.find((p) => p.id === currentPlanId);

  const statusInfo = subscription
    ? STATUS_LABELS[subscription.status] || STATUS_LABELS.active
    : STATUS_LABELS.trialing;

  const handleUpgrade = async (planId: string) => {
    const planSlug = PLAN_ID_TO_SLUG[planId];
    if (!planSlug || planSlug === 'free') return;

    try {
      setCheckoutLoading(planId);
      const { checkoutUrl } = await checkoutPlan(planSlug);
      window.location.href = checkoutUrl;
    } catch (err) {
      console.error('Checkout failed:', err);
      setError('Erro ao iniciar checkout. Tente novamente.');
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setPortalLoading(true);
      const { portalUrl } = await openPortal();
      window.location.href = portalUrl;
    } catch (err) {
      console.error('Portal failed:', err);
      setError('Erro ao abrir portal de assinatura. Tente novamente.');
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Meu Plano</h1>
        <p className="text-sm text-dark-400 mt-1">
          Gerencie sua assinatura e veja os recursos disponíveis.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-600/30 bg-red-600/10 p-4">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Current Plan Summary */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-semibold text-white">
                Plano {currentPlanData?.name}
              </h3>
              <Badge variant={statusInfo!.variant}>{statusInfo!.label}</Badge>
            </div>
            <p className="text-sm text-dark-400">
              {currentPlanData?.description}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-white">
              {currentPlanData?.price === 0 ? (
                'Grátis'
              ) : (
                <>
                  ${currentPlanData?.price}
                  <span className="text-sm text-dark-400 font-normal">
                    /{currentPlanData?.period}
                  </span>
                </>
              )}
            </p>
            {subscription?.currentPeriodEnd && subscription.status !== 'cancelled' && (
              <p className="text-xs text-dark-500">
                {subscription.cancelAt
                  ? `Cancela em: ${new Date(subscription.cancelAt).toLocaleDateString('pt-BR')}`
                  : `Próxima cobrança: ${new Date(subscription.currentPeriodEnd).toLocaleDateString('pt-BR')}`}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        {subscription?.stripeSubscriptionId && (
          <div className="mt-6 pt-6 border-t border-border flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={handleManageSubscription}
              loading={portalLoading}
            >
              Gerenciar Assinatura
            </Button>
          </div>
        )}

        {/* Usage */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
          <div>
            <p className="text-xs text-dark-500 mb-1">Sites</p>
            <p className="text-sm font-semibold text-white">
              — / {currentPlanData?.limits.sites === -1 ? '∞' : currentPlanData?.limits.sites}
            </p>
          </div>
          <div>
            <p className="text-xs text-dark-500 mb-1">Vídeos</p>
            <p className="text-sm font-semibold text-white">
              — / {currentPlanData?.limits.videos === -1 ? '∞' : currentPlanData?.limits.videos?.toLocaleString('pt-BR')}
            </p>
          </div>
          <div>
            <p className="text-xs text-dark-500 mb-1">Armazenamento</p>
            <p className="text-sm font-semibold text-white">
              — / {currentPlanData?.limits.storage}
            </p>
          </div>
          <div>
            <p className="text-xs text-dark-500 mb-1">Bandwidth</p>
            <p className="text-sm font-semibold text-white">
              — / {currentPlanData?.limits.bandwidth}
            </p>
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
              isCurrent={plan.id === currentPlanId}
              isHighlighted={plan.highlighted}
              loading={checkoutLoading === plan.id}
              onSelect={() => handleUpgrade(plan.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default Plan;
