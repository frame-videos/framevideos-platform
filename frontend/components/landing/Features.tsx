const features = [
  { icon: '🌐', title: 'Domínio Personalizado', description: 'Conecte seu próprio domínio e tenha uma marca profissional. SSL gratuito incluso.' },
  { icon: '▶️', title: 'Player Profissional', description: 'Player de vídeo otimizado com streaming adaptativo, thumbnails e proteção de conteúdo.' },
  { icon: '📊', title: 'Analytics Completo', description: 'Acompanhe views, receita, engajamento e comportamento do público em tempo real.' },
  { icon: '💰', title: 'Monetização', description: 'Assinaturas, pay-per-view e ads integrados. Receba pagamentos diretamente.' },
  { icon: '☁️', title: 'Upload Ilimitado', description: 'Envie vídeos sem limites de armazenamento. Transcodificação automática em múltiplas qualidades.' },
  { icon: '⚡', title: 'Painel Intuitivo', description: 'Gerencie tudo de um só lugar: vídeos, categorias, usuários, domínio e configurações.' },
];

export default function Features() {
  return (
    <section id="features" className="py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
            Tudo que você precisa para ter sucesso
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Ferramentas profissionais para criar, gerenciar e monetizar seu site de vídeos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <div
              key={i}
              className="group bg-gray-900/50 border border-gray-800 hover:border-primary-700/50 rounded-2xl p-6 transition-all duration-300 hover:bg-gray-900/80"
            >
              <div className="w-14 h-14 bg-primary-900/30 border border-primary-700/20 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
              <p className="text-gray-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
