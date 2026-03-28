import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface Site {
  id: string;
  name: string;
  domain: string;
  status: 'active' | 'inactive' | 'pending';
  videos: number;
  visits: number;
}

interface SitesListProps {
  sites: Site[];
  onAddSite: () => void;
}

const statusMap = {
  active: { label: 'Ativo', variant: 'success' as const },
  inactive: { label: 'Inativo', variant: 'danger' as const },
  pending: { label: 'Pendente', variant: 'warning' as const },
};

export function SitesList({ sites, onAddSite }: SitesListProps) {
  if (sites.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-12 text-center">
        <div className="text-5xl mb-4">🌐</div>
        <h3 className="text-lg font-semibold text-white mb-2">
          Nenhum site criado ainda
        </h3>
        <p className="text-sm text-dark-400 mb-6 max-w-md mx-auto">
          Crie seu primeiro site de vídeos e comece a publicar conteúdo em minutos.
        </p>
        <Button onClick={onAddSite}>
          + Adicionar Site
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          Seus Sites ({sites.length})
        </h3>
        <Button size="sm" onClick={onAddSite}>
          + Adicionar Site
        </Button>
      </div>

      <div className="grid gap-4">
        {sites.map((site) => (
          <div
            key={site.id}
            className="rounded-xl border border-border bg-surface p-5 flex flex-col sm:flex-row sm:items-center gap-4"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-semibold text-white truncate">
                  {site.name}
                </h4>
                <Badge variant={statusMap[site.status].variant}>
                  {statusMap[site.status].label}
                </Badge>
              </div>
              <p className="text-xs text-dark-400">{site.domain}</p>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div>
                <p className="text-dark-400 text-xs">Vídeos</p>
                <p className="font-semibold text-white">{site.videos}</p>
              </div>
              <div>
                <p className="text-dark-400 text-xs">Visitas</p>
                <p className="font-semibold text-white">{site.visits.toLocaleString('pt-BR')}</p>
              </div>
              <Button size="sm" variant="ghost">
                Gerenciar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
