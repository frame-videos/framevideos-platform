import Link from 'next/link';

const plans = [
  {
    name: 'Starter',
    description: 'Perfeito para começar',
    price: '$29',
    cta: 'Comece Grátis',
    ctaStyle: 'bg-gray-800 hover:bg-gray-700 text-gray-200',
    highlight: false,
    features: [
      '50 GB de armazenamento',
      '10.000 views/mês',
      'Domínio personalizado',
      'Player básico',
      'Analytics básico',
      'Suporte por email',
    ],
  },
  {
    name: 'Pro',
    description: 'Para criadores sérios',
    price: '$79',
    cta: 'Começar com Pro',
    ctaStyle: 'bg-primary-600 hover:bg-primary-700 text-white',
    highlight: true,
    features: [
      '500 GB de armazenamento',
      '100.000 views/mês',
      'Domínio personalizado',
      'Player avançado + DRM',
      'Analytics completo',
      'Monetização integrada',
      'Suporte prioritário',
      'API de acesso',
    ],
  },
  {
    name: 'Enterprise',
    description: 'Escala sem limites',
    price: '$199',
    cta: 'Falar com Vendas',
    ctaStyle: 'bg-gray-800 hover:bg-gray-700 text-gray-200',
    highlight: false,
    features: [
      'Armazenamento ilimitado',
      'Views ilimitadas',
      'Múltiplos domínios',
      'Player premium + DRM',
      'Analytics avançado',
      'Monetização completa',
      'Suporte 24/7',
      'API completa',
      'White-label',
      'SLA 99.9%',
    ],
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
            Planos que cabem no seu <span className="gradient-text">bolso</span>
          </h2>
          <p className="text-gray-400 text-lg">Comece grátis. Escale quando quiser.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, i) => (
            <div
              key={i}
              className={`rounded-2xl p-8 border transition-all duration-300 ${
                plan.highlight
                  ? 'bg-primary-900/20 border-primary-600 ring-1 ring-primary-600/50 scale-[1.02]'
                  : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
              }`}
            >
              {plan.highlight && (
                <div className="text-xs font-semibold text-primary-400 uppercase tracking-wider mb-2">
                  Mais Popular
                </div>
              )}
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <p className="text-gray-400 text-sm mt-1">{plan.description}</p>
              <div className="mt-6 mb-6">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-gray-400">/mês</span>
              </div>
              <Link
                href="/auth/register"
                className={`block text-center py-3 rounded-lg font-semibold transition mb-8 ${plan.ctaStyle}`}
              >
                {plan.cta}
              </Link>
              <ul className="space-y-3">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-center gap-3 text-sm text-gray-300">
                    <svg
                      className="w-5 h-5 text-primary-400 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
