import Link from 'next/link';

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 px-4 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary-900/20 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <div className="inline-flex items-center gap-2 bg-primary-900/30 border border-primary-700/30 text-primary-300 text-sm font-medium px-4 py-1.5 rounded-full mb-8">
          <span className="w-2 h-2 bg-primary-400 rounded-full animate-pulse" />
          Plataforma #1 para sites de vídeos adultos
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
          Lance seu site de vídeos{' '}
          <span className="gradient-text">adultos em minutos</span>
        </h1>

        <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Crie, gerencie e monetize seu próprio site de vídeos com domínio personalizado.
          Player profissional, analytics completo e monetização integrada.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/auth/register"
            className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-white font-bold px-8 py-4 rounded-xl text-lg transition animate-pulse-glow"
          >
            Comece Grátis →
          </Link>
          <a
            href="#how-it-works"
            className="w-full sm:w-auto border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-semibold px-8 py-4 rounded-xl text-lg transition text-center"
          >
            Veja como funciona
          </a>
        </div>
      </div>
    </section>
  );
}
