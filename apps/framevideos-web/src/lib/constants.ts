export const API_URL = import.meta.env.VITE_API_URL || 'https://api.framevideos.com';

export const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: 'mês',
    description: 'Para testar a plataforma',
    features: [
      '1 site',
      '100 vídeos',
      'Subdomínio gratuito',
      'Analytics básico',
      'Suporte por email',
    ],
    limits: {
      sites: 1,
      videos: 100,
      storage: '1 GB',
      bandwidth: '10 GB/mês',
    },
    highlighted: false,
    cta: 'Começar Grátis',
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 5,
    period: 'mês',
    description: 'Para criadores iniciantes',
    features: [
      '3 sites',
      '1.000 vídeos',
      'Domínio próprio',
      'SEO automático',
      'Analytics completo',
      '100 créditos LLM/mês',
    ],
    limits: {
      sites: 3,
      videos: 1000,
      storage: '10 GB',
      bandwidth: '100 GB/mês',
    },
    highlighted: false,
    cta: 'Assinar Starter',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 20,
    period: 'mês',
    description: 'Para produtores profissionais',
    features: [
      '10 sites',
      '10.000 vídeos',
      'Domínio próprio',
      'SEO automático + IA',
      'Analytics avançado',
      'Multi-idioma automático',
      '500 créditos LLM/mês',
      'Suporte prioritário',
    ],
    limits: {
      sites: 10,
      videos: 10000,
      storage: '100 GB',
      bandwidth: '1 TB/mês',
    },
    highlighted: true,
    cta: 'Assinar Pro',
  },
  {
    id: 'business',
    name: 'Business',
    price: 50,
    period: 'mês',
    description: 'Para empresas e estúdios',
    features: [
      'Sites ilimitados',
      'Vídeos ilimitados',
      'Domínios ilimitados',
      'SEO automático + IA avançada',
      'Analytics enterprise',
      'Multi-idioma automático',
      '2.000 créditos LLM/mês',
      'Suporte dedicado',
      'API de integração',
      'White-label',
    ],
    limits: {
      sites: -1,
      videos: -1,
      storage: '1 TB',
      bandwidth: 'Ilimitado',
    },
    highlighted: false,
    cta: 'Assinar Business',
  },
] as const;

export const FEATURES = [
  {
    icon: '🌍',
    title: 'Multi-idioma',
    description:
      'Tradução automática do seu site para dezenas de idiomas. Alcance audiência global sem esforço.',
  },
  {
    icon: '🔍',
    title: 'SEO Automático',
    description:
      'Meta tags, sitemaps, schema markup e otimizações geradas automaticamente por IA.',
  },
  {
    icon: '📝',
    title: 'CMS Completo',
    description:
      'Gerencie vídeos, categorias, tags e páginas com um painel intuitivo e poderoso.',
  },
  {
    icon: '📊',
    title: 'Analytics',
    description:
      'Acompanhe visitas, visualizações, tempo de sessão e conversões em tempo real.',
  },
  {
    icon: '🌐',
    title: 'Domínio Próprio',
    description:
      'Use seu próprio domínio com SSL automático. Configuração em minutos.',
  },
  {
    icon: '🤖',
    title: 'LLM / IA',
    description:
      'Gere títulos, descrições e tags otimizados com inteligência artificial integrada.',
  },
] as const;
// v0.1.0
