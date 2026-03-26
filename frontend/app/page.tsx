'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:8787/health')
      .then(res => res.json())
      .then(data => {
        setHealth(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-8">
      <div className="text-center py-12">
        <h1 className="text-5xl font-bold mb-4">
          🎬 Frame Videos
        </h1>
        <p className="text-xl text-gray-400">
          Plataforma de Edição de Vídeos - MVP em Desenvolvimento
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-2xl font-bold mb-2">✅ Backend Status</h2>
          {loading ? (
            <p className="text-gray-400">Carregando...</p>
          ) : health ? (
            <div className="space-y-2">
              <p className="text-green-400">🟢 Online</p>
              <p className="text-sm text-gray-400">Env: {health.environment}</p>
              <p className="text-sm text-gray-400">Time: {new Date(health.timestamp).toLocaleTimeString()}</p>
            </div>
          ) : (
            <p className="text-red-400">🔴 Offline</p>
          )}
        </div>

        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-2xl font-bold mb-2">🎥 Vídeos</h2>
          <p className="text-gray-400">0 vídeos cadastrados</p>
          <button className="mt-4 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded">
            Upload Vídeo
          </button>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-2xl font-bold mb-2">👥 Usuários</h2>
          <p className="text-gray-400">Sistema de auth em construção</p>
          <button className="mt-4 bg-green-600 hover:bg-green-700 px-4 py-2 rounded">
            Criar Conta
          </button>
        </div>
      </div>

      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-2xl font-bold mb-4">📋 Progresso do MVP</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-green-400">✅</span>
            <span>[1.1] Setup Inicial do Repositório</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-green-400">✅</span>
            <span>[1.2] Cloudflare Workers Setup</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-green-400">✅</span>
            <span>[12.1] Frontend Setup (Next.js)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-yellow-400">🚧</span>
            <span>[2.1] JWT Authentication System</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-500">⏳</span>
            <span>[4.1] Video CRUD API</span>
          </div>
        </div>
      </div>
    </div>
  );
}
