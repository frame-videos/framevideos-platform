import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card } from '@/components/ui/Card';

export function AdminHome() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Painel Administrativo</h1>
        <p className="text-sm text-dark-400 mt-1">
          Visão geral da plataforma Frame Videos.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total de Tenants"
          value="127"
          change="+8 este mês"
          changeType="positive"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        />
        <StatsCard
          title="MRR"
          value="$2.340"
          change="+15.3%"
          changeType="positive"
          iconColor="bg-green-600/20 text-green-400"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatsCard
          title="Usuários Totais"
          value="312"
          change="+24"
          changeType="positive"
          iconColor="bg-blue-600/20 text-blue-400"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />
        <StatsCard
          title="Sites Ativos"
          value="89"
          change="+5"
          changeType="positive"
          iconColor="bg-yellow-600/20 text-yellow-400"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
            </svg>
          }
        />
      </div>

      {/* Revenue Chart placeholder */}
      <Card>
        <h3 className="text-lg font-semibold text-white mb-4">Receita Mensal</h3>
        <div className="flex items-end gap-2 h-48">
          {[35, 45, 52, 48, 61, 55, 67, 72, 68, 78, 85, 92].map((val, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-primary-600/60 hover:bg-primary-600 transition-colors"
                style={{ height: `${val}%` }}
              />
              <span className="text-[10px] text-dark-500">
                {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][i]}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent Tenants */}
      <Card>
        <h3 className="text-lg font-semibold text-white mb-4">Últimos Tenants</h3>
        <div className="space-y-3">
          {[
            { name: 'VideoMax Studio', email: 'admin@videomax.com', plan: 'Pro', date: '27/03/2026' },
            { name: 'Content Hub', email: 'hello@contenthub.io', plan: 'Starter', date: '26/03/2026' },
            { name: 'MediaFlow', email: 'team@mediaflow.tv', plan: 'Business', date: '25/03/2026' },
            { name: 'StreamPro', email: 'info@streampro.net', plan: 'Free', date: '24/03/2026' },
          ].map((tenant, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600/20 text-primary-400 text-xs font-semibold">
                  {tenant.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-dark-100">{tenant.name}</p>
                  <p className="text-xs text-dark-500">{tenant.email}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-medium text-primary-400 bg-primary-600/20 px-2 py-0.5 rounded-full">
                  {tenant.plan}
                </span>
                <p className="text-xs text-dark-500 mt-1">{tenant.date}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
