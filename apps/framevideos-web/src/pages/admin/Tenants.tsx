import { useEffect, useState } from 'react';
import { API_URL } from '@/lib/constants';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan_name: string | null;
  created_at: string;
}

const statusMap: Record<string, { label: string; variant: 'success' | 'default' | 'danger' }> = {
  active: { label: 'Ativo', variant: 'success' },
  trial: { label: 'Trial', variant: 'default' },
  inactive: { label: 'Inativo', variant: 'default' },
  suspended: { label: 'Suspenso', variant: 'danger' },
};

export function Tenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem('accessToken');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_URL}/api/v1/admin/tenants?limit=50`, { headers });
        const data = await res.json();
        setTenants(data?.data ?? []);
      } catch (err) {
        console.error('Failed to load tenants:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = tenants.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Tenants</h1>
        <p className="text-sm text-dark-400 mt-1">
          Gerencie todos os tenants da plataforma.
        </p>
      </div>

      <Card>
        <div className="flex-1">
          <Input
            placeholder="Buscar por nome ou slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Card>

      <Card padding="none">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-6 py-4 font-medium text-dark-400">Tenant</th>
                  <th className="px-6 py-4 font-medium text-dark-400">Plano</th>
                  <th className="px-6 py-4 font-medium text-dark-400">Status</th>
                  <th className="px-6 py-4 font-medium text-dark-400">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tenant) => {
                  const st = statusMap[tenant.status] ?? { label: tenant.status, variant: 'default' as const };
                  return (
                    <tr key={tenant.id} className="border-b border-border/50 last:border-0 hover:bg-surface-light/50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-dark-100">{tenant.name}</p>
                          <p className="text-xs text-dark-500">{tenant.slug}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="primary">{tenant.plan_name ?? 'Free'}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </td>
                      <td className="px-6 py-4 text-dark-400 text-xs">
                        {new Date(tenant.created_at).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-dark-500">
                      Nenhum tenant encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
