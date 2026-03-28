import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/auth';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const profileSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
    newPassword: z
      .string()
      .min(8, 'Nova senha deve ter pelo menos 8 caracteres')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Senha deve conter maiúscula, minúscula e número',
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export function Settings() {
  const { user } = useAuthStore();
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
    },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const onProfileSubmit = async (_data: ProfileForm) => {
    setProfileLoading(true);
    setProfileSuccess(false);
    // Simula chamada à API
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setProfileLoading(false);
    setProfileSuccess(true);
    setTimeout(() => setProfileSuccess(false), 3000);
  };

  const onPasswordSubmit = async (_data: PasswordForm) => {
    setPasswordLoading(true);
    setPasswordSuccess(false);
    // Simula chamada à API
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setPasswordLoading(false);
    setPasswordSuccess(true);
    passwordForm.reset();
    setTimeout(() => setPasswordSuccess(false), 3000);
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-sm text-dark-400 mt-1">
          Gerencie suas informações pessoais e segurança.
        </p>
      </div>

      {/* Profile */}
      <Card>
        <h3 className="text-lg font-semibold text-white mb-4">Perfil</h3>

        {profileSuccess && (
          <div className="mb-4 rounded-lg border border-green-500/30 bg-green-600/10 p-3">
            <p className="text-sm text-green-400">Perfil atualizado com sucesso!</p>
          </div>
        )}

        <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
          <Input
            label="Nome completo"
            error={profileForm.formState.errors.name?.message}
            {...profileForm.register('name')}
          />
          <Input
            label="Email"
            type="email"
            error={profileForm.formState.errors.email?.message}
            {...profileForm.register('email')}
          />
          <div className="flex justify-end pt-2">
            <Button type="submit" loading={profileLoading}>
              Salvar Alterações
            </Button>
          </div>
        </form>
      </Card>

      {/* Password */}
      <Card>
        <h3 className="text-lg font-semibold text-white mb-4">Alterar Senha</h3>

        {passwordSuccess && (
          <div className="mb-4 rounded-lg border border-green-500/30 bg-green-600/10 p-3">
            <p className="text-sm text-green-400">Senha alterada com sucesso!</p>
          </div>
        )}

        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
          <Input
            label="Senha atual"
            type="password"
            placeholder="••••••••"
            error={passwordForm.formState.errors.currentPassword?.message}
            {...passwordForm.register('currentPassword')}
          />
          <Input
            label="Nova senha"
            type="password"
            placeholder="••••••••"
            hint="Mínimo 8 caracteres, com maiúscula, minúscula e número"
            error={passwordForm.formState.errors.newPassword?.message}
            {...passwordForm.register('newPassword')}
          />
          <Input
            label="Confirmar nova senha"
            type="password"
            placeholder="••••••••"
            error={passwordForm.formState.errors.confirmPassword?.message}
            {...passwordForm.register('confirmPassword')}
          />
          <div className="flex justify-end pt-2">
            <Button type="submit" loading={passwordLoading}>
              Alterar Senha
            </Button>
          </div>
        </form>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-500/30">
        <h3 className="text-lg font-semibold text-red-400 mb-2">Zona de Perigo</h3>
        <p className="text-sm text-dark-400 mb-4">
          Ações irreversíveis. Tenha cuidado.
        </p>
        <Button variant="danger" size="sm">
          Excluir Minha Conta
        </Button>
      </Card>
    </div>
  );
}
