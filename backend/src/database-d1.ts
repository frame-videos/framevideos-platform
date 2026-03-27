/**
 * Cloudflare D1 Database Implementation
 * SQLite-based persistent storage for Frame Videos
 */

import { Tenant, User, Video, Category, Tag } from './database';

// Use a different name to avoid conflict with the class name
type D1Binding = any;

export class D1Database {
  constructor(private db: D1Binding) {}

  // ============================================================================
  // Tenants
  // ============================================================================

  async createTenant(tenant: Tenant): Promise<Tenant> {
    await this.db
      .prepare('INSERT INTO tenants (id, name, domain, created_at) VALUES (?, ?, ?, ?)')
      .bind(tenant.id, tenant.name, tenant.domain, tenant.createdAt)
      .run();
    return tenant;
  }

  async getTenantById(id: string): Promise<Tenant | null> {
    const result = await this.db
      .prepare('SELECT * FROM tenants WHERE id = ?')
      .bind(id)
      .first();
    if (!result) return null;
    return {
      id: result.id,
      name: result.name,
      domain: result.domain,
      createdAt: result.created_at,
    } as Tenant;
  }

  async getTenantByDomain(domain: string): Promise<Tenant | null> {
    const result = await this.db
      .prepare('SELECT * FROM tenants WHERE domain = ?')
      .bind(domain)
      .first();
    if (!result) return null;
    return {
      id: result.id,
      name: result.name,
      domain: result.domain,
      createdAt: result.created_at,
    } as Tenant;
  }

  // ============================================================================
  // Users
  // ============================================================================

