// AI generation routes — Sprint 8
// SEO title, description, keywords, FAQ generation + content translation

import { Hono } from 'hono';
import type { AppContext } from '../env.js';
import { D1Client } from '@frame-videos/db';
import { authMiddleware } from '@frame-videos/auth';
import { generateUlid } from '@frame-videos/shared/utils';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@frame-videos/shared/errors';
import {
  callLlm,
  generateVideoTitle,
  generateVideoDescription,
  generateVideoKeywords,
  generateVideoFAQ,
  translateContent,
  OPERATION_COSTS,
} from '../llm/index.js';
import type { LlmConfig, VideoInfo } from '../llm/index.js';
import { requireCredits, debitCredits, logLlmUsage } from './credits.js';

const ai = new Hono<AppContext>();

// ─── Auth middleware ─────────────────────────────────────────────────────────

ai.use('*', async (c, next) => {
  return authMiddleware(c.env.JWT_SECRET)(c, next);
});

ai.use('*', async (c, next) => {
  const role = c.get('userRole');
  if (role !== 'tenant_admin' && role !== 'super_admin') {
    throw new ForbiddenError('Apenas administradores podem usar funcionalidades de IA');
  }
  await next();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getLlmConfig(env: AppContext['Bindings']): LlmConfig {
  if (!env.LLM_API_KEY) {
    throw new ValidationError('LLM não configurado. Configure LLM_API_KEY no ambiente.');
  }

  return {
    provider: (env.LLM_PROVIDER as 'openai' | 'anthropic') || 'openai',
    apiKey: env.LLM_API_KEY,
    model: env.LLM_MODEL || 'gpt-4o-mini',
  };
}

/**
 * Fetch video info with all associations for prompt context.
 */
async function fetchVideoInfo(db: D1Client, videoId: string, tenantId: string): Promise<VideoInfo & { locale: string }> {
  const tenant = await db.queryOne<{ default_locale: string }>(
    'SELECT default_locale FROM tenants WHERE id = ?',
    [tenantId],
  );
  const locale = tenant?.default_locale ?? 'pt_BR';

  const video = await db.queryOne<{
    id: string; title: string | null; description: string | null;
    duration_seconds: number | null;
  }>(
    `SELECT v.id, vt.title, vt.description, v.duration_seconds
     FROM videos v
     LEFT JOIN video_translations vt ON vt.video_id = v.id AND vt.locale = ?
     WHERE v.id = ? AND v.tenant_id = ?`,
    [locale, videoId, tenantId],
  );

  if (!video) throw new NotFoundError('Video', videoId);

  const categories = await db.query<{ name: string }>(
    `SELECT ct.name FROM video_categories vc
     JOIN categories c ON c.id = vc.category_id
     LEFT JOIN category_translations ct ON ct.category_id = c.id AND ct.locale = ?
     WHERE vc.video_id = ?`,
    [locale, videoId],
  );

  const tags = await db.query<{ name: string }>(
    `SELECT tt.name FROM video_tags vt
     JOIN tags t ON t.id = vt.tag_id
     LEFT JOIN tag_translations tt ON tt.tag_id = t.id AND tt.locale = ?
     WHERE vt.video_id = ?`,
    [locale, videoId],
  );

  const performers = await db.query<{ name: string }>(
    `SELECT pt.name FROM video_performers vp
     JOIN performers p ON p.id = vp.performer_id
     LEFT JOIN performer_translations pt ON pt.performer_id = p.id AND pt.locale = ?
     WHERE vp.video_id = ?`,
    [locale, videoId],
  );

  const channels = await db.query<{ name: string }>(
    `SELECT cht.name FROM video_channels vc
     JOIN channels ch ON ch.id = vc.channel_id
     LEFT JOIN channel_translations cht ON cht.channel_id = ch.id AND cht.locale = ?
     WHERE vc.video_id = ?`,
    [locale, videoId],
  );

  return {
    title: video.title ?? undefined,
    description: video.description ?? undefined,
    categories: categories.map((c) => c.name).filter(Boolean),
    tags: tags.map((t) => t.name).filter(Boolean),
    performers: performers.map((p) => p.name).filter(Boolean),
    channel: channels[0]?.name ?? undefined,
    durationSeconds: video.duration_seconds ?? undefined,
    locale,
  };
}

// ─── POST /ai/generate/title ────────────────────────────────────────────────

ai.post('/generate/title', async (c) => {
  const tenantId = c.get('tenantId')!;
  const body = await c.req.json();

  if (!body.videoId) throw new ValidationError('Campo "videoId" é obrigatório');

  const db = new D1Client(c.env.DB);
  const cost = OPERATION_COSTS.generate_title;

  // Check credits
  await requireCredits(db, tenantId, cost);

  // Fetch video info
  const videoInfo = await fetchVideoInfo(db, body.videoId, tenantId);

  // Generate
  const config = getLlmConfig(c.env);
  const prompt = generateVideoTitle(videoInfo);
  const result = await callLlm(config, {
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    temperature: 0.8,
    maxTokens: 256,
  });

  const generatedTitle = result.text.trim().replace(/^["']|["']$/g, '');

  // Debit credits + log usage
  await debitCredits(db, tenantId, cost, 'generate_title', body.videoId);
  await logLlmUsage(db, tenantId, 'generate_title', result.model, result.inputTokens, result.outputTokens, cost, body.videoId);

  return c.json({
    title: generatedTitle,
    creditsUsed: cost,
    tokens: { input: result.inputTokens, output: result.outputTokens },
  });
});

// ─── POST /ai/generate/description ──────────────────────────────────────────

ai.post('/generate/description', async (c) => {
  const tenantId = c.get('tenantId')!;
  const body = await c.req.json();

  if (!body.videoId) throw new ValidationError('Campo "videoId" é obrigatório');

  const db = new D1Client(c.env.DB);
  const cost = OPERATION_COSTS.generate_description;

  await requireCredits(db, tenantId, cost);

  const videoInfo = await fetchVideoInfo(db, body.videoId, tenantId);
  const config = getLlmConfig(c.env);
  const prompt = generateVideoDescription(videoInfo);

  const result = await callLlm(config, {
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    temperature: 0.7,
    maxTokens: 512,
  });

  const generatedDescription = result.text.trim().replace(/^["']|["']$/g, '');

  await debitCredits(db, tenantId, cost, 'generate_description', body.videoId);
  await logLlmUsage(db, tenantId, 'generate_description', result.model, result.inputTokens, result.outputTokens, cost, body.videoId);

  return c.json({
    description: generatedDescription,
    creditsUsed: cost,
    tokens: { input: result.inputTokens, output: result.outputTokens },
  });
});

// ─── POST /ai/generate/keywords ─────────────────────────────────────────────

ai.post('/generate/keywords', async (c) => {
  const tenantId = c.get('tenantId')!;
  const body = await c.req.json();

  if (!body.videoId) throw new ValidationError('Campo "videoId" é obrigatório');

  const db = new D1Client(c.env.DB);
  const cost = OPERATION_COSTS.generate_keywords;

  await requireCredits(db, tenantId, cost);

  const videoInfo = await fetchVideoInfo(db, body.videoId, tenantId);
  const config = getLlmConfig(c.env);
  const prompt = generateVideoKeywords(videoInfo);

  const result = await callLlm(config, {
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    temperature: 0.7,
    maxTokens: 512,
  });

  // Parse JSON array from response
  let keywords: string[] = [];
  try {
    const cleaned = result.text.trim().replace(/^```json?\n?|\n?```$/g, '');
    keywords = JSON.parse(cleaned) as string[];
    if (!Array.isArray(keywords)) keywords = [];
  } catch {
    // Fallback: split by commas or newlines
    keywords = result.text
      .split(/[,\n]/)
      .map((k) => k.trim().replace(/^["'-]|["'-]$/g, ''))
      .filter(Boolean);
  }

  await debitCredits(db, tenantId, cost, 'generate_keywords', body.videoId);
  await logLlmUsage(db, tenantId, 'generate_keywords', result.model, result.inputTokens, result.outputTokens, cost, body.videoId);

  return c.json({
    keywords,
    creditsUsed: cost,
    tokens: { input: result.inputTokens, output: result.outputTokens },
  });
});

// ─── POST /ai/generate/faq ──────────────────────────────────────────────────

ai.post('/generate/faq', async (c) => {
  const tenantId = c.get('tenantId')!;
  const body = await c.req.json();

  if (!body.videoId) throw new ValidationError('Campo "videoId" é obrigatório');

  const db = new D1Client(c.env.DB);
  const cost = OPERATION_COSTS.generate_faq;

  await requireCredits(db, tenantId, cost);

  const videoInfo = await fetchVideoInfo(db, body.videoId, tenantId);
  const config = getLlmConfig(c.env);
  const prompt = generateVideoFAQ(videoInfo);

  const result = await callLlm(config, {
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    temperature: 0.7,
    maxTokens: 1024,
  });

  // Parse JSON array from response
  let faq: Array<{ question: string; answer: string }> = [];
  try {
    const cleaned = result.text.trim().replace(/^```json?\n?|\n?```$/g, '');
    faq = JSON.parse(cleaned) as Array<{ question: string; answer: string }>;
    if (!Array.isArray(faq)) faq = [];
  } catch {
    faq = [];
  }

  await debitCredits(db, tenantId, cost, 'generate_faq', body.videoId);
  await logLlmUsage(db, tenantId, 'generate_faq', result.model, result.inputTokens, result.outputTokens, cost, body.videoId);

  return c.json({
    faq,
    creditsUsed: cost,
    tokens: { input: result.inputTokens, output: result.outputTokens },
  });
});

// ─── POST /ai/translate ─────────────────────────────────────────────────────

ai.post('/translate', async (c) => {
  const tenantId = c.get('tenantId')!;
  const body = await c.req.json();

  if (!body.contentType || !body.contentId || !body.targetLocales?.length) {
    throw new ValidationError('Campos "contentType", "contentId" e "targetLocales" são obrigatórios');
  }

  const { contentType, contentId, targetLocales } = body as {
    contentType: string;
    contentId: string;
    targetLocales: string[];
  };

  // Only support video translations for now
  const validContentTypes = ['video', 'category', 'tag', 'performer', 'channel', 'page'];
  if (!validContentTypes.includes(contentType)) {
    throw new ValidationError(`Tipo de conteúdo inválido: ${contentType}`);
  }

  const db = new D1Client(c.env.DB);
  const costPerLocale = OPERATION_COSTS.translate_content;
  const totalCost = costPerLocale * targetLocales.length;

  await requireCredits(db, tenantId, totalCost);

  // Fetch source content
  const tenant = await db.queryOne<{ default_locale: string }>(
    'SELECT default_locale FROM tenants WHERE id = ?',
    [tenantId],
  );
  const sourceLocale = tenant?.default_locale ?? 'pt_BR';

  // Get the translation table and fields based on content type
  const tableMap: Record<string, { table: string; idField: string; fields: string[] }> = {
    video: { table: 'video_translations', idField: 'video_id', fields: ['title', 'description'] },
    category: { table: 'category_translations', idField: 'category_id', fields: ['name', 'description'] },
    tag: { table: 'tag_translations', idField: 'tag_id', fields: ['name'] },
    performer: { table: 'performer_translations', idField: 'performer_id', fields: ['name', 'bio'] },
    channel: { table: 'channel_translations', idField: 'channel_id', fields: ['name', 'description'] },
    page: { table: 'page_translations', idField: 'page_id', fields: ['title', 'content'] },
  };

  const mapping = tableMap[contentType]!;

  // Fetch source translation
  const source = await db.queryOne<Record<string, string>>(
    `SELECT ${mapping.fields.join(', ')} FROM ${mapping.table} WHERE ${mapping.idField} = ? AND locale = ?`,
    [contentId, sourceLocale],
  );

  if (!source) {
    throw new NotFoundError(`Tradução de origem para ${contentType}`, contentId);
  }

  const config = getLlmConfig(c.env);
  const results: Record<string, Record<string, string>> = {};
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Translate for each target locale
  for (const targetLocale of targetLocales) {
    if (targetLocale === sourceLocale) continue;

    const translated: Record<string, string> = {};

    for (const field of mapping.fields) {
      const sourceText = source[field];
      if (!sourceText) {
        translated[field] = '';
        continue;
      }

      const prompt = translateContent(sourceText, sourceLocale, targetLocale);
      const result = await callLlm(config, {
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        temperature: 0.3,
        maxTokens: 1024,
      });

      translated[field] = result.text.trim();
      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;
    }

    // Upsert translation
    const existing = await db.queryOne<{ id: string }>(
      `SELECT id FROM ${mapping.table} WHERE ${mapping.idField} = ? AND locale = ?`,
      [contentId, targetLocale],
    );

    if (existing) {
      const updates = mapping.fields.map((f) => `${f} = ?`).join(', ');
      const values = mapping.fields.map((f) => translated[f] ?? '');
      await db.execute(
        `UPDATE ${mapping.table} SET ${updates}, updated_at = datetime('now') WHERE id = ?`,
        [...values, existing.id],
      );
    } else {
      const translationId = generateUlid();
      const fieldList = ['id', mapping.idField, 'locale', ...mapping.fields].join(', ');
      const placeholders = ['id', mapping.idField, 'locale', ...mapping.fields].map(() => '?').join(', ');
      const values = [translationId, contentId, targetLocale, ...mapping.fields.map((f) => translated[f] ?? '')];
      await db.execute(
        `INSERT INTO ${mapping.table} (${fieldList}) VALUES (${placeholders})`,
        values,
      );
    }

    results[targetLocale] = translated;
  }

  // Debit + log
  await debitCredits(db, tenantId, totalCost, 'translate_content', contentId);
  await logLlmUsage(db, tenantId, 'translate_content', config.model, totalInputTokens, totalOutputTokens, totalCost, contentId);

  return c.json({
    translations: results,
    creditsUsed: totalCost,
    tokens: { input: totalInputTokens, output: totalOutputTokens },
  });
});

export { ai };
