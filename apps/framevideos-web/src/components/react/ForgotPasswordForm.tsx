import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const forgotSchema = z.object({
  email: z.string().email('Email inválido'),
});

type ForgotForm = z.infer<typeof forgotSchema>;

export function ForgotPasswordForm() {
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
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="text-center">
        <div className="text-5xl mb-4">📧</div>
        <h1 className="text-2xl font-bold text-white mb-2">Email enviado!</h1>
        <p className="text-sm text-dark-400 mb-6">
          Se o email estiver cadastrado, você receberá instruções para redefinir sua senha.
        </p>
        <a href="/login">
          <Button variant="outline" className="w-full">
            Voltar para login
          </Button>
        </a>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-white mb-2">Esqueceu a senha?</h1>
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
  );
}