  async createUser(user: any): Promise<any> {
    await this.db
      .prepare('INSERT INTO users (id, email, password, tenant_id, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(user.id, user.email, user.password, user.tenantId, user.name || '', user.role || 'user', user.createdAt)
      .run();
    return user;
  }

  async getUserByEmail(email: string): Promise<any | null> {
    const result = await this.db
      .prepare('SELECT * FROM users WHERE email = ?')
      .bind(email)
      .first();
    if (!result) return null;
    return {
      id: result.id,
      email: result.email,
      password: result.password,
      name: result.name,
      role: result.role || 'user',
      tenantId: result.tenant_id,
      createdAt: result.created_at,
    };
  }

  async getUserById(id: string): Promise<any | null> {
    const result = await this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(id)
      .first();
    if (!result) return null;
    return {
      id: result.id,
      email: result.email,
      password: result.password,
      name: result.name,
      role: result.role || 'user',
      tenantId: result.tenant_id,
      createdAt: result.created_at,
    };
  }

  async getUsersByTenant(tenantId: string): Promise<any[]> {
    const result = await this.db
      .prepare('SELECT * FROM users WHERE tenant_id = ?')
      .bind(tenantId)
      .all();
    return result.results as any[];
  }

  // ============================================================================
  // Videos
  // ============================================================================

  async createVideo(video: any): Promise<any> {
    await this.db
      .prepare(`
        INSERT INTO videos (id, title, description, status, duration, url, thumbnail_url, user_id, tenant_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        video.id,
        video.title,
        video.description || null,
        video.status || 'pending',
        video.duration || null,
        video.url || null,
        video.thumbnailUrl || video.thumbnail_url || null,
        video.userId || video.user_id,
        video.tenantId || video.tenant_id,
        video.createdAt || video.created_at,
        video.updatedAt || video.updated_at || null
      )
      .run();
    return video;
  }

  async getVideoById(id: string, tenantId?: string): Promise<any | null> {
    if (tenantId) {
      const result = await this.db
        .prepare('SELECT * FROM videos WHERE id = ? AND tenant_id = ?')
        .bind(id, tenantId)
        .first();
      return result || null;
    }
    const result = await this.db
      .prepare('SELECT * FROM videos WHERE id = ?')
      .bind(id)
      .first();
    return result || null;
  }

  async getVideosByTenant(tenantId: string, limit = 50, offset = 0): Promise<any[]> {
    const result = await this.db
      .prepare('SELECT * FROM videos WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .bind(tenantId, limit, offset)
      .all();
    return result.results as any[];
  }

  async getVideosByUser(userId: string, limit = 50, offset = 0): Promise<any[]> {
    const result = await this.db
      .prepare('SELECT * FROM videos WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .bind(userId, limit, offset)
      .all();
    return result.results as any[];
  }

  async updateVideo(id: string, updates: any): Promise<any | null> {
    const video = await this.getVideoById(id);
    if (!video) return null;

    const updatedVideo = { ...video, ...updates, updated_at: new Date().toISOString() };

    await this.db
      .prepare(`
        UPDATE videos 
        SET title = ?, description = ?, status = ?, duration = ?, url = ?, thumbnail_url = ?, updated_at = ?
        WHERE id = ?
      `)
      .bind(
        updatedVideo.title,
        updatedVideo.description || null,
        updatedVideo.status,
        updatedVideo.duration || null,
        updatedVideo.url || updatedVideo.thumbnail_url || null,
        updatedVideo.thumbnail_url || null,
        updatedVideo.updated_at,
        id
      )
      .run();

    return updatedVideo;
  }

  async deleteVideo(id: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM videos WHERE id = ?')
      .bind(id)
      .run();
    return result.success;
  }

  async incrementVideoViews(id: string, tenantId?: string): Promise<void> {
    await this.db
      .prepare('INSERT INTO analytics (id, video_id, event_type, tenant_id, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), id, 'view', tenantId || '', new Date().toISOString())
      .run();
  }

  async searchVideos(tenantId: string, query: string, limit = 50): Promise<any[]> {
    const searchPattern = `%${query}%`;
    const result = await this.db
      .prepare(`
        SELECT * FROM videos 
        WHERE tenant_id = ? AND (title LIKE ? OR description LIKE ?)
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .bind(tenantId, searchPattern, searchPattern, limit)
      .all();
    return result.results as any[];
  }

  // ============================================================================
  // Categories
  // ============================================================================

  async createCategory(category: Category): Promise<Category> {
    await this.db
      .prepare('INSERT INTO categories (id, name, slug, description, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(category.id, category.name, category.slug, category.description || null, category.tenantId, category.createdAt)
      .run();
    return category;
  }

  async getCategoryById(id: string): Promise<Category | null> {
    const result = await this.db
      .prepare('SELECT id, name, slug, description, tenant_id as tenantId, created_at as createdAt FROM categories WHERE id = ?')
      .bind(id)
      .first();
    return result as Category | null;
  }

  async getCategoryBySlug(tenantId: string, slug: string): Promise<Category | null> {
    const result = await this.db
      .prepare('SELECT id, name, slug, description, tenant_id as tenantId, created_at as createdAt FROM categories WHERE tenant_id = ? AND slug = ?')
      .bind(tenantId, slug)
      .first();
    return result as Category | null;
  }

  async getCategoriesByTenant(tenantId: string): Promise<any[]> {
    const result = await this.db
      .prepare(`
        SELECT c.id, c.name, c.slug, c.description, c.tenant_id as tenantId, c.created_at as createdAt,
               COUNT(vc.video_id) as videoCount
        FROM categories c
        LEFT JOIN video_categories vc ON c.id = vc.category_id
        WHERE c.tenant_id = ?
        GROUP BY c.id
        ORDER BY c.name ASC
      `)
      .bind(tenantId)
      .all();
    return result.results as any[];
  }

  async updateCategory(id: string, updates: Partial<Category>): Promise<Category | null> {
    const category = await this.getCategoryById(id);
    if (!category) return null;

    const updated = {
      ...category,
      name: updates.name ?? category.name,
      slug: updates.slug ?? category.slug,
      description: updates.description ?? category.description,
    };

    await this.db
      .prepare('UPDATE categories SET name = ?, slug = ?, description = ? WHERE id = ?')
      .bind(updated.name, updated.slug, updated.description || null, id)
      .run();

    return updated;
  }

  async deleteCategory(id: string): Promise<boolean> {
    await this.db
      .prepare('DELETE FROM video_categories WHERE category_id = ?')
      .bind(id)
      .run();
    const result = await this.db
      .prepare('DELETE FROM categories WHERE id = ?')
      .bind(id)
      .run();
    return result.success;
  }

  async getVideosByCategory(categoryId: string): Promise<any[]> {
    const result = await this.db
      .prepare(`
        SELECT v.* FROM videos v
        INNER JOIN video_categories vc ON v.id = vc.video_id
        WHERE vc.category_id = ?
        ORDER BY v.created_at DESC
      `)
      .bind(categoryId)
      .all();
    return result.results as any[];
  }

  // ============================================================================
  // Tags
  // ============================================================================

  async createTag(tag: Tag): Promise<Tag> {
    await this.db
      .prepare('INSERT INTO tags (id, name, slug, tenant_id, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(tag.id, tag.name, tag.slug, tag.tenantId, tag.createdAt)
      .run();
    return tag;
  }

  async getTagById(id: string): Promise<Tag | null> {
    const result = await this.db
      .prepare('SELECT id, name, slug, tenant_id as tenantId, created_at as createdAt FROM tags WHERE id = ?')
      .bind(id)
      .first();
    return result as Tag | null;
  }

  async getTagBySlug(tenantId: string, slug: string): Promise<Tag | null> {
    const result = await this.db
      .prepare('SELECT id, name, slug, tenant_id as tenantId, created_at as createdAt FROM tags WHERE tenant_id = ? AND slug = ?')
      .bind(tenantId, slug)
      .first();
    return result as Tag | null;
  }

  async getTagsByTenant(tenantId: string): Promise<any[]> {
    const result = await this.db
      .prepare(`
        SELECT t.id, t.name, t.slug, t.tenant_id as tenantId, t.created_at as createdAt,
               COUNT(vt.video_id) as videoCount
        FROM tags t
        LEFT JOIN video_tags vt ON t.id = vt.tag_id
        WHERE t.tenant_id = ?
        GROUP BY t.id
        ORDER BY t.name ASC
      `)
      .bind(tenantId)
      .all();
    return result.results as any[];
  }

  async updateTag(id: string, updates: Partial<Tag>): Promise<Tag | null> {
    const tag = await this.getTagById(id);
    if (!tag) return null;

    const updated = {
      ...tag,
      name: updates.name ?? tag.name,
      slug: updates.slug ?? tag.slug,
    };

    await this.db
      .prepare('UPDATE tags SET name = ?, slug = ? WHERE id = ?')
      .bind(updated.name, updated.slug, id)
      .run();

    return updated;
  }

  async deleteTag(id: string): Promise<boolean> {
    await this.db
      .prepare('DELETE FROM video_tags WHERE tag_id = ?')
      .bind(id)
      .run();
    const result = await this.db
      .prepare('DELETE FROM tags WHERE id = ?')
      .bind(id)
      .run();
    return result.success;
  }

  async getVideosByTag(tagId: string): Promise<any[]> {
    const result = await this.db
      .prepare(`
        SELECT v.* FROM videos v
        INNER JOIN video_tags vt ON v.id = vt.video_id
        WHERE vt.tag_id = ?
        ORDER BY v.created_at DESC
      `)
      .bind(tagId)
      .all();
    return result.results as any[];
  }

  async getTagCloud(tenantId: string, limit = 50): Promise<any[]> {
    const result = await this.db
      .prepare(`
        SELECT t.id, t.name, t.slug, t.tenant_id as tenantId, t.created_at as createdAt,
               COUNT(vt.video_id) as videoCount
        FROM tags t
        LEFT JOIN video_tags vt ON t.id = vt.tag_id
        WHERE t.tenant_id = ?
        GROUP BY t.id
        ORDER BY videoCount DESC, t.name ASC
        LIMIT ?
      `)
      .bind(tenantId, limit)
      .all();
    return result.results as any[];
  }

  async searchTags(tenantId: string, query: string, limit = 10): Promise<Tag[]> {
    const searchPattern = `%${query}%`;
    const result = await this.db
      .prepare(`
        SELECT id, name, slug, tenant_id as tenantId, created_at as createdAt
        FROM tags
        WHERE tenant_id = ? AND name LIKE ?
        ORDER BY name ASC
        LIMIT ?
      `)
      .bind(tenantId, searchPattern, limit)
      .all();
    return result.results as Tag[];
  }

  async searchCategories(tenantId: string, query: string, limit = 10): Promise<Category[]> {
    const searchPattern = `%${query}%`;
    const result = await this.db
      .prepare(`
        SELECT id, name, slug, description, tenant_id as tenantId, created_at as createdAt
        FROM categories
        WHERE tenant_id = ? AND name LIKE ?
        ORDER BY name ASC
        LIMIT ?
      `)
      .bind(tenantId, searchPattern, limit)
      .all();
    return result.results as Category[];
  }

  // ============================================================================
  // Video-Category Relations
  // ============================================================================

  async addVideoCategory(videoId: string, categoryId: string): Promise<void> {
    await this.db
      .prepare('INSERT OR IGNORE INTO video_categories (video_id, category_id) VALUES (?, ?)')
      .bind(videoId, categoryId)
      .run();
  }

  async removeVideoCategory(videoId: string, categoryId: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM video_categories WHERE video_id = ? AND category_id = ?')
      .bind(videoId, categoryId)
      .run();
  }

  async getVideoCategories(videoId: string): Promise<Category[]> {
    const result = await this.db
      .prepare(`
        SELECT c.id, c.name, c.slug, c.description, c.tenant_id as tenantId, c.created_at as createdAt
        FROM categories c
        INNER JOIN video_categories vc ON c.id = vc.category_id
        WHERE vc.video_id = ?
      `)
      .bind(videoId)
      .all();
    return result.results as Category[];
  }

  async setVideoCategories(videoId: string, categoryIds: string[]): Promise<void> {
    await this.db
      .prepare('DELETE FROM video_categories WHERE video_id = ?')
      .bind(videoId)
      .run();
    for (const catId of categoryIds) {
      await this.addVideoCategory(videoId, catId);
    }
  }

  // ============================================================================
  // Video-Tag Relations
  // ============================================================================

  async addVideoTag(videoId: string, tagId: string): Promise<void> {
    await this.db
      .prepare('INSERT OR IGNORE INTO video_tags (video_id, tag_id) VALUES (?, ?)')
      .bind(videoId, tagId)
      .run();
  }

  async removeVideoTag(videoId: string, tagId: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM video_tags WHERE video_id = ? AND tag_id = ?')
      .bind(videoId, tagId)
      .run();
  }

  async getVideoTags(videoId: string): Promise<Tag[]> {
    const result = await this.db
      .prepare(`
        SELECT t.id, t.name, t.slug, t.tenant_id as tenantId, t.created_at as createdAt
        FROM tags t
        INNER JOIN video_tags vt ON t.id = vt.tag_id
        WHERE vt.video_id = ?
      `)
      .bind(videoId)
      .all();
    return result.results as Tag[];
  }

  async setVideoTags(videoId: string, tagIds: string[]): Promise<void> {
    await this.db
      .prepare('DELETE FROM video_tags WHERE video_id = ?')
      .bind(videoId)
      .run();
    for (const tagId of tagIds) {
      await this.addVideoTag(videoId, tagId);
    }
  }

  // ============================================================================
  // Analytics
  // ============================================================================

  async createAnalyticsEvent(event: {
    id: string;
    videoId: string;
    eventType: string;
    userId?: string;
    tenantId: string;
    metadata?: any;
    createdAt: string;
  }): Promise<void> {
    await this.db
      .prepare('INSERT INTO analytics (id, video_id, event_type, user_id, tenant_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(
        event.id,
        event.videoId,
        event.eventType,
        event.userId || null,
        event.tenantId,
        event.metadata ? JSON.stringify(event.metadata) : null,
        event.createdAt
      )
      .run();
  }

  async getVideoAnalytics(videoId: string, eventType?: string): Promise<any[]> {
    let query = 'SELECT * FROM analytics WHERE video_id = ?';
    const params: any[] = [videoId];

    if (eventType) {
      query += ' AND event_type = ?';
      params.push(eventType);
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.db.prepare(query).bind(...params).all();
    return result.results;
  }

  async getTrendingVideos(tenantId: string, limit = 10): Promise<any[]> {
    const result = await this.db
      .prepare(`
        SELECT v.*, COUNT(a.id) as view_count
        FROM videos v
        LEFT JOIN analytics a ON v.id = a.video_id AND a.event_type = 'view'
        WHERE v.tenant_id = ?
        GROUP BY v.id
        ORDER BY view_count DESC, v.created_at DESC
        LIMIT ?
      `)
      .bind(tenantId, limit)
      .all();
    return result.results as any[];
  }
}