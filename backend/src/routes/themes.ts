/**
 * Themes API (Task 4.4)
 * Editor visual de temas com preview, versionamento e rollback
 */

import { Hono } from 'hono';
import { nanoid } from 'nanoid';

type Bindings = {
  DB: D1Database;
};

const themesRouter = new Hono<{ Bindings: Bindings }>();

// Validação de cor hexadecimal
const isValidHexColor = (color: string): boolean => {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
};

// Validação de layout
const VALID_LAYOUTS = ['grid', 'list', 'masonry'] as const;
type LayoutStyle = typeof VALID_LAYOUTS[number];

const isValidLayout = (layout: string): layout is LayoutStyle => {
  return VALID_LAYOUTS.includes(layout as LayoutStyle);
};

// Tema padrão (clone Xvideos)
const DEFAULT_THEME = {
  name: 'Default Theme',
  description: 'Tema padrão inspirado em Xvideos',
  primary_color: '#ff6b00',
  secondary_color: '#1a1a1a',
  background_color: '#ffffff',
  text_color: '#000000',
  accent_color: '#ff8c00',
  font_family: 'Inter, system-ui, sans-serif',
  font_size_base: '16px',
  layout_style: 'grid' as LayoutStyle,
  grid_columns: 4,
  card_border_radius: '8px',
};

// ============================================================================
// GET /api/admin/themes - Listar temas
// ============================================================================
themesRouter.get('/api/admin/themes', async (c) => {
  const tenantId = c.req.header('X-Tenant-ID');
  
  if (!tenantId) {
    return c.json({ error: 'X-Tenant-ID header required' }, 400);
  }

  const themes = await c.env.DB.prepare(
    `SELECT * FROM themes WHERE tenant_id = ? ORDER BY created_at DESC`
  ).bind(tenantId).all();

  return c.json({ themes: themes.results || [] });
});

// ============================================================================
// GET /api/admin/themes/:id - Obter tema específico
// ============================================================================
themesRouter.get('/api/admin/themes/:id', async (c) => {
  const { id } = c.req.param();
  const tenantId = c.req.header('X-Tenant-ID');

  if (!tenantId) {
    return c.json({ error: 'X-Tenant-ID header required' }, 400);
  }

  const theme = await c.env.DB.prepare(
    `SELECT * FROM themes WHERE id = ? AND tenant_id = ?`
  ).bind(id, tenantId).first();

  if (!theme) {
    return c.json({ error: 'Theme not found' }, 404);
  }

  return c.json(theme);
});

