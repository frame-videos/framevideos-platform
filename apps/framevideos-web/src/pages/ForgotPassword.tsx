import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const forgotSchema = z.object({
  email: z.string().email('Email inválido'),
});

type ForgotForm = z.infer<typeof forgotSchema>;

export function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (_data: ForgotForm) => {
    setLoading(true);
    // Simula envio — endpoint não implementado ainda
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-dark-950 px-4">
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
          {sent ? (
            <div className="text-center">
              <div className="text-5xl mb-4">📧</div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Email enviado!
              </h1>
              <p className="text-sm text-dark-400 mb-6">
                Se o email estiver cadastrado, você receberá instruções para redefinir sua senha.
              </p>
              <Link to="/login">
                <Button variant="outline" className="w-full">
                  Voltar para login
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-white mb-2">
                Esqueceu a senha?
              </h1>
              <p className="text-sm text-dark-400 mb-6">
                Informe seu email e enviaremos instruções para redefinir sua senha.
              </p>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  label="Email"
                  type="email"
                  placeholder="seu@email.com"
                  error={errors.email?.message}
                  {...register('email')}
                />

                <Button type="submit" loading={loading} className="w-full">
                  Enviar Instruções
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-dark-400">
          Lembrou a senha?{' '}
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
