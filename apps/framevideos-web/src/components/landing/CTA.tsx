import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export function CTA() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-primary-600/30 bg-gradient-to-br from-primary-900/40 via-surface to-dark-950 p-8 sm:p-16 text-center">
          {/* Background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-primary-600/20 blur-[100px] -z-10" />

          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Pronto para começar?
          </h2>
          <p className="text-lg text-dark-300 max-w-xl mx-auto mb-8">
            Crie sua conta gratuita em menos de 2 minutos. Sem cartão de crédito, sem compromisso.
          </p>
          <Link to="/signup">
            <Button size="lg" className="min-w-[220px]">
              Criar Minha Conta Grátis →
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
