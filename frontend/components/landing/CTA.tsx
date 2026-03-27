import Link from 'next/link';

export default function CTA() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-3xl mx-auto text-center bg-gradient-to-br from-primary-900/30 to-gray-900/50 border border-primary-800/30 rounded-2xl p-12">
        <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
          Pronto para <span className="gradient-text">começar</span>?
        </h2>
        <p className="text-gray-400 mb-8 max-w-lg mx-auto leading-relaxed">
          Junte-se a mais de 500 criadores que já estão lucrando com a Frame Videos.
          Comece grátis, sem cartão de crédito.
        </p>
        <Link
          href="/auth/register"
          className="inline-block bg-primary-600 hover:bg-primary-700 text-white font-bold px-10 py-4 rounded-xl text-lg transition animate-pulse-glow"
        >
          Criar Minha Conta Grátis →
        </Link>
      </div>
    </section>
  );
}
