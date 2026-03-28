import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import * as domainsApi from '@/api/domains';
import type {
  DomainItem,
  AddDomainResponse,
  VerifyDomainResponse,
  DomainLimits,
} from '@/api/domains';

// ─── Status helpers ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'default' }
> = {
  active: { label: 'Ativo', variant: 'success' },
  pending_verification: { label: 'Pendente', variant: 'warning' },
  failed: { label: 'Falhou', variant: 'danger' },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? { label: status, variant: 'default' as const };
}

// ─── Add Domain Modal ────────────────────────────────────────────────────────

function AddDomainModal({
  isOpen,
  onClose,
  onSuccess,
  limits,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: AddDomainResponse) => void;
  limits: DomainLimits | null;
}) {
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleaned = domain.trim().toLowerCase();
    if (!cleaned) {
      setError('Informe o domínio');
      return;
    }

    // Validação básica no frontend
    if (cleaned.includes('://')) {
      setError('Não inclua o protocolo (http:// ou https://)');
      return;
    }

    if (cleaned.includes('/')) {
      setError('Não inclua caminhos no domínio');
      return;
    }

    setLoading(true);
    try {
      const result = await domainsApi.addDomain(cleaned);
      onSuccess(result);
      setDomain('');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erro ao adicionar domínio';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setDomain('');
    setError('');
    onClose();
  };

  const limitReached =
    limits && limits.max !== -1 && limits.current >= limits.max;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Adicionar Domínio" size="lg">
      {limitReached ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-yellow-600/30 bg-yellow-600/10 p-4">
            <p className="text-sm text-yellow-300">
              ⚠️ Você atingiu o limite de {limits.max} domínio
              {limits.max > 1 ? 's' : ''} do plano{' '}
              <strong className="capitalize">{limits.plan}</strong>.
            </p>
            <p className="text-sm text-yellow-300/80 mt-1">
              Faça upgrade do seu plano para adicionar mais domínios.
            </p>
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={handleClose}>
              Fechar
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <p className="text-sm text-dark-300 mb-3">
              Conecte seu próprio domínio para que seus visitantes acessem seu site por um endereço personalizado.
            </p>
            <Input
              label="Qual é o seu domínio?"
              placeholder="meusitedevideos.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              error={error}
              hint="Exemplo: meusitedevideos.com — sem http:// e sem www"
            />
          </div>

          <div className="rounded-xl border border-primary-600/20 bg-primary-600/5 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">📋</span>
              <p className="text-sm font-semibold text-white">
                Como funciona? É simples!
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-600/20 text-primary-400 text-xs font-bold shrink-0">1</span>
                <div>
                  <p className="text-sm text-white font-medium">Adicione seu domínio aqui</p>
                  <p className="text-xs text-dark-400">Digite o endereço que você comprou (ex: meusitedevideos.com)</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-600/20 text-primary-400 text-xs font-bold shrink-0">2</span>
                <div>
                  <p className="text-sm text-white font-medium">Configure o apontamento no seu provedor</p>
                  <p className="text-xs text-dark-400">Vamos te mostrar exatamente o que copiar e colar — leva 2 minutos</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-600/20 text-primary-400 text-xs font-bold shrink-0">3</span>
                <div>
                  <p className="text-sm text-white font-medium">Clique em "Verificar" e pronto!</p>
                  <p className="text-xs text-dark-400">Confirmamos automaticamente que tudo está certo</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" type="button" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={loading}>
              Adicionar Domínio
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// ─── DNS Instructions Modal ──────────────────────────────────────────────────

function DnsInstructionsModal({
  isOpen,
  onClose,
  addResult,
}: {
  isOpen: boolean;
  onClose: () => void;
  addResult: AddDomainResponse | null;
}) {
  if (!addResult) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🎉 Domínio adicionado!" size="lg">
      <div className="space-y-6">
        <div className="rounded-xl border border-green-600/30 bg-green-600/10 p-4">
          <p className="text-sm text-green-300">
            ✅ <strong>{addResult.domain}</strong> foi adicionado com sucesso! Agora siga as instruções abaixo para conectá-lo.
          </p>
        </div>

        {/* Instruções amigáveis */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-600/20 text-primary-400 text-sm font-bold">1</span>
            <h3 className="text-base font-semibold text-white">
              Acesse o painel do seu domínio
            </h3>
          </div>
          <div className="ml-10 rounded-xl border border-border bg-dark-800/30 p-4">
            <p className="text-sm text-dark-300 mb-3">
              Entre no site onde você <strong className="text-white">comprou seu domínio</strong> (exemplos: GoDaddy, Namecheap, Registro.br, Hostgator, Cloudflare) e procure a seção de <strong className="text-white">DNS</strong> ou <strong className="text-white">Zona DNS</strong>.
            </p>
            <p className="text-xs text-dark-500">
              💡 Geralmente fica em: Painel → Domínios → Gerenciar → DNS / Zona DNS / Registros DNS
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-600/20 text-primary-400 text-sm font-bold">2</span>
            <h3 className="text-base font-semibold text-white">
              Crie um novo registro DNS
            </h3>
          </div>
          <div className="ml-10 rounded-xl border border-border bg-dark-800/30 p-4 space-y-4">
            <p className="text-sm text-dark-300">
              Clique em <strong className="text-white">"Adicionar registro"</strong> ou <strong className="text-white">"Add record"</strong> e preencha assim:
            </p>
            
            <div className="rounded-lg bg-dark-900/80 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-dark-500 mb-1">📌 Tipo (Type)</p>
                  <div className="bg-dark-700 rounded-lg px-3 py-2">
                    <p className="text-white font-mono font-bold text-lg">CNAME</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-dark-500 mb-1">📝 Nome (Host)</p>
                  <div className="bg-dark-700 rounded-lg px-3 py-2 flex items-center justify-between">
                    <p className="text-white font-mono font-bold text-lg">@</p>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText('@')}
                      className="text-dark-400 hover:text-white transition-colors"
                      title="Copiar"
                    >
                      📋
                    </button>
                  </div>
                  <p className="text-xs text-dark-500 mt-1">ou deixe vazio</p>
                </div>
                <div>
                  <p className="text-xs text-dark-500 mb-1">🎯 Destino (Target / Value)</p>
                  <CopyableField value={addResult.cnameTarget} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-blue-600/20 bg-blue-600/5 p-3">
              <p className="text-xs text-blue-300">
                💡 <strong>Dica:</strong> Se o seu provedor pedir "TTL", pode deixar o padrão (automático ou 3600).
                Se não aceitar "@" no campo Nome, tente deixar vazio ou colocar <code className="bg-dark-700 px-1 rounded">{addResult.domain}</code>.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-600/20 text-primary-400 text-sm font-bold">3</span>
            <h3 className="text-base font-semibold text-white">
              Volte aqui e clique em "Verificar DNS"
            </h3>
          </div>
          <div className="ml-10 rounded-xl border border-border bg-dark-800/30 p-4">
            <p className="text-sm text-dark-300">
              Depois de salvar o registro DNS, volte para esta página e clique no botão <strong className="text-primary-400">"Verificar DNS"</strong> ao lado do seu domínio.
            </p>
            <p className="text-xs text-dark-500 mt-2">
              ⏱️ <strong>Importante:</strong> Alterações de DNS podem levar de <strong>5 minutos até 24 horas</strong> para funcionar. Se não verificar na primeira tentativa, espere um pouco e tente novamente.
            </p>
          </div>
        </div>

        {/* Verificação alternativa (avançado) */}
        <details className="group">
          <summary className="cursor-pointer text-xs text-dark-500 hover:text-dark-300 transition-colors flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform">▶</span>
            Método alternativo (avançado): Verificação via TXT
          </summary>
          <div className="mt-3 ml-4 rounded-lg border border-border bg-dark-800/30 p-4 space-y-3">
            <p className="text-xs text-dark-400">
              Se preferir, você pode verificar seu domínio criando um registro TXT em vez do CNAME:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-dark-500 mb-1">Nome / Host</p>
                <CopyableField value={addResult.txtRecord.host} />
              </div>
              <div>
                <p className="text-xs text-dark-500 mb-1">Valor</p>
                <CopyableField value={addResult.txtRecord.value} />
              </div>
            </div>
          </div>
        </details>

        {/* SSL Note */}
        <div className="rounded-xl border border-yellow-600/20 bg-yellow-600/5 p-4">
          <p className="text-sm text-yellow-300/90">
            <strong>🔒 Sobre o cadeado de segurança (SSL):</strong>
          </p>
          <p className="text-xs text-yellow-300/70 mt-1">
            Para que seu site tenha o cadeado de segurança (HTTPS), recomendamos usar o <strong>Cloudflare</strong> (gratuito) como provedor DNS do seu domínio. Subdomínios <code className="bg-dark-700 px-1 rounded">.framevideos.com</code> já possuem SSL automático.
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={onClose}>✅ Entendi, vou configurar!</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Verify Result Modal ─────────────────────────────────────────────────────

function VerifyResultModal({
  isOpen,
  onClose,
  result,
  domainName,
}: {
  isOpen: boolean;
  onClose: () => void;
  result: VerifyDomainResponse | null;
  domainName: string;
}) {
  if (!result) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={result.verified ? 'Domínio Verificado!' : 'Verificação Pendente'}
    >
      <div className="space-y-5">
        {result.verified ? (
          <>
            <div className="text-center py-4">
              <span className="text-5xl">🎉</span>
              <h3 className="text-xl font-bold text-white mt-3">Tudo certo!</h3>
              <p className="text-sm text-dark-300 mt-2">
                O domínio <strong className="text-primary-400">{domainName}</strong> foi conectado com sucesso ao seu site!
              </p>
            </div>
            <div className="rounded-xl border border-green-600/30 bg-green-600/10 p-4">
              <p className="text-sm text-green-300">
                ✅ Seu site agora está acessível em <strong>https://{domainName}</strong>
              </p>
            </div>
            {result.sslNote && (
              <div className="rounded-xl border border-yellow-600/20 bg-yellow-600/5 p-3">
                <p className="text-xs text-yellow-300/80">
                  🔒 {result.sslNote}
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="text-center py-2">
              <span className="text-4xl">⏳</span>
              <h3 className="text-lg font-bold text-white mt-2">Ainda não detectamos a configuração</h3>
            </div>

            <div className="rounded-xl border border-orange-600/20 bg-orange-600/5 p-4 space-y-3">
              <p className="text-sm text-dark-300">
                Não se preocupe! Isso pode acontecer por dois motivos:
              </p>
              <ul className="space-y-2 text-sm text-dark-400">
                <li className="flex gap-2">
                  <span>⏱️</span>
                  <span><strong className="text-white">O DNS ainda está propagando</strong> — alterações podem levar de 5 minutos a 24 horas. Tente novamente em alguns minutos.</span>
                </li>
                <li className="flex gap-2">
                  <span>⚙️</span>
                  <span><strong className="text-white">O registro não foi criado ainda</strong> — acesse o painel do seu provedor de domínio e crie o registro conforme as instruções.</span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-dark-800/30 p-4">
              <p className="text-sm font-medium text-white mb-2">📋 Lembrete: o que você precisa configurar</p>
              <div className="rounded-lg bg-dark-900/80 p-3">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-dark-500">Tipo</p>
                    <p className="text-white font-mono font-bold">CNAME</p>
                  </div>
                  <div>
                    <p className="text-xs text-dark-500">Nome</p>
                    <p className="text-white font-mono font-bold">@</p>
                  </div>
                  <div>
                    <p className="text-xs text-dark-500">Destino</p>
                    <p className="text-primary-400 font-mono text-xs break-all">{result.cnameCheck?.expected || 'sites.framevideos.com'}</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end">
          <Button onClick={onClose}>{result.verified ? '🎉 Fechar' : 'Entendi, vou tentar novamente'}</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Copyable Field ──────────────────────────────────────────────────────────

function CopyableField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback pra browsers sem clipboard API
    }
  };

  return (
    <div className="flex items-center gap-2">
      <code className="text-primary-400 bg-dark-700 px-2 py-1 rounded text-sm flex-1 break-all">
        {value}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        className="text-dark-400 hover:text-dark-200 transition-colors shrink-0 cursor-pointer"
        title="Copiar"
      >
        {copied ? (
          <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        )}
      </button>
    </div>
  );
}

// ─── Confirm Delete Modal ────────────────────────────────────────────────────

function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  domain,
  loading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  domain: string;
  loading: boolean;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Remover Domínio" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-dark-300">
          Tem certeza que deseja remover <strong className="text-white">{domain}</strong>?
        </p>
        <p className="text-xs text-dark-500">
          O domínio será desconectado da sua conta. Você poderá adicioná-lo
          novamente depois.
        </p>
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            Remover
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Domain Card ─────────────────────────────────────────────────────────────

function DomainCard({
  domain,
  onVerify,
  onDelete,
  onSetPrimary,
  verifying,
}: {
  domain: DomainItem;
  onVerify: (id: string) => void;
  onDelete: (id: string, domainName: string) => void;
  onSetPrimary: (id: string) => void;
  verifying: string | null;
}) {
  const statusConfig = getStatusConfig(domain.status);
  const isVerifying = verifying === domain.id;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Domain info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="text-sm font-semibold text-white truncate">
              {domain.domain}
            </h4>
            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            {domain.isPrimary && (
              <Badge variant="primary">Primário</Badge>
            )}
          </div>
          {domain.verifiedAt && (
            <p className="text-xs text-dark-500">
              Verificado em{' '}
              {new Date(domain.verifiedAt).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {domain.status === 'pending_verification' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onVerify(domain.id)}
              loading={isVerifying}
            >
              {isVerifying ? 'Verificando...' : '🔍 Verificar DNS'}
            </Button>
          )}

          {domain.status === 'active' && !domain.isPrimary && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onSetPrimary(domain.id)}
            >
              ⭐ Tornar primário
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(domain.id, domain.domain)}
            className="text-red-400 hover:text-red-300"
          >
            🗑️ Remover
          </Button>
        </div>
      </div>

      {/* Instructions for pending domains */}
      {domain.status === 'pending_verification' && (
        <div className="mt-4 rounded-lg border border-yellow-600/20 bg-yellow-600/5 p-4 space-y-2">
          <p className="text-sm text-yellow-300/90 font-medium">
            ⏳ Aguardando configuração
          </p>
          <p className="text-xs text-dark-400">
            Acesse o painel do seu provedor de domínio (onde você comprou o domínio) e crie um registro DNS com estas informações:
          </p>
          <div className="rounded-lg bg-dark-900/60 p-3 grid grid-cols-3 gap-2">
            <div>
              <p className="text-xs text-dark-500">Tipo</p>
              <p className="text-white font-mono font-bold text-sm">CNAME</p>
            </div>
            <div>
              <p className="text-xs text-dark-500">Nome</p>
              <p className="text-white font-mono font-bold text-sm">@</p>
            </div>
            <div>
              <p className="text-xs text-dark-500">Destino</p>
              <CopyableField value="sites.framevideos.com" />
            </div>
          </div>
          <p className="text-xs text-dark-500">
            Depois de configurar, clique em <strong className="text-primary-400">"🔍 Verificar DNS"</strong> acima.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function Sites() {
  // State
  const [domainsList, setDomainsList] = useState<DomainItem[]>([]);
  const [subdomain, setSubdomain] = useState<string | null>(null);
  const [limits, setLimits] = useState<DomainLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Action state
  const [addResult, setAddResult] = useState<AddDomainResponse | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyDomainResponse | null>(null);
  const [verifyDomainName, setVerifyDomainName] = useState('');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [deleteDomain, setDeleteDomain] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ─── Load domains ──────────────────────────────────────────────────────────

  const fetchDomains = useCallback(async () => {
    try {
      setError('');
      const data = await domainsApi.listDomains();
      setDomainsList(data.domains);
      setSubdomain(data.subdomain);
      setLimits(data.limits);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erro ao carregar domínios';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleAddSuccess = (data: AddDomainResponse) => {
    setAddResult(data);
    setShowAddModal(false);
    setShowInstructionsModal(true);
    fetchDomains(); // Refresh list
  };

  const handleVerify = async (id: string) => {
    const domain = domainsList.find((d) => d.id === id);
    if (!domain) return;

    setVerifyingId(id);
    try {
      const result = await domainsApi.verifyDomain(id);
      setVerifyResult(result);
      setVerifyDomainName(domain.domain);
      setShowVerifyModal(true);

      if (result.verified) {
        fetchDomains(); // Refresh list
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erro ao verificar domínio';
      setVerifyResult({
        verified: false,
        status: 'error',
        message,
      });
      setVerifyDomainName(domain.domain);
      setShowVerifyModal(true);
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteDomain({ id, name });
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDomain) return;

    setDeleting(true);
    try {
      await domainsApi.removeDomain(deleteDomain.id);
      setShowDeleteModal(false);
      setDeleteDomain(null);
      fetchDomains();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erro ao remover domínio';
      setError(message);
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleSetPrimary = async (id: string) => {
    try {
      await domainsApi.setPrimaryDomain(id);
      fetchDomains();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erro ao definir domínio primário';
      setError(message);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Meus Domínios</h1>
        <p className="text-sm text-dark-400 mt-1">
          Gerencie os domínios conectados ao seu site.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-600/30 bg-red-600/10 p-4">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Subdomain automático */}
      {subdomain && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-semibold text-white">
                  Subdomínio gratuito
                </h3>
                <Badge variant="success">Sempre ativo</Badge>
              </div>
              <p className="text-xs text-dark-400">
                Seu site está acessível em:
              </p>
              <a
                href={`https://${subdomain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary-400 hover:text-primary-300 transition-colors font-mono"
              >
                {subdomain} ↗
              </a>
            </div>
            <Badge variant="primary">Incluso no plano</Badge>
          </div>
        </div>
      )}

      {/* Domain limit info */}
      {limits && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-dark-400">
            {limits.max === -1 ? (
              <>Domínios personalizados: {limits.current} (ilimitado)</>
            ) : (
              <>
                Domínios personalizados: {limits.current}/{limits.max} (plano{' '}
                <span className="capitalize">{limits.plan}</span>)
              </>
            )}
          </p>
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            + Adicionar Domínio
          </Button>
        </div>
      )}

      {/* Domains list */}
      {domainsList.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <div className="text-5xl mb-4">🌐</div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Nenhum domínio personalizado
          </h3>
          <p className="text-sm text-dark-400 mb-6 max-w-md mx-auto">
            Conecte seu próprio domínio para ter uma URL personalizada.
            {subdomain && (
              <>
                {' '}
                Enquanto isso, seu site está acessível em{' '}
                <strong className="text-primary-400">{subdomain}</strong>.
              </>
            )}
          </p>
          <Button onClick={() => setShowAddModal(true)}>
            + Adicionar Domínio
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {domainsList.map((domain) => (
            <DomainCard
              key={domain.id}
              domain={domain}
              onVerify={handleVerify}
              onDelete={handleDeleteClick}
              onSetPrimary={handleSetPrimary}
              verifying={verifyingId}
            />
          ))}
        </div>
      )}

      {/* SSL Info */}
      <div className="rounded-xl border border-dark-600/30 bg-dark-800/20 p-5">
        <div className="flex items-start gap-3">
          <span className="text-lg">🔒</span>
          <div>
            <p className="text-sm font-medium text-dark-300 mb-1">
              Sobre o cadeado de segurança (HTTPS)
            </p>
            <p className="text-xs text-dark-500 leading-relaxed">
              Para que seu domínio personalizado tenha o cadeado de segurança (HTTPS), recomendamos usar o <strong className="text-dark-400">Cloudflare</strong> como provedor DNS do seu domínio — é gratuito e leva 5 minutos para configurar. Subdomínios <code className="text-dark-400">.framevideos.com</code> já possuem HTTPS automático.
            </p>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddDomainModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleAddSuccess}
        limits={limits}
      />

      <DnsInstructionsModal
        isOpen={showInstructionsModal}
        onClose={() => setShowInstructionsModal(false)}
        addResult={addResult}
      />

      <VerifyResultModal
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        result={verifyResult}
        domainName={verifyDomainName}
      />

      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteDomain(null);
        }}
        onConfirm={handleDeleteConfirm}
        domain={deleteDomain?.name ?? ''}
        loading={deleting}
      />
    </div>
  );
}

export default Sites;
