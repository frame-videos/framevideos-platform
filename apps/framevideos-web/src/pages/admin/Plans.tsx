import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';

const planSchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório'),
  price: z.string().min(1, 'Preço é obrigatório'),
  maxSites: z.string().min(1, 'Obrigatório'),
  maxVideos: z.string().min(1, 'Obrigatório'),
  storage: z.string().min(1, 'Obrigatório'),
  bandwidth: z.string().min(1, 'Obrigatório'),
  llmCredits: z.string().min(1, 'Obrigatório'),
});

type PlanForm = z.infer<typeof planSchema>;

interface PlanData {
  id: string;
  name: string;
  price: number;
  maxSites: number;
  maxVideos: number;
  storage: string;
  bandwidth: string;
  llmCredits: number;
  subscribers: number;
}

const mockPlans: PlanData[] = [
  { id: '1', name: 'Free', price: 0, maxSites: 1, maxVideos: 100, storage: '1 GB', bandwidth: '10 GB/mês', llmCredits: 0, subscribers: 85 },
  { id: '2', name: 'Starter', price: 5, maxSites: 3, maxVideos: 1000, storage: '10 GB', bandwidth: '100 GB/mês', llmCredits: 100, subscribers: 28 },
  { id: '3', name: 'Pro', price: 20, maxSites: 10, maxVideos: 10000, storage: '100 GB', bandwidth: '1 TB/mês', llmCredits: 500, subscribers: 11 },
  { id: '4', name: 'Business', price: 50, maxSites: -1, maxVideos: -1, storage: '1 TB', bandwidth: 'Ilimitado', llmCredits: 2000, subscribers: 3 },
];

export function Plans() {
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanData | null>(null);

  const form = useForm<PlanForm>({
    resolver: zodResolver(planSchema),
  });

  const openCreate = () => {
    setEditingPlan(null);
    form.reset({
      name: '',
      price: '',
      maxSites: '',
      maxVideos: '',
      storage: '',
      bandwidth: '',
      llmCredits: '',
    });
    setShowModal(true);
  };

  const openEdit = (plan: PlanData) => {
    setEditingPlan(plan);
    form.reset({
      name: plan.name,
      price: String(plan.price),
      maxSites: String(plan.maxSites),
      maxVideos: String(plan.maxVideos),
      storage: plan.storage,
      bandwidth: plan.bandwidth,
      llmCredits: String(plan.llmCredits),
    });
    setShowModal(true);
  };

  const onSubmit = (_data: PlanForm) => {
    // Placeholder — integração com API
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Planos</h1>
          <p className="text-sm text-dark-400 mt-1">
            Gerencie os planos de assinatura da plataforma.
          </p>
        </div>
        <Button onClick={openCreate}>+ Novo Plano</Button>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mockPlans.map((plan) => (
          <Card key={plan.id} hover>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                <p className="text-2xl font-bold text-primary-400 mt-1">
                  {plan.price === 0 ? 'Grátis' : `$${plan.price}/mês`}
                </p>
              </div>
              <Badge variant="primary">{plan.subscribers} assinantes</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div>
                <p className="text-dark-500 text-xs">Sites</p>
                <p className="text-dark-200 font-medium">
                  {plan.maxSites === -1 ? 'Ilimitado' : plan.maxSites}
                </p>
              </div>
              <div>
                <p className="text-dark-500 text-xs">Vídeos</p>
                <p className="text-dark-200 font-medium">
                  {plan.maxVideos === -1 ? 'Ilimitado' : plan.maxVideos.toLocaleString('pt-BR')}
                </p>
              </div>
              <div>
                <p className="text-dark-500 text-xs">Armazenamento</p>
                <p className="text-dark-200 font-medium">{plan.storage}</p>
              </div>
              <div>
                <p className="text-dark-500 text-xs">Bandwidth</p>
                <p className="text-dark-200 font-medium">{plan.bandwidth}</p>
              </div>
              <div>
                <p className="text-dark-500 text-xs">Créditos LLM</p>
                <p className="text-dark-200 font-medium">
                  {plan.llmCredits === 0 ? '—' : `${plan.llmCredits}/mês`}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => openEdit(plan)}>
                Editar
              </Button>
              <Button size="sm" variant="ghost">
                Desativar
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingPlan ? `Editar Plano: ${editingPlan.name}` : 'Novo Plano'}
        size="lg"
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nome do plano"
              error={form.formState.errors.name?.message}
              {...form.register('name')}
            />
            <Input
              label="Preço (USD/mês)"
              type="number"
              error={form.formState.errors.price?.message}
              {...form.register('price')}
            />
            <Input
              label="Máx. sites (-1 = ilimitado)"
              type="number"
              error={form.formState.errors.maxSites?.message}
              {...form.register('maxSites')}
            />
            <Input
              label="Máx. vídeos (-1 = ilimitado)"
              type="number"
              error={form.formState.errors.maxVideos?.message}
              {...form.register('maxVideos')}
            />
            <Input
              label="Armazenamento"
              placeholder="Ex: 10 GB"
              error={form.formState.errors.storage?.message}
              {...form.register('storage')}
            />
            <Input
              label="Bandwidth"
              placeholder="Ex: 100 GB/mês"
              error={form.formState.errors.bandwidth?.message}
              {...form.register('bandwidth')}
            />
            <Input
              label="Créditos LLM/mês"
              type="number"
              error={form.formState.errors.llmCredits?.message}
              {...form.register('llmCredits')}
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              {editingPlan ? 'Salvar' : 'Criar Plano'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
