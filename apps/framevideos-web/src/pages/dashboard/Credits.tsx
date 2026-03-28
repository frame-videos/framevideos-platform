import { useState } from 'react';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';

const creditPackages = [
  { id: 'pack-100', credits: 100, price: 5, popular: false },
  { id: 'pack-500', credits: 500, price: 20, popular: true },
  { id: 'pack-1000', credits: 1000, price: 35, popular: false },
  { id: 'pack-5000', credits: 5000, price: 150, popular: false },
];

const usageHistory = [
  { date: '2026-03-27', action: 'Geração de tags', credits: -8, site: 'meu-site.framevideos.com' },
  { date: '2026-03-26', action: 'Tradução automática', credits: -15, site: 'meu-site.framevideos.com' },
  { date: '2026-03-25', action: 'Geração de descrições', credits: -12, site: 'outro-site.framevideos.com' },
  { date: '2026-03-24', action: 'SEO automático', credits: -5, site: 'meu-site.framevideos.com' },
  { date: '2026-03-23', action: 'Compra de créditos', credits: 500, site: '—' },
  { date: '2026-03-20', action: 'Geração de títulos', credits: -18, site: 'meu-site.framevideos.com' },
];

export function Credits() {
  const [showBuyModal, setShowBuyModal] = useState(false);

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

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Saldo Atual"
          value="342"
          iconColor="bg-primary-600/20 text-primary-400"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
        <StatsCard
          title="Usados Este Mês"
          value="58"
          change="-23% vs mês anterior"
          changeType="positive"
          iconColor="bg-blue-600/20 text-blue-400"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
        <StatsCard
          title="Incluídos no Plano"
          value="100/mês"
          iconColor="bg-green-600/20 text-green-400"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
          }
        />
      </div>

      {/* Usage History */}
      <Card>
        <h3 className="text-lg font-semibold text-white mb-4">
          Histórico de Uso
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-3 font-medium text-dark-400">Data</th>
                <th className="pb-3 font-medium text-dark-400">Ação</th>
                <th className="pb-3 font-medium text-dark-400">Site</th>
                <th className="pb-3 font-medium text-dark-400 text-right">Créditos</th>
              </tr>
            </thead>
            <tbody>
              {usageHistory.map((item, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="py-3 text-dark-300">
                    {new Date(item.date).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="py-3 text-dark-100">{item.action}</td>
                  <td className="py-3 text-dark-400 text-xs">{item.site}</td>
                  <td className="py-3 text-right">
                    <Badge variant={item.credits > 0 ? 'success' : 'default'}>
                      {item.credits > 0 ? `+${item.credits}` : item.credits}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {creditPackages.map((pkg) => (
            <button
              key={pkg.id}
              className="relative rounded-xl border border-border bg-dark-950 p-5 text-left hover:border-primary-600/50 transition-colors cursor-pointer"
            >
              {pkg.popular && (
                <div className="absolute -top-2 right-4">
                  <Badge variant="primary">Popular</Badge>
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
                ${(pkg.price / pkg.credits * 100).toFixed(1)} centavos/crédito
              </p>
            </button>
          ))}
        </div>
        <div className="flex justify-end mt-6">
          <Button onClick={() => setShowBuyModal(false)}>
            Finalizar Compra
          </Button>
        </div>
      </Modal>
    </div>
  );
}
