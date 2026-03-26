import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/lib/query-provider';
import DomainBanner from '@/components/DomainBanner';

export const metadata: Metadata = {
  title: 'Frame Videos',
  description: 'SaaS de Edição de Vídeos',
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
      <body className="bg-gray-900 text-white">
        <QueryProvider>
          <DomainBanner />
          <nav className="bg-gray-800 border-b border-gray-700 p-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <h1 className="text-2xl font-bold">🎬 Frame Videos</h1>
              <div className="space-x-4">
                <a href="/" className="hover:text-gray-300">Home</a>
                <a href="/dashboard" className="hover:text-gray-300">Dashboard</a>
                <a href="/upload" className="hover:text-gray-300">Upload</a>
                <a href="/videos" className="hover:text-gray-300">Vídeos</a>
                <a href="/auth/login" className="hover:text-gray-300">Login</a>
              </div>
            </div>
          </nav>
          <main className="max-w-7xl mx-auto p-4">
            {children}
          </main>
        </QueryProvider>
      </body>
    </html>
  );
}
