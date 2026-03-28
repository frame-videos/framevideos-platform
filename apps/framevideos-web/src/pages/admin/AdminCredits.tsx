import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';

const creditPackages = [
  { id: '1', credits: 100, price: 5, cost: 2, active: true },
  { id: '2', credits: 500, price: 20, cost: 8, active: true },
  { id: '3', credits: 1000, price: 35, cost: 14, active: true },
  { id: '4', credits: 5000, price: 150, cost: 55, active: true },
];

const topConsumers = [
  { tenant: 'MediaFlow', used: 1240, plan: 'Business' },
  { tenant: 'VideoMax Studio', used: 890, plan: 'Pro' },
  { tenant: 'TubeNetwork', used: 650, plan: 'Pro' },
  { tenant: 'Content Hub', used: 180, plan: 'Starter' },
  { tenant: 'StreamPro', used: 45, plan: 'Free' },
];

export function AdminCredits() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Créditos LLM</h1>
          <p className="text-sm text-dark-400 mt-1">
            Gerencie pacotes, markup e consumo global de créditos.
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>+ Novo Pacote</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Créditos Vendidos (mês)"
          value="8.500"
          change="+22%"
          changeType="positive"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
        <StatsCard
          title="Receita Créditos (mês)"
          value="$680"
          change="+18%"
          changeType="positive"
          iconColor="bg-green-600/20 text-green-400"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatsCard
          title="Custo LLM (mês)"
          value="$245"
          iconColor="bg-red-600/20 text-red-400"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          }
        />
        <StatsCard
          title="Margem"
          value="64%"
          change="+3pp"
          changeType="positive"
          iconColor="bg-yellow-600/20 text-yellow-400"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />
      </div>

      {/* Packages */}
      <Card>
        <h3 className="text-lg font-semibold text-white mb-4">Pacotes de Créditos</h3>
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
              {creditPackages.map((pkg) => {
                const markup = ((pkg.price - pkg.cost) / pkg.cost * 100).toFixed(0);
                return (
                  <tr key={pkg.id} className="border-b border-border/50 last:border-0">
                    <td className="py-3 font-semibold text-white">
                      {pkg.credits.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 text-dark-200">${pkg.price}</td>
                    <td className="py-3 text-dark-400">${pkg.cost}</td>
                    <td className="py-3">
                      <Badge variant="success">{markup}%</Badge>
                    </td>
                    <td className="py-3">
                      <Badge variant={pkg.active ? 'success' : 'default'}>
                        {pkg.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <Button size="sm" variant="ghost">Editar</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Top Consumers */}
      <Card>
        <h3 className="text-lg font-semibold text-white mb-4">Maiores Consumidores (mês)</h3>
        <div className="space-y-3">
          {topConsumers.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-dark-500 w-6">#{i + 1}</span>
                <div>
                  <p className="text-sm font-medium text-dark-100">{item.tenant}</p>
                  <Badge variant="primary">{item.plan}</Badge>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-white">{item.used.toLocaleString('pt-BR')} créditos</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* New Package Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Novo Pacote de Créditos"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setShowModal(false);
          }}
          className="space-y-4"
        >
          <Input label="Quantidade de créditos" type="number" placeholder="1000" />
          <Input label="Preço de venda (USD)" type="number" placeholder="35" />
          <Input label="Custo estimado (USD)" type="number" placeholder="14" />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button type="submit">Criar Pacote</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
