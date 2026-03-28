import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  tenant: string;
  status: 'active' | 'inactive';
  createdAt: string;
  lastLogin: string;
}

const mockUsers: UserData[] = [
  { id: '1', name: 'João Silva', email: 'joao@videomax.com', role: 'owner', tenant: 'VideoMax Studio', status: 'active', createdAt: '2026-01-15', lastLogin: '2026-03-27' },
  { id: '2', name: 'Maria Santos', email: 'maria@videomax.com', role: 'editor', tenant: 'VideoMax Studio', status: 'active', createdAt: '2026-02-01', lastLogin: '2026-03-26' },
  { id: '3', name: 'Carlos Oliveira', email: 'carlos@contenthub.io', role: 'owner', tenant: 'Content Hub', status: 'active', createdAt: '2026-02-10', lastLogin: '2026-03-25' },
  { id: '4', name: 'Ana Costa', email: 'ana@mediaflow.tv', role: 'owner', tenant: 'MediaFlow', status: 'active', createdAt: '2025-11-20', lastLogin: '2026-03-27' },
  { id: '5', name: 'Pedro Lima', email: 'pedro@mediaflow.tv', role: 'admin', tenant: 'MediaFlow', status: 'active', createdAt: '2025-12-05', lastLogin: '2026-03-24' },
  { id: '6', name: 'Lucia Ferreira', email: 'lucia@streampro.net', role: 'owner', tenant: 'StreamPro', status: 'inactive', createdAt: '2026-03-01', lastLogin: '2026-03-10' },
  { id: '7', name: 'Admin System', email: 'admin@framevideos.com', role: 'super_admin', tenant: '—', status: 'active', createdAt: '2025-01-01', lastLogin: '2026-03-28' },
];

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
};

export function Users() {
  const [search, setSearch] = useState('');

  const filtered = mockUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.tenant.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Usuários</h1>
        <p className="text-sm text-dark-400 mt-1">
          Todos os usuários registrados na plataforma.
        </p>
      </div>

      {/* Search */}
      <Card>
        <Input
          placeholder="Buscar por nome, email ou tenant..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Card>

      {/* Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-6 py-4 font-medium text-dark-400">Usuário</th>
                <th className="px-6 py-4 font-medium text-dark-400">Role</th>
                <th className="px-6 py-4 font-medium text-dark-400">Tenant</th>
                <th className="px-6 py-4 font-medium text-dark-400">Status</th>
                <th className="px-6 py-4 font-medium text-dark-400">Último Login</th>
                <th className="px-6 py-4 font-medium text-dark-400"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id} className="border-b border-border/50 last:border-0 hover:bg-surface-light/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600/20 text-primary-400 text-xs font-semibold">
                        {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium text-dark-100">{user.name}</p>
                        <p className="text-xs text-dark-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={user.role === 'super_admin' ? 'danger' : 'default'}>
                      {roleLabels[user.role] || user.role}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-dark-300">{user.tenant}</td>
                  <td className="px-6 py-4">
                    <Badge variant={user.status === 'active' ? 'success' : 'default'}>
                      {user.status === 'active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-dark-400 text-xs">
                    {new Date(user.lastLogin).toLocaleDateString('pt-BR')}
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
                  <td colSpan={6} className="px-6 py-12 text-center text-dark-500">
                    Nenhum usuário encontrado.
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
