import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/auth';
import * as authApi from '@/api/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiClientError } from '@/api/client';

const signupSchema = z
  .object({
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    email: z.string().email('Email inválido'),
    tenantName: z
      .string()
      .min(3, 'Nome do site deve ter pelo menos 3 caracteres')
      .max(50, 'Nome do site deve ter no máximo 50 caracteres'),
    password: z
      .string()
      .min(8, 'Senha deve ter pelo menos 8 caracteres')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Senha deve conter maiúscula, minúscula e número',
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type SignupFormData = z.infer<typeof signupSchema>;

export function SignupForm() {
  const { setAuth } = useAuthStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupFormData) => {
    setError('');
    setLoading(true);
    try {
      const response = await authApi.signup({
        name: data.name,
        email: data.email,
        tenantName: data.tenantName,
        password: data.password,
      });
      setAuth(response.user, response.accessToken, response.refreshToken);
      window.location.href = '/dashboard';
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Erro ao criar conta. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-600/10 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Nome completo"
          type="text"
          placeholder="Seu nome"
          error={errors.name?.message}
          {...register('name')}
        />

        <Input
          label="Email"
          type="email"
          placeholder="seu@email.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Nome do site"
          type="text"
          placeholder="meu-site-videos"
          hint="Será usado como subdomínio: meu-site-videos.framevideos.com"
          error={errors.tenantName?.message}
          {...register('tenantName')}
        />

        <Input
          label="Senha"
          type="password"
          placeholder="••••••••"
          hint="Mínimo 8 caracteres, com maiúscula, minúscula e número"
          error={errors.password?.message}
          {...register('password')}
        />

        <Input
          label="Confirmar senha"
          type="password"
          placeholder="••••••••"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <Button type="submit" loading={loading} className="w-full">
          Criar Conta
        </Button>
      </form>
    </>
  );
}
