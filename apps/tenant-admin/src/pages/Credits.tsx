import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/utils';

interface BalanceData {
  balance: number;
  totalCredited: number;
  totalDebited: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  operationType: string;
  referenceId: string | null;
  createdAt: string;
}

interface UsageEntry {
  id: string;
  operationType: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  creditsUsed: number;
  referenceId: string | null;
  createdAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const OPERATION_LABELS: Record<string, string> = {
  generate_title: '🎯 Gerar Título',
  generate_description: '📝 Gerar Descrição',
  generate_keywords: '🏷️ Gerar Keywords',
  generate_faq: '❓ Gerar FAQ',
  translate_content: '🌐 Traduzir Conteúdo',
  bulk_translate: '🌐 Tradução em Lote',
};

export function CreditsPage() {
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [usage, setUsage] = useState<UsageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'transactions' | 'usage'>('transactions');
  const [transPage, setTransPage] = useState(1);
  const [usagePage, setUsagePage] = useState(1);
  const [transPagination, setTransPagination] = useState({ total: 0, totalPages: 1 });
  const [usagePagination, setUsagePagination] = useState({ total: 0, totalPages: 1 });

  useEffect(() => {
    loadBalance();
    loadTransactions(1);
    loadUsage(1);
  }, []);

  async function loadBalance() {
    try {
      const data = await api<BalanceData>('/api/v1/credits/balance');
      setBalance(data);
    } catch (err) {
      console.error('Failed to load balance:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadTransactions(page: number) {
    try {
      const data = await api<PaginatedResponse<Transaction>>(`/api/v1/credits/transactions?page=${page}&limit=15`);
      setTransactions(data.data);
      setTransPagination({ total: data.pagination.total, totalPages: data.pagination.totalPages });
      setTransPage(page);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    }
  }

  async function loadUsage(page: number) {
    try {
      const data = await api<PaginatedResponse<UsageEntry>>(`/api/v1/credits/usage?page=${page}&limit=15`);
      setUsage(data.data);
      setUsagePagination({ total: data.pagination.total, totalPages: data.pagination.totalPages });
      setUsagePage(page);
    } catch (err) {
      console.error('Failed to load usage:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Créditos de IA</h1>

      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-400">Saldo Atual</p>
            <span className="text-xl">🪙</span>
          </div>
          <p className="text-3xl font-bold text-purple-400">
            {formatNumber(balance?.balance ?? 0)}
          </p>
          <p className="text-xs text-gray-500 mt-1">créditos disponíveis</p>
        </div>

        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-400">Total Recebido</p>
            <span className="text-xl">📥</span>
          </div>
          <p className="text-3xl font-bold text-green-400">
            {formatNumber(balance?.totalCredited ?? 0)}
          </p>
          <p className="text-xs text-gray-500 mt-1">créditos creditados</p>
        </div>

        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-400">Total Usado</p>
            <span className="text-xl">📤</span>
          </div>
          <p className="text-3xl font-bold text-orange-400">
            {formatNumber(balance?.totalDebited ?? 0)}
          </p>
          <p className="text-xs text-gray-500 mt-1">créditos consumidos</p>
        </div>
      </div>

      {/* Cost table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">💰 Tabela de Custos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { label: 'Gerar Título', cost: 2, icon: '🎯' },
            { label: 'Gerar Descrição', cost: 3, icon: '📝' },
            { label: 'Gerar Keywords', cost: 2, icon: '🏷️' },
            { label: 'Gerar FAQ', cost: 5, icon: '❓' },
            { label: 'Traduzir (por idioma)', cost: 3, icon: '🌐' },
            { label: 'Tradução em lote (por item/idioma)', cost: 2, icon: '📦' },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2">
                <span>{item.icon}</span>
                <span className="text-sm text-gray-300">{item.label}</span>
              </div>
              <span className="text-sm font-semibold text-purple-400">{item.cost} 🪙</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'transactions'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          📋 Transações ({transPagination.total})
        </button>
        <button
          onClick={() => setActiveTab('usage')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'usage'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          📊 Uso de IA ({usagePagination.total})
        </button>
      </div>

      {/* Transactions tab */}
      {activeTab === 'transactions' && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-lg mb-1">Nenhuma transação ainda</p>
              <p className="text-sm">Use as funcionalidades de IA para começar!</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left p-3 text-gray-400 font-medium">Data</th>
                      <th className="text-left p-3 text-gray-400 font-medium">Operação</th>
                      <th className="text-left p-3 text-gray-400 font-medium">Descrição</th>
                      <th className="text-right p-3 text-gray-400 font-medium">Créditos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t) => (
                      <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="p-3 text-gray-400 whitespace-nowrap">
                          {new Date(t.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="p-3">
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-300">
                            {OPERATION_LABELS[t.operationType] ?? t.operationType}
                          </span>
                        </td>
                        <td className="p-3 text-gray-300">{t.description}</td>
                        <td className={`p-3 text-right font-mono font-semibold ${t.type === 'debit' ? 'text-red-400' : 'text-green-400'}`}>
                          {t.type === 'debit' ? '-' : '+'}{t.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {transPagination.totalPages > 1 && (
                <div className="flex items-center justify-between p-3 border-t border-gray-800">
                  <span className="text-xs text-gray-500">
                    Página {transPage} de {transPagination.totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadTransactions(transPage - 1)}
                      disabled={transPage <= 1}
                      className="px-3 py-1 text-xs bg-gray-800 rounded disabled:opacity-30 hover:bg-gray-700"
                    >
                      ← Anterior
                    </button>
                    <button
                      onClick={() => loadTransactions(transPage + 1)}
                      disabled={transPage >= transPagination.totalPages}
                      className="px-3 py-1 text-xs bg-gray-800 rounded disabled:opacity-30 hover:bg-gray-700"
                    >
                      Próxima →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Usage tab */}
      {activeTab === 'usage' && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          {usage.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-lg mb-1">Nenhum uso de IA registrado</p>
              <p className="text-sm">Gere conteúdo com IA para ver o histórico aqui.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left p-3 text-gray-400 font-medium">Data</th>
                      <th className="text-left p-3 text-gray-400 font-medium">Operação</th>
                      <th className="text-left p-3 text-gray-400 font-medium">Modelo</th>
                      <th className="text-right p-3 text-gray-400 font-medium">Tokens (in/out)</th>
                      <th className="text-right p-3 text-gray-400 font-medium">Créditos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.map((u) => (
                      <tr key={u.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="p-3 text-gray-400 whitespace-nowrap">
                          {new Date(u.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="p-3">
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-300">
                            {OPERATION_LABELS[u.operationType] ?? u.operationType}
                          </span>
                        </td>
                        <td className="p-3 text-gray-400 font-mono text-xs">{u.model}</td>
                        <td className="p-3 text-right text-gray-400 font-mono text-xs">
                          {formatNumber(u.inputTokens)} / {formatNumber(u.outputTokens)}
                        </td>
                        <td className="p-3 text-right font-mono font-semibold text-purple-400">
                          {u.creditsUsed}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {usagePagination.totalPages > 1 && (
                <div className="flex items-center justify-between p-3 border-t border-gray-800">
                  <span className="text-xs text-gray-500">
                    Página {usagePage} de {usagePagination.totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadUsage(usagePage - 1)}
                      disabled={usagePage <= 1}
                      className="px-3 py-1 text-xs bg-gray-800 rounded disabled:opacity-30 hover:bg-gray-700"
                    >
                      ← Anterior
                    </button>
                    <button
                      onClick={() => loadUsage(usagePage + 1)}
                      disabled={usagePage >= usagePagination.totalPages}
                      className="px-3 py-1 text-xs bg-gray-800 rounded disabled:opacity-30 hover:bg-gray-700"
                    >
                      Próxima →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
