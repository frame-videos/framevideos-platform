import { useEffect, useState } from 'react';

interface Props {
  sessionId?: string;
}

export function CheckoutSuccessRedirect({ sessionId }: Props) {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = '/dashboard/plan';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-center max-w-md">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-600/20">
        <svg className="h-10 w-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="text-3xl font-bold text-white mb-3">Pagamento Confirmado!</h1>
      <p className="text-dark-300 mb-2">Seu pagamento foi processado com sucesso.</p>
      <p className="text-dark-400 text-sm mb-8">
        Redirecionando para o dashboard em {countdown} segundo{countdown !== 1 ? 's' : ''}...
      </p>

      {sessionId && (
        <p className="text-xs text-dark-600 mb-4">
          Sessão: {sessionId.slice(0, 20)}...
        </p>
      )}

      <a
        href="/dashboard/plan"
        className="text-primary-400 hover:text-primary-300 font-medium transition-colors text-sm"
      >
        Ir para o dashboard agora →
      </a>
    </div>
  );
}
