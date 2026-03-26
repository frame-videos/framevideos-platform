'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              F
            </div>
            <span className="text-xl font-bold">Frame Videos</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-gray-300 hover:text-white transition">
              Features
            </a>
            <a href="#pricing" className="text-sm text-gray-300 hover:text-white transition">
              Preços
            </a>
            <a href="#how-it-works" className="text-sm text-gray-300 hover:text-white transition">
              Como Funciona
            </a>
            <Link href="/auth/login" className="text-sm text-gray-300 hover:text-white transition">
              Login
            </Link>
            <Link
              href="/auth/register"
              className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
            >
              Comece Grátis
            </Link>
          </div>

          <button
            className="md:hidden p-2 text-gray-300 hover:text-white"
            onClick={() => setOpen(!open)}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={open ? 'M6 18L18 6M6 6l12 12' : 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5'}
              />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-gray-800 bg-[#0a0a0f]/95 backdrop-blur-lg">
          <div className="px-4 py-4 space-y-3">
            <a href="#features" className="block text-gray-300 hover:text-white py-2" onClick={() => setOpen(false)}>Features</a>
            <a href="#pricing" className="block text-gray-300 hover:text-white py-2" onClick={() => setOpen(false)}>Preços</a>
            <a href="#how-it-works" className="block text-gray-300 hover:text-white py-2" onClick={() => setOpen(false)}>Como Funciona</a>
            <Link href="/auth/login" className="block text-gray-300 hover:text-white py-2" onClick={() => setOpen(false)}>Login</Link>
            <Link
              href="/auth/register"
              className="block bg-primary-600 hover:bg-primary-700 text-white text-center font-semibold px-5 py-2.5 rounded-lg transition"
              onClick={() => setOpen(false)}
            >
              Comece Grátis
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
