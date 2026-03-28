import { useAuthStore } from '@/stores/auth';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card } from '@/components/ui/Card';

export function DashboardHome() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Olá, {user?.name?.split(' ')[0] || 'Usuário'} 👋
        </h1>
        <p className="text-sm text-dark-400 mt-1">
          Aqui está um resumo da sua conta.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total de Visitas"
          value="12.458"
          change="+12.5%"
          changeType="positive"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          }
        />
        <StatsCard
          title="Vídeos Publicados"
          value="47"
          change="+3"
          changeType="positive"
          iconColor="bg-blue-600/20 text-blue-400"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatsCard
          title="Sites Ativos"
          value="2"
          iconColor="bg-green-600/20 text-green-400"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
            </svg>
          }
        />
        <StatsCard
          title="Créditos LLM"
          value="342"
          change="-58 este mês"
          changeType="neutral"
          iconColor="bg-yellow-600/20 text-yellow-400"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
        />
      </div>

      {/* Recent Activity */}
      <Card>
        <h3 className="text-lg font-semibold text-white mb-4">Atividade Recente</h3>
        <div className="space-y-4">
          {[
            { action: 'Vídeo publicado', detail: 'novo-video-exemplo.mp4', time: 'Há 2 horas' },
            { action: 'SEO atualizado', detail: 'meu-site.framevideos.com', time: 'Há 5 horas' },
            { action: 'Créditos LLM usados', detail: '12 créditos — geração de tags', time: 'Há 1 dia' },
            { action: 'Novo domínio conectado', detail: 'meusvideos.com', time: 'Há 2 dias' },
            { action: 'Plano atualizado', detail: 'Free → Starter', time: 'Há 3 dias' },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <div>
                <p className="text-sm font-medium text-dark-100">{item.action}</p>
                <p className="text-xs text-dark-500">{item.detail}</p>
              </div>
              <span className="text-xs text-dark-500 whitespace-nowrap ml-4">{item.time}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
