const steps = [
  { number: '01', title: 'Crie sua conta', description: 'Cadastro gratuito em menos de 1 minuto. Sem cartão de crédito.' },
  { number: '02', title: 'Configure seu site', description: 'Conecte seu domínio, personalize o layout e faça upload dos seus vídeos.' },
  { number: '03', title: 'Publique e lucre', description: 'Ative a monetização, compartilhe seu site e comece a gerar receita.' },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-4 bg-gradient-to-b from-transparent via-primary-900/5 to-transparent">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">Como funciona</h2>
          <p className="text-gray-400 text-lg">Três passos simples para lançar seu site de vídeos.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div key={i} className="relative text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center text-2xl font-extrabold mx-auto mb-6 shadow-lg shadow-primary-600/20">
                {step.number}
              </div>
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-gradient-to-r from-primary-600/50 to-transparent" />
              )}
              <h3 className="text-xl font-bold mb-2">{step.title}</h3>
              <p className="text-gray-400">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
