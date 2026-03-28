import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 border-b border-border/50 bg-dark-950/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="8,4 8,20 20,12" />
              </svg>
            </div>
            <span className="text-lg font-bold text-white">Frame Videos</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-dark-300 hover:text-white transition-colors">
              Recursos
            </a>
            <a href="#pricing" className="text-sm text-dark-300 hover:text-white transition-colors">
              Preços
            </a>
            <Link to="/login" className="text-sm text-dark-300 hover:text-white transition-colors">
              Entrar
            </Link>
            <Link to="/signup">
              <Button size="sm">Começar Grátis</Button>
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-dark-300 hover:text-white cursor-pointer"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      <div
        className={cn(
          'md:hidden border-t border-border/50 bg-dark-950/95 backdrop-blur-xl transition-all duration-300 overflow-hidden',
          mobileOpen ? 'max-h-64 py-4' : 'max-h-0',
        )}
      >
        <div className="flex flex-col gap-3 px-4">
          <a
            href="#features"
            className="text-sm text-dark-300 hover:text-white transition-colors py-2"
            onClick={() => setMobileOpen(false)}
          >
            Recursos
          </a>
          <a
            href="#pricing"
            className="text-sm text-dark-300 hover:text-white transition-colors py-2"
            onClick={() => setMobileOpen(false)}
          >
            Preços
          </a>
          <Link
            to="/login"
            className="text-sm text-dark-300 hover:text-white transition-colors py-2"
            onClick={() => setMobileOpen(false)}
          >
            Entrar
          </Link>
          <Link to="/signup" onClick={() => setMobileOpen(false)}>
            <Button size="sm" className="w-full">Começar Grátis</Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
