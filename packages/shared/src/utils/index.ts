// Utilitários compartilhados — funções puras, sem dependências externas

/**
 * Gera um ULID (Universally Unique Lexicographically Sortable Identifier).
 * Implementação leve usando timestamp + random, compatível com Cloudflare Workers.
 */
export function generateUlid(): string {
  const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const ENCODING_LEN = ENCODING.length;
  const TIME_LEN = 10;
  const RANDOM_LEN = 16;

  let now = Date.now();
  const timeChars: string[] = new Array(TIME_LEN);
  for (let i = TIME_LEN - 1; i >= 0; i--) {
    timeChars[i] = ENCODING[now % ENCODING_LEN]!;
    now = Math.floor(now / ENCODING_LEN);
  }

  const randomChars: string[] = new Array(RANDOM_LEN);
  const randomBytes = new Uint8Array(RANDOM_LEN);
  crypto.getRandomValues(randomBytes);
  for (let i = 0; i < RANDOM_LEN; i++) {
    randomChars[i] = ENCODING[randomBytes[i]! % ENCODING_LEN]!;
  }

  return timeChars.join('') + randomChars.join('');
}

/**
 * Converte texto em slug URL-safe.
 * Remove acentos, converte pra minúscula, substitui espaços por hífens.
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // remove caracteres especiais
    .replace(/[\s_]+/g, '-') // espaços e underscores viram hífen
    .replace(/-+/g, '-') // múltiplos hífens viram um
    .replace(/^-|-$/g, ''); // remove hífens no início/fim
}

/**
 * Formata data para ISO 8601.
 */
export function formatDate(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString();
}

/**
 * Valida formato de email.
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Hash simples de string (FNV-1a 32-bit) — pra dedup, NÃO pra segurança.
 */
export function hashString(str: string): string {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Trunca string no comprimento máximo, adicionando "..." se necessário.
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Remove chaves específicas de um objeto.
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

/**
 * Seleciona apenas chaves específicas de um objeto.
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}
