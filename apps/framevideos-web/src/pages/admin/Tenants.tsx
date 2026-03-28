import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface Tenant {
  id: string;
  name: string;
  email: string;
  plan: string;
  status: 'active' | 'inactive' | 'suspended';
  sites: number;
  users: number;
  createdAt: string;
}

const mockTenants: Tenant[] = [
  { id: '1', name: 'VideoMax Studio', email: 'admin@videomax.com', plan: 'Pro', status: 'active', sites: 5, users: 3, createdAt: '2026-01-15' },
  { id: '2', name: 'Content Hub', email: 'hello@contenthub.io', plan: 'Starter', status: 'active', sites: 2, users: 1, createdAt: '2026-02-10' },
  { id: '3', name: 'MediaFlow', email: 'team@mediaflow.tv', plan: 'Business', status: 'active', sites: 12, users: 5, createdAt: '2025-11-20' },
  { id: '4', name: 'StreamPro', email: 'info@streampro.net', plan: 'Free', status: 'inactive', sites: 0, users: 1, createdAt: '2026-03-01' },
  { id: '5', name: 'TubeNetwork', email: 'admin@tubenetwork.com', plan: 'Pro', status: 'active', sites: 8, users: 4, createdAt: '2025-09-05' },
  { id: '6', name: 'VidWorld', email: 'contact@vidworld.com', plan: 'Starter', status: 'suspended', sites: 1, users: 1, createdAt: '2026-01-28' },
];

const statusMap = {
  active: { label: 'Ativo', variant: 'success' as const },
  inactive: { label: 'Inativo', variant: 'default' as const },
  suspended: { label: 'Suspenso', variant: 'danger' as const },
};

export function Tenants() {
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const filtered = mockTenants.filter((t) => {
    const matchSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.email.toLowerCase().includes(search.toLowerCase());
    const matchPlan = filterPlan === 'all' || t.plan.toLowerCase() === filterPlan;
    const matchStatus = filterStatus === 'all' || t.status === filterStatus;
    return matchSearch && matchPlan && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Tenants</h1>
        <p className="text-sm text-dark-400 mt-1">
          Gerencie todos os tenants da plataforma.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-dark-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={filterPlan}
            onChange={(e) => setFilterPlan(e.target.value)}
          >
            <option value="all">Todos os planos</option>
            <option value="free">Free</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="business">Business</option>
          </select>
          <select
            className="rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-dark-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Todos os status</option>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
            <option value="suspended">Suspenso</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-6 py-4 font-medium text-dark-400">Tenant</th>
                <th className="px-6 py-4 font-medium text-dark-400">Plano</th>
                <th className="px-6 py-4 font-medium text-dark-400">Status</th>
                <th className="px-6 py-4 font-medium text-dark-400">Sites</th>
                <th className="px-6 py-4 font-medium text-dark-400">Usuários</th>
                <th className="px-6 py-4 font-medium text-dark-400">Criado em</th>
                <th className="px-6 py-4 font-medium text-dark-400"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tenant) => (
                <tr key={tenant.id} className="border-b border-border/50 last:border-0 hover:bg-surface-light/50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-dark-100">{tenant.name}</p>
                      <p className="text-xs text-dark-500">{tenant.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="primary">{tenant.plan}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={statusMap[tenant.status].variant}>
                      {statusMap[tenant.status].label}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-dark-300">{tenant.sites}</td>
                  <td className="px-6 py-4 text-dark-300">{tenant.users}</td>
                  <td className="px-6 py-4 text-dark-400 text-xs">
                    {new Date(tenant.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4">
                    <Button size="sm" variant="ghost">
                      Detalhes
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-dark-500">
                    Nenhum tenant encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
