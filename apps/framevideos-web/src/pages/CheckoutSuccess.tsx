import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export function CheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = useState(3);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/dashboard/plan', { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-dark-950 px-4">
      <div className="text-center max-w-md">
        {/* Success icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-600/20">
          <svg
            className="h-10 w-10 text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-white mb-3">
          Pagamento Confirmado!
        </h1>
        <p className="text-dark-300 mb-2">
          Seu pagamento foi processado com sucesso.
        </p>
        <p className="text-dark-400 text-sm mb-8">
          Redirecionando para o dashboard em {countdown} segundo{countdown !== 1 ? 's' : ''}...
        </p>

        {sessionId && (
          <p className="text-xs text-dark-600 mb-4">
            Sessão: {sessionId.slice(0, 20)}...
          </p>
        )}

        <button
          onClick={() => navigate('/dashboard/plan', { replace: true })}
          className="text-primary-400 hover:text-primary-300 font-medium transition-colors text-sm cursor-pointer"
        >
          Ir para o dashboard agora →
        </button>
      </div>
    </div>
  );
}
