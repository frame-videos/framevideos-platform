import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/lib/query-provider';
import DomainBanner from '@/components/DomainBanner';

export const metadata: Metadata = {
  title: 'Frame Videos — Crie seu site de vídeos adultos',
  description: 'Plataforma SaaS para criar e gerenciar sites de vídeos adultos com domínio personalizado, player profissional e analytics completo.',
  metadataBase: new URL('https://framevideos.com'),
  alternates: {
    canonical: '/',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-[#0a0a0f] text-white antialiased">
        <QueryProvider>
          <DomainBanner />
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
