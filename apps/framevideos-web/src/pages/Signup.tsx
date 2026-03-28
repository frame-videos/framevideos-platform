import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiClientError } from '@/api/client';

const signupSchema = z
  .object({
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    email: z.string().email('Email inválido'),
    siteName: z
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

type SignupForm = z.infer<typeof signupSchema>;

export function Signup() {
  const { signup } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupForm) => {
    setError('');
    setLoading(true);
    try {
      await signup({
        name: data.name,
        email: data.email,
        siteName: data.siteName,
        password: data.password,
      });
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
    <div className="flex min-h-screen items-center justify-center bg-dark-950 px-4 py-12">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary-600/10 blur-[120px]" />
      </div>

      <div className="w-full max-w-md">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600">
            <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="8,4 8,20 20,12" />
            </svg>
          </div>
          <span className="text-xl font-bold text-white">Frame Videos</span>
        </Link>

        {/* Form card */}
        <div className="rounded-xl border border-border bg-surface p-8">
          <h1 className="text-2xl font-bold text-white mb-2">Criar Conta</h1>
          <p className="text-sm text-dark-400 mb-6">
            Comece grátis. Sem cartão de crédito.
          </p>

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
              error={errors.siteName?.message}
              {...register('siteName')}
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
        </div>

        <p className="mt-6 text-center text-sm text-dark-400">
          Já tem uma conta?{' '}
          <Link
            to="/login"
            className="text-primary-400 hover:text-primary-300 font-medium transition-colors"
          >
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  );
}
