import { useState, useEffect, useCallback } from 'react';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import {
  getCredits,
  getCreditsHistory,
  checkoutCredits,
  type CreditsResponse,
  type CreditTransaction,
} from '@/api/billing';

// Pacotes de créditos alinhados com os Stripe Price IDs reais
const creditPackages = [
  { slug: '500', credits: 500, price: 5, popular: false },
  { slug: '2000', credits: 2000, price: 15, popular: true },
  { slug: '10000', credits: 10000, price: 50, popular: false },
  { slug: '50000', credits: 50000, price: 150, popular: false },
];

const REASON_LABELS: Record<string, string> = {
  plan_allocation: 'Créditos do plano',
  translation: 'Tradução automática',
  seo_generation: 'Geração de SEO',
  description_generation: 'Geração de descrições',
  tag_suggestion: 'Sugestão de tags',
  content_moderation: 'Moderação de conteúdo',
  manual_adjustment: 'Ajuste manual',
  bonus: 'Compra de créditos',
};

export function Credits() {
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [credits, setCredits] = useState<CreditsResponse | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [creditsData, historyData] = await Promise.all([
        getCredits(),
        getCreditsHistory(),
      ]);
      setCredits(creditsData);
      setTransactions(historyData.transactions);
    } catch (err) {
      console.error('Failed to fetch credits:', err);
      setError('Não foi possível carregar os dados de créditos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBuyCredits = async (packageSlug: string) => {
    try {
      setCheckoutLoading(packageSlug);
      setError(null);
      const { checkoutUrl } = await checkoutCredits(packageSlug);
      window.location.href = checkoutUrl;
    } catch (err) {
      console.error('Checkout failed:', err);
      setError('Erro ao iniciar checkout. Tente novamente.');
      setCheckoutLoading(null);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Créditos LLM</h1>
          <p className="text-sm text-dark-400 mt-1">
            Gerencie seus créditos de inteligência artificial.
          </p>
        </div>
        <Button onClick={() => setShowBuyModal(true)}>
          + Comprar Créditos
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-600/30 bg-red-600/10 p-4">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Saldo Atual"
          value={credits?.balance?.toLocaleString('pt-BR') ?? '0'}
          iconColor="bg-primary-600/20 text-primary-400"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
        <StatsCard
          title="Total Creditado"
          value={credits?.totalCredited?.toLocaleString('pt-BR') ?? '0'}
          iconColor="bg-green-600/20 text-green-400"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
          }
        />
        <StatsCard
          title="Total Utilizado"
          value={credits?.totalDebited?.toLocaleString('pt-BR') ?? '0'}
          iconColor="bg-blue-600/20 text-blue-400"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
      </div>

      {/* Transaction History */}
      <Card>
        <h3 className="text-lg font-semibold text-white mb-4">
          Histórico de Transações
        </h3>
        {transactions.length === 0 ? (
          <p className="text-sm text-dark-400 py-8 text-center">
            Nenhuma transação encontrada.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 font-medium text-dark-400">Data</th>
                  <th className="pb-3 font-medium text-dark-400">Tipo</th>
                  <th className="pb-3 font-medium text-dark-400">Descrição</th>
                  <th className="pb-3 font-medium text-dark-400 text-right">Créditos</th>
                  <th className="pb-3 font-medium text-dark-400 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border/50 last:border-0">
                    <td className="py-3 text-dark-300">
                      {new Date(tx.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3">
                      <Badge
                        variant={
                          tx.type === 'credit'
                            ? 'success'
                            : tx.type === 'refund'
                              ? 'warning'
                              : 'default'
                        }
                      >
                        {tx.type === 'credit' ? 'Crédito' : tx.type === 'debit' ? 'Débito' : 'Reembolso'}
                      </Badge>
                    </td>
                    <td className="py-3 text-dark-100">
                      {tx.description || REASON_LABELS[tx.reason] || tx.reason}
                    </td>
                    <td className="py-3 text-right">
                      <span
                        className={
                          tx.type === 'credit' || tx.type === 'refund'
                            ? 'text-green-400 font-medium'
                            : 'text-red-400 font-medium'
                        }
                      >
                        {tx.type === 'credit' || tx.type === 'refund' ? '+' : '-'}
                        {tx.amount.toLocaleString('pt-BR')}
                      </span>
                    </td>
                    <td className="py-3 text-right text-dark-300">
                      {tx.balanceAfter.toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Buy Credits Modal */}
      <Modal
        isOpen={showBuyModal}
        onClose={() => setShowBuyModal(false)}
        title="Comprar Créditos LLM"
        size="lg"
      >
        <p className="text-sm text-dark-400 mb-6">
          Selecione um pacote de créditos. Créditos comprados não expiram.
        </p>

        {error && (
          <div className="rounded-lg border border-red-600/30 bg-red-600/10 p-3 mb-4">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {creditPackages.map((pkg) => (
            <button
              key={pkg.slug}
              onClick={() => handleBuyCredits(pkg.slug)}
              disabled={checkoutLoading !== null}
              className="relative rounded-xl border border-border bg-dark-950 p-5 text-left hover:border-primary-600/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pkg.popular && (
                <div className="absolute -top-2 right-4">
                  <Badge variant="primary">Popular</Badge>
                </div>
              )}
              {checkoutLoading === pkg.slug && (
                <div className="absolute inset-0 flex items-center justify-center bg-dark-950/80 rounded-xl">
                  <Spinner size="md" />
                </div>
              )}
              <p className="text-2xl font-bold text-white">
                {pkg.credits.toLocaleString('pt-BR')}
              </p>
              <p className="text-sm text-dark-400">créditos</p>
              <p className="text-lg font-semibold text-primary-400 mt-2">
                ${pkg.price}
              </p>
              <p className="text-xs text-dark-500">
                ${((pkg.price / pkg.credits) * 100).toFixed(1)} centavos/crédito
              </p>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

export default Credits;
