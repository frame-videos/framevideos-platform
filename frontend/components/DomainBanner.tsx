'use client';

import { useEffect, useState } from 'react';

export default function DomainBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Detectar se está em .pages.dev
    if (typeof window !== 'undefined' && window.location.hostname.includes('.pages.dev')) {
      setShowBanner(true);
    }
  }, []);

  if (!showBanner) return null;

  return (
    <div className="bg-yellow-600 text-black py-2 px-4 text-center text-sm font-medium">
      ⚠️ Você está acessando via domínio temporário. Use{' '}
      <a 
        href={`https://framevideos.com${window.location.pathname}`}
        className="underline font-bold hover:text-yellow-900"
      >
        framevideos.com
      </a>
      {' '}para a melhor experiência.
    </div>
  );
}
