import Link from 'next/link';

const footerLinks = {
  produto: [
    { label: 'Features', href: '#features' },
    { label: 'Preços', href: '#pricing' },
    { label: 'Como Funciona', href: '#how-it-works' },
  ],
  suporte: [
    { label: 'Central de Ajuda', href: '#' },
    { label: 'Documentação', href: '#' },
    { label: 'Contato', href: '#' },
  ],
  legal: [
    { label: 'Termos de Uso', href: '#' },
    { label: 'Privacidade', href: '#' },
    { label: 'DMCA', href: '#' },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-gray-800 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">
                F
              </div>
              <span className="font-bold">Frame Videos</span>
            </Link>
            <p className="text-sm text-gray-400 leading-relaxed">
              A plataforma mais completa para criar e monetizar sites de vídeos adultos.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-3">Produto</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              {footerLinks.produto.map((link, i) => (
                <li key={i}>
                  <a href={link.href} className="hover:text-white transition">{link.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-3">Suporte</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              {footerLinks.suporte.map((link, i) => (
                <li key={i}>
                  <a href={link.href} className="hover:text-white transition">{link.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-3">Legal</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              {footerLinks.legal.map((link, i) => (
                <li key={i}>
                  <a href={link.href} className="hover:text-white transition">{link.label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Frame Videos. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
