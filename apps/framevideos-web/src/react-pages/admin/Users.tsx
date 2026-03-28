import { useEffect, useState } from 'react';
import { API_URL } from '@/lib/constants';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  tenant_name: string | null;
  created_at: string;
}

const roleMap: Record<string, { label: string; variant: 'primary' | 'success' | 'default' }> = {
  super_admin: { label: 'Super Admin', variant: 'primary' },
  tenant_admin: { label: 'Admin', variant: 'success' },
  site_admin: { label: 'Site Admin', variant: 'default' },
  advertiser: { label: 'Anunciante', variant: 'default' },
};

export function Users() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem('accessToken');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_URL}/api/v1/admin/users?limit=50`, { headers });
        const data = await res.json();
        setUsers(data?.data ?? []);
      } catch (err) {
        console.error('Failed to load users:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Usuários</h1>
        <p className="text-sm text-dark-400 mt-1">
          Todos os usuários registrados na plataforma.
        </p>
      </div>

      <Card>
        <Input
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
                  <th className="px-6 py-4 font-medium text-dark-400">Usuário</th>
                  <th className="px-6 py-4 font-medium text-dark-400">Função</th>
                  <th className="px-6 py-4 font-medium text-dark-400">Tenant</th>
                  <th className="px-6 py-4 font-medium text-dark-400">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => {
                  const role = roleMap[user.role] ?? { label: user.role, variant: 'default' as const };
                  return (
                    <tr key={user.id} className="border-b border-border/50 last:border-0 hover:bg-surface-light/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600/20 text-primary-400 text-xs font-semibold">
                            {user.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-dark-100">{user.name}</p>
                            <p className="text-xs text-dark-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={role.variant}>{role.label}</Badge>
                      </td>
                      <td className="px-6 py-4 text-dark-300">
                        {user.tenant_name ?? '—'}
                      </td>
                      <td className="px-6 py-4 text-dark-400 text-xs">
                        {new Date(user.created_at).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-dark-500">
                      Nenhum usuário encontrado.
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

export default Users;
