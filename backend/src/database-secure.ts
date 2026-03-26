// Secure Database Layer with Row-Level Security
// All queries MUST include tenantId validation

import { User, Tenant, Video } from './database';

export class SecureDatabase {
  private users: Map<string, User> = new Map();
  private tenants: Map<string, Tenant> = new Map();
  private videos: Map<string, Video> = new Map();

  // ============================================
  // USER OPERATIONS
  // ============================================

  async createUser(user: User): Promise<User> {
    // Validate tenant exists before creating user
    const tenant = await this.getTenantById(user.tenantId);
    if (!tenant) {
      throw new Error('Invalid tenantId: tenant does not exist');
    }
    
    this.users.set(user.id, user);
    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  // ============================================
  // TENANT OPERATIONS
  // ============================================

  async createTenant(tenant: Tenant): Promise<Tenant> {
    this.tenants.set(tenant.id, tenant);
    return tenant;
  }

  async getTenantById(id: string): Promise<Tenant | null> {
    return this.tenants.get(id) || null;
  }

  async getTenantByDomain(domain: string): Promise<Tenant | null> {
    for (const tenant of this.tenants.values()) {
      if (tenant.domain === domain) return tenant;
    }
    return null;
  }

  // ============================================
  // VIDEO OPERATIONS (TENANT-ISOLATED)
  // ============================================

  /**
   * Create video - MUST include tenantId
   */
  async createVideo(video: Video, tenantId: string): Promise<Video> {
    // Row-level security: validate tenantId matches
    if (video.tenantId !== tenantId) {
      throw new Error('Tenant ID mismatch: cannot create video for different tenant');
    }

    // Validate tenant exists
    const tenant = await this.getTenantById(tenantId);
    if (!tenant) {
      throw new Error('Invalid tenantId: tenant does not exist');
    }

    this.videos.set(video.id, video);
    return video;
  }

  /**
   * Get video by ID - MUST validate tenantId
   */
  async getVideoById(id: string, tenantId: string): Promise<Video | null> {
    const video = this.videos.get(id);
    
    if (!video) {
      return null;
    }

    // Row-level security: only return if tenant matches
    if (video.tenantId !== tenantId) {
      console.warn('[SECURITY] Attempted cross-tenant video access', {
        videoId: id,
        videoTenantId: video.tenantId,
        requestTenantId: tenantId,
      });
      return null;
    }

    return video;
  }

  /**
   * Get all videos for a specific tenant
   */
  async getVideosByTenant(tenantId: string): Promise<Video[]> {
    const videos: Video[] = [];
    
    // Filter by tenantId (row-level security)
    for (const video of this.videos.values()) {
      if (video.tenantId === tenantId) {
        videos.push(video);
      }
    }
    
    return videos.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Search videos with filters - MUST validate tenantId
   */
  async searchVideos(
    tenantId: string,
    options: {
      query?: string;
      categoryId?: string;
      tagId?: string;
      sortBy?: 'date' | 'views' | 'title';
      sortOrder?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
    }
  ): Promise<{ videos: Video[]; total: number }> {
    const {
      query,
      categoryId,
      tagId,
      sortBy = 'date',
      sortOrder = 'desc',
      limit = 20,
      offset = 0,
    } = options;

    let results: Video[] = [];

    // Filter by tenantId (row-level security)
    for (const video of this.videos.values()) {
      if (video.tenantId !== tenantId) {
        continue;
      }

      // Text search (case-insensitive, searches title and description)
      if (query) {
        const searchTerm = query.toLowerCase();
        const titleMatch = video.title.toLowerCase().includes(searchTerm);
        const descMatch = video.description.toLowerCase().includes(searchTerm);
        
        if (!titleMatch && !descMatch) {
          continue;
        }
      }

      // Category filter (would need videoCategories table in real implementation)
      if (categoryId) {
        // Placeholder: in real implementation, join with videoCategories table
        // For now, skip this filter
      }

      // Tag filter (would need videoTags table in real implementation)
      if (tagId) {
        // Placeholder: in real implementation, join with videoTags table
        // For now, skip this filter
      }

      results.push(video);
    }

    // Sort results
    results.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'views':
          comparison = a.views - b.views;
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'date':
        default:
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    const total = results.length;

    // Apply pagination
    const paginated = results.slice(offset, offset + limit);

    return {
      videos: paginated,
      total,
    };
  }

  /**
   * Update video - MUST validate tenantId
   */
  async updateVideo(id: string, updates: Partial<Video>, tenantId: string): Promise<Video | null> {
    const video = this.videos.get(id);
    
    if (!video) {
      return null;
    }

    // Row-level security: only update if tenant matches
    if (video.tenantId !== tenantId) {
      throw new Error('Access denied: cannot update video from different tenant');
    }

    // Prevent tenantId modification
    if (updates.tenantId && updates.tenantId !== tenantId) {
      throw new Error('Cannot change video tenantId');
    }

    const updated = { ...video, ...updates, tenantId: video.tenantId };
    this.videos.set(id, updated);
    return updated;
  }

  /**
   * Delete video - MUST validate tenantId
   */
  async deleteVideo(id: string, tenantId: string): Promise<boolean> {
    const video = this.videos.get(id);
    
    if (!video) {
      return false;
    }

    // Row-level security: only delete if tenant matches
    if (video.tenantId !== tenantId) {
      throw new Error('Access denied: cannot delete video from different tenant');
    }

    return this.videos.delete(id);
  }

  /**
   * Increment video views - MUST validate tenantId
   */
  async incrementVideoViews(id: string, tenantId: string): Promise<void> {
    const video = this.videos.get(id);
    
    if (!video) {
      return;
    }

    // Row-level security: only increment if tenant matches
    if (video.tenantId !== tenantId) {
      console.warn('[SECURITY] Attempted cross-tenant view increment', {
        videoId: id,
        videoTenantId: video.tenantId,
        requestTenantId: tenantId,
      });
      return;
    }

    video.views += 1;
    this.videos.set(id, video);
  }

  // ============================================
  // ADMIN / DEBUG OPERATIONS (Use with caution)
  // ============================================

  /**
   * Get all videos (ADMIN ONLY - bypasses tenant isolation)
   * Should only be used for system administration
   */
  async getAllVideos(): Promise<Video[]> {
    console.warn('[ADMIN] getAllVideos called - bypassing tenant isolation');
    return Array.from(this.videos.values());
  }

  /**
   * Get database statistics per tenant
   */
  async getTenantStats(tenantId: string): Promise<{
    videoCount: number;
    totalViews: number;
  }> {
    const videos = await this.getVideosByTenant(tenantId);
    
    return {
      videoCount: videos.length,
      totalViews: videos.reduce((sum, v) => sum + v.views, 0),
    };
  }
}

// Export singleton instance
export const secureDb = new SecureDatabase();