// ============================================================================
// POST /api/admin/themes - Criar novo tema
// ============================================================================
themesRouter.post('/api/admin/themes', async (c) => {
  const tenantId = c.req.header('X-Tenant-ID');
  
  if (!tenantId) {
    return c.json({ error: 'X-Tenant-ID header required' }, 400);
  }

  const body = await c.req.json();

  // Validações
  if (!body.name) {
    return c.json({ error: 'Name is required' }, 400);
  }

  if (body.primary_color && !isValidHexColor(body.primary_color)) {
    return c.json({ error: 'Invalid primary_color format. Use hex format (#RRGGBB)' }, 400);
  }

  if (body.secondary_color && !isValidHexColor(body.secondary_color)) {
    return c.json({ error: 'Invalid secondary_color format. Use hex format (#RRGGBB)' }, 400);
  }

  if (body.background_color && !isValidHexColor(body.background_color)) {
    return c.json({ error: 'Invalid background_color format. Use hex format (#RRGGBB)' }, 400);
  }

  if (body.text_color && !isValidHexColor(body.text_color)) {
    return c.json({ error: 'Invalid text_color format. Use hex format (#RRGGBB)' }, 400);
  }

  if (body.accent_color && !isValidHexColor(body.accent_color)) {
    return c.json({ error: 'Invalid accent_color format. Use hex format (#RRGGBB)' }, 400);
  }

  if (body.layout_style && !isValidLayout(body.layout_style)) {
    return c.json({ error: 'Invalid layout_style. Must be: grid, list, or masonry' }, 400);
  }

  const now = new Date().toISOString();
  const id = nanoid();

  const theme = {
    id,
    tenant_id: tenantId,
    name: body.name,
    description: body.description || null,
    primary_color: body.primary_color || DEFAULT_THEME.primary_color,
    secondary_color: body.secondary_color || DEFAULT_THEME.secondary_color,
    background_color: body.background_color || DEFAULT_THEME.background_color,
    text_color: body.text_color || DEFAULT_THEME.text_color,
    accent_color: body.accent_color || DEFAULT_THEME.accent_color,
    logo_url: body.logo_url || null,
    favicon_url: body.favicon_url || null,
    font_family: body.font_family || DEFAULT_THEME.font_family,
    font_size_base: body.font_size_base || DEFAULT_THEME.font_size_base,
    layout_style: body.layout_style || DEFAULT_THEME.layout_style,
    grid_columns: body.grid_columns || DEFAULT_THEME.grid_columns,
    card_border_radius: body.card_border_radius || DEFAULT_THEME.card_border_radius,
    custom_css: body.custom_css || null,
    is_active: 0,
    version: 1,
    parent_version_id: null,
    created_at: now,
    updated_at: now,
  };

  await c.env.DB.prepare(
    `INSERT INTO themes (
      id, tenant_id, name, description,
      primary_color, secondary_color, background_color, text_color, accent_color,
      logo_url, favicon_url,
      font_family, font_size_base,
      layout_style, grid_columns, card_border_radius,
      custom_css,
      is_active, version, parent_version_id,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    theme.id, theme.tenant_id, theme.name, theme.description,
    theme.primary_color, theme.secondary_color, theme.background_color, theme.text_color, theme.accent_color,
    theme.logo_url, theme.favicon_url,
    theme.font_family, theme.font_size_base,
    theme.layout_style, theme.grid_columns, theme.card_border_radius,
    theme.custom_css,
    theme.is_active, theme.version, theme.parent_version_id,
    theme.created_at, theme.updated_at
  ).run();

  return c.json(theme, 201);
});

// ============================================================================
// PUT /api/admin/themes/:id - Atualizar tema (cria nova versão)
// ============================================================================
themesRouter.put('/api/admin/themes/:id', async (c) => {
  const { id } = c.req.param();
  const tenantId = c.req.header('X-Tenant-ID');

  if (!tenantId) {
    return c.json({ error: 'X-Tenant-ID header required' }, 400);
  }

  const existingTheme = await c.env.DB.prepare(
    `SELECT * FROM themes WHERE id = ? AND tenant_id = ?`
  ).bind(id, tenantId).first();

  if (!existingTheme) {
    return c.json({ error: 'Theme not found' }, 404);
  }

  const body = await c.req.json();

  // Validações
  if (body.primary_color && !isValidHexColor(body.primary_color)) {
    return c.json({ error: 'Invalid primary_color format' }, 400);
  }
  if (body.secondary_color && !isValidHexColor(body.secondary_color)) {
    return c.json({ error: 'Invalid secondary_color format' }, 400);
  }
  if (body.background_color && !isValidHexColor(body.background_color)) {
    return c.json({ error: 'Invalid background_color format' }, 400);
  }
  if (body.text_color && !isValidHexColor(body.text_color)) {
    return c.json({ error: 'Invalid text_color format' }, 400);
  }
  if (body.accent_color && !isValidHexColor(body.accent_color)) {
    return c.json({ error: 'Invalid accent_color format' }, 400);
  }
  if (body.layout_style && !isValidLayout(body.layout_style)) {
    return c.json({ error: 'Invalid layout_style' }, 400);
  }

  const now = new Date().toISOString();
  const newVersion = (existingTheme.version as number) + 1;

  // Atualizar tema existente com nova versão
  const updatedTheme = {
    ...existingTheme,
    ...body,
    version: newVersion,
    parent_version_id: id,
    updated_at: now,
  };

  await c.env.DB.prepare(
    `UPDATE themes SET
      name = ?,
      description = ?,
      primary_color = ?,
      secondary_color = ?,
      background_color = ?,
      text_color = ?,
      accent_color = ?,
      logo_url = ?,
      favicon_url = ?,
      font_family = ?,
      font_size_base = ?,
      layout_style = ?,
      grid_columns = ?,
      card_border_radius = ?,
      custom_css = ?,
      version = ?,
      parent_version_id = ?,
      updated_at = ?
    WHERE id = ? AND tenant_id = ?`
  ).bind(
    updatedTheme.name,
    updatedTheme.description,
    updatedTheme.primary_color,
    updatedTheme.secondary_color,
    updatedTheme.background_color,
    updatedTheme.text_color,
    updatedTheme.accent_color,
    updatedTheme.logo_url,
    updatedTheme.favicon_url,
    updatedTheme.font_family,
    updatedTheme.font_size_base,
    updatedTheme.layout_style,
    updatedTheme.grid_columns,
    updatedTheme.card_border_radius,
    updatedTheme.custom_css,
    updatedTheme.version,
    updatedTheme.parent_version_id,
    updatedTheme.updated_at,
    id,
    tenantId
  ).run();

  return c.json(updatedTheme);
});

// ============================================================================
// POST /api/admin/themes/:id/activate - Ativar tema
// ============================================================================
themesRouter.post('/api/admin/themes/:id/activate', async (c) => {
  const { id } = c.req.param();
  const tenantId = c.req.header('X-Tenant-ID');

  if (!tenantId) {
    return c.json({ error: 'X-Tenant-ID header required' }, 400);
  }

  const theme = await c.env.DB.prepare(
    `SELECT * FROM themes WHERE id = ? AND tenant_id = ?`
  ).bind(id, tenantId).first();

  if (!theme) {
    return c.json({ error: 'Theme not found' }, 404);
  }

  // Desativar todos os temas do tenant
  await c.env.DB.prepare(
    `UPDATE themes SET is_active = 0 WHERE tenant_id = ?`
  ).bind(tenantId).run();

  // Ativar o tema selecionado
  await c.env.DB.prepare(
    `UPDATE themes SET is_active = 1, updated_at = ? WHERE id = ? AND tenant_id = ?`
  ).bind(new Date().toISOString(), id, tenantId).run();

  const updatedTheme = await c.env.DB.prepare(
    `SELECT * FROM themes WHERE id = ? AND tenant_id = ?`
  ).bind(id, tenantId).first();

  return c.json(updatedTheme);
});

// ============================================================================
// POST /api/admin/themes/:id/rollback - Rollback para versão anterior
// ============================================================================
themesRouter.post('/api/admin/themes/:id/rollback', async (c) => {
  const { id } = c.req.param();
  const tenantId = c.req.header('X-Tenant-ID');

  if (!tenantId) {
    return c.json({ error: 'X-Tenant-ID header required' }, 400);
  }

  const currentTheme = await c.env.DB.prepare(
    `SELECT * FROM themes WHERE id = ? AND tenant_id = ?`
  ).bind(id, tenantId).first();

  if (!currentTheme) {
    return c.json({ error: 'Theme not found' }, 404);
  }

  if (!currentTheme.parent_version_id) {
    return c.json({ error: 'No previous version available' }, 400);
  }

  const parentTheme = await c.env.DB.prepare(
    `SELECT * FROM themes WHERE id = ? AND tenant_id = ?`
  ).bind(currentTheme.parent_version_id, tenantId).first();

  if (!parentTheme) {
    return c.json({ error: 'Parent version not found' }, 404);
  }

  // Criar nova versão baseada na anterior
  const now = new Date().toISOString();
  const newVersion = (currentTheme.version as number) + 1;

  await c.env.DB.prepare(
    `UPDATE themes SET
      name = ?,
      description = ?,
      primary_color = ?,
      secondary_color = ?,
      background_color = ?,
      text_color = ?,
      accent_color = ?,
      logo_url = ?,
      favicon_url = ?,
      font_family = ?,
      font_size_base = ?,
      layout_style = ?,
      grid_columns = ?,
      card_border_radius = ?,
      custom_css = ?,
      version = ?,
      parent_version_id = ?,
      updated_at = ?
    WHERE id = ? AND tenant_id = ?`
  ).bind(
    parentTheme.name,
    parentTheme.description,
    parentTheme.primary_color,
    parentTheme.secondary_color,
    parentTheme.background_color,
    parentTheme.text_color,
    parentTheme.accent_color,
    parentTheme.logo_url,
    parentTheme.favicon_url,
    parentTheme.font_family,
    parentTheme.font_size_base,
    parentTheme.layout_style,
    parentTheme.grid_columns,
    parentTheme.card_border_radius,
    parentTheme.custom_css,
    newVersion,
    currentTheme.parent_version_id,
    now,
    id,
    tenantId
  ).run();

  const rolledBackTheme = await c.env.DB.prepare(
    `SELECT * FROM themes WHERE id = ? AND tenant_id = ?`
  ).bind(id, tenantId).first();

  return c.json(rolledBackTheme);
});

// ============================================================================
// DELETE /api/admin/themes/:id - Deletar tema
// ============================================================================
themesRouter.delete('/api/admin/themes/:id', async (c) => {
  const { id } = c.req.param();
  const tenantId = c.req.header('X-Tenant-ID');

  if (!tenantId) {
    return c.json({ error: 'X-Tenant-ID header required' }, 400);
  }

  const theme = await c.env.DB.prepare(
    `SELECT * FROM themes WHERE id = ? AND tenant_id = ?`
  ).bind(id, tenantId).first();

  if (!theme) {
    return c.json({ error: 'Theme not found' }, 404);
  }

  if (theme.is_active === 1) {
    return c.json({ error: 'Cannot delete active theme. Activate another theme first.' }, 400);
  }

  await c.env.DB.prepare(
    `DELETE FROM themes WHERE id = ? AND tenant_id = ?`
  ).bind(id, tenantId).run();

  return c.body(null, 204);
});

// ============================================================================
// GET /api/public/theme - Obter tema ativo (público)
// ============================================================================
themesRouter.get('/api/public/theme', async (c) => {
  const tenantId = c.req.header('X-Tenant-ID');

  if (!tenantId) {
    return c.json({ error: 'X-Tenant-ID header required' }, 400);
  }

  const activeTheme = await c.env.DB.prepare(
    `SELECT * FROM themes WHERE tenant_id = ? AND is_active = 1`
  ).bind(tenantId).first();

  if (activeTheme) {
    // Não expor custom_css no endpoint público
    const { custom_css, ...publicTheme } = activeTheme;
    return c.json(publicTheme);
  }

  // Retornar tema padrão se nenhum ativo
  return c.json({
    ...DEFAULT_THEME,
    tenant_id: tenantId,
    is_active: 1,
  });
});

export default themesRouter;
