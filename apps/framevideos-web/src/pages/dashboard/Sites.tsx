import { useState } from 'react';
import { SitesList } from '@/components/dashboard/SitesList';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function Sites() {
  const [showModal, setShowModal] = useState(false);

  // Mock data — vazio por enquanto para mostrar empty state
  const sites: {
    id: string;
    name: string;
    domain: string;
    status: 'active' | 'inactive' | 'pending';
    videos: number;
    visits: number;
  }[] = [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Meus Sites</h1>
        <p className="text-sm text-dark-400 mt-1">
          Gerencie todos os seus sites de vídeos.
        </p>
      </div>

      <SitesList sites={sites} onAddSite={() => setShowModal(true)} />

      {/* Add Site Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Adicionar Novo Site"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setShowModal(false);
          }}
          className="space-y-4"
        >
          <Input
            label="Nome do site"
            placeholder="Meu Site de Vídeos"
          />
          <Input
            label="Subdomínio"
            placeholder="meu-site"
            hint="Seu site ficará em meu-site.framevideos.com"
          />
          <Input
            label="Domínio personalizado (opcional)"
            placeholder="meusvideos.com"
            hint="Você pode configurar depois"
          />
          <div className="flex gap-3 justify-end pt-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setShowModal(false)}
            >
              Cancelar
            </Button>
            <Button type="submit">
              Criar Site
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
