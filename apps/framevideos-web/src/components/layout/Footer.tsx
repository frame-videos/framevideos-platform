import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-dark-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
                <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="8,4 8,20 20,12" />
                </svg>
              </div>
              <span className="text-lg font-bold text-white">Frame Videos</span>
            </Link>
            <p className="text-sm text-dark-400 leading-relaxed">
              A plataforma mais completa para criar e gerenciar sites de vídeos adultos.
            </p>
          </div>

          {/* Produto */}
          <div>
            <h4 className="text-sm font-semibold text-dark-100 mb-4">Produto</h4>
            <ul className="space-y-2">
              <li>
                <a href="#features" className="text-sm text-dark-400 hover:text-primary-400 transition-colors">
                  Recursos
                </a>
              </li>
              <li>
                <a href="#pricing" className="text-sm text-dark-400 hover:text-primary-400 transition-colors">
                  Preços
                </a>
              </li>
              <li>
                <Link to="/signup" className="text-sm text-dark-400 hover:text-primary-400 transition-colors">
                  Criar Conta
                </Link>
              </li>
            </ul>
          </div>

          {/* Suporte */}
          <div>
            <h4 className="text-sm font-semibold text-dark-100 mb-4">Suporte</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-sm text-dark-400 hover:text-primary-400 transition-colors">
                  Central de Ajuda
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-dark-400 hover:text-primary-400 transition-colors">
                  Documentação
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-dark-400 hover:text-primary-400 transition-colors">
                  Contato
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-dark-100 mb-4">Legal</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-sm text-dark-400 hover:text-primary-400 transition-colors">
                  Termos de Uso
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-dark-400 hover:text-primary-400 transition-colors">
                  Privacidade
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-dark-400 hover:text-primary-400 transition-colors">
                  DMCA
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-dark-500">
            &copy; {new Date().getFullYear()} Frame Videos. Todos os direitos reservados.
          </p>
          <p className="text-sm text-dark-500">
            Feito com 💜 para criadores de conteúdo
          </p>
        </div>
      </div>
    </footer>
  );
}
