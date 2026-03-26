// In-memory database for MVP
// In production, use D1 (Cloudflare SQL) or external DB

export interface User {
  id: string;
  email: string;
  password: string;
  tenantId: string;
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  createdAt: string;
}

export interface Video {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  url: string;
  thumbnailUrl: string;
  duration: number;
  views: number;
  createdAt: string;
}

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string;
  createdAt: string;
}

export interface Tag {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface VideoCategory {
  videoId: string;
  categoryId: string;
}

export interface VideoTag {
  videoId: string;
  tagId: string;
}

class Database {
  private users: Map<string, User> = new Map();
  private tenants: Map<string, Tenant> = new Map();
  private videos: Map<string, Video> = new Map();
  private categories: Map<string, Category> = new Map();
  private tags: Map<string, Tag> = new Map();
  private videoCategories: VideoCategory[] = [];
  private videoTags: VideoTag[] = [];

  // Users
  async createUser(user: User): Promise<User> {
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

  // Tenants
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

  // Videos
  async createVideo(video: Video): Promise<Video> {
    this.videos.set(video.id, video);
    return video;
  }

  async getVideoById(id: string): Promise<Video | null> {
    return this.videos.get(id) || null;
  }

  async getVideosByTenant(tenantId: string): Promise<Video[]> {
    const videos: Video[] = [];
    for (const video of this.videos.values()) {
      if (video.tenantId === tenantId) videos.push(video);
    }
    return videos.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async updateVideo(id: string, updates: Partial<Video>): Promise<Video | null> {
    const video = this.videos.get(id);
    if (!video) return null;
    
    const updated = { ...video, ...updates };
    this.videos.set(id, updated);
    return updated;
  }

  async deleteVideo(id: string): Promise<boolean> {
    return this.videos.delete(id);
  }

  async incrementVideoViews(id: string): Promise<void> {
    const video = this.videos.get(id);
    if (video) {
      video.views += 1;
      this.videos.set(id, video);
    }
  }

  // Categories
  async createCategory(category: Category): Promise<Category> {
    this.categories.set(category.id, category);
    return category;
  }

  async getCategoryById(id: string): Promise<Category | null> {
    return this.categories.get(id) || null;
  }

  async getCategoryBySlug(tenantId: string, slug: string): Promise<Category | null> {
    for (const category of this.categories.values()) {
      if (category.tenantId === tenantId && category.slug === slug) {
        return category;
      }
    }
    return null;
  }

  async getCategoriesByTenant(tenantId: string): Promise<Category[]> {
    const categories: Category[] = [];
    for (const category of this.categories.values()) {
      if (category.tenantId === tenantId) categories.push(category);
    }
    return categories.sort((a, b) => a.name.localeCompare(b.name));
  }

  async updateCategory(id: string, updates: Partial<Category>): Promise<Category | null> {
    const category = this.categories.get(id);
    if (!category) return null;
    
    const updated = { ...category, ...updates };
    this.categories.set(id, updated);
    return updated;
  }

  async deleteCategory(id: string): Promise<boolean> {
    // Remove all video-category relationships
    this.videoCategories = this.videoCategories.filter(vc => vc.categoryId !== id);
    return this.categories.delete(id);
  }

  // Tags
  async createTag(tag: Tag): Promise<Tag> {
    this.tags.set(tag.id, tag);
    return tag;
  }

  async getTagById(id: string): Promise<Tag | null> {
    return this.tags.get(id) || null;
  }

  async getTagBySlug(tenantId: string, slug: string): Promise<Tag | null> {
    for (const tag of this.tags.values()) {
      if (tag.tenantId === tenantId && tag.slug === slug) {
        return tag;
      }
    }
    return null;
  }

  async getTagsByTenant(tenantId: string): Promise<Tag[]> {
    const tags: Tag[] = [];
    for (const tag of this.tags.values()) {
      if (tag.tenantId === tenantId) tags.push(tag);
    }
    return tags.sort((a, b) => a.name.localeCompare(b.name));
  }

  async updateTag(id: string, updates: Partial<Tag>): Promise<Tag | null> {
    const tag = this.tags.get(id);
    if (!tag) return null;
    
    const updated = { ...tag, ...updates };
    this.tags.set(id, updated);
    return updated;
  }

  async deleteTag(id: string): Promise<boolean> {
    // Remove all video-tag relationships
    this.videoTags = this.videoTags.filter(vt => vt.tagId !== id);
    return this.tags.delete(id);
  }

  // Video-Category relationships
  async addVideoCategory(videoId: string, categoryId: string): Promise<void> {
    // Check if relationship already exists
    const exists = this.videoCategories.some(
      vc => vc.videoId === videoId && vc.categoryId === categoryId
    );
    if (!exists) {
      this.videoCategories.push({ videoId, categoryId });
    }
  }

  async removeVideoCategory(videoId: string, categoryId: string): Promise<void> {
    this.videoCategories = this.videoCategories.filter(
      vc => !(vc.videoId === videoId && vc.categoryId === categoryId)
    );
  }

  async getCategoriesByVideo(videoId: string): Promise<Category[]> {
    const categoryIds = this.videoCategories
      .filter(vc => vc.videoId === videoId)
      .map(vc => vc.categoryId);
    
    const categories: Category[] = [];
    for (const id of categoryIds) {
      const category = this.categories.get(id);
      if (category) categories.push(category);
    }
    return categories;
  }

  async getVideosByCategory(categoryId: string): Promise<Video[]> {
    const videoIds = this.videoCategories
      .filter(vc => vc.categoryId === categoryId)
      .map(vc => vc.videoId);
    
    const videos: Video[] = [];
    for (const id of videoIds) {
      const video = this.videos.get(id);
      if (video) videos.push(video);
    }
    return videos.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // Video-Tag relationships
  async addVideoTag(videoId: string, tagId: string): Promise<void> {
    // Check if relationship already exists
    const exists = this.videoTags.some(
      vt => vt.videoId === videoId && vt.tagId === tagId
    );
    if (!exists) {
      this.videoTags.push({ videoId, tagId });
    }
  }

  async removeVideoTag(videoId: string, tagId: string): Promise<void> {
    this.videoTags = this.videoTags.filter(
      vt => !(vt.videoId === videoId && vt.tagId === tagId)
    );
  }

  async getTagsByVideo(videoId: string): Promise<Tag[]> {
    const tagIds = this.videoTags
      .filter(vt => vt.videoId === videoId)
      .map(vt => vt.tagId);
    
    const tags: Tag[] = [];
    for (const id of tagIds) {
      const tag = this.tags.get(id);
      if (tag) tags.push(tag);
    }
    return tags;
  }

  async getVideosByTag(tagId: string): Promise<Video[]> {
    const videoIds = this.videoTags
      .filter(vt => vt.tagId === tagId)
      .map(vt => vt.videoId);
    
    const videos: Video[] = [];
    for (const id of videoIds) {
      const video = this.videos.get(id);
      if (video) videos.push(video);
    }
    return videos.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // Enhanced video filtering
  async getVideosByTenantFiltered(
    tenantId: string, 
    filters?: { categoryId?: string; tagId?: string }
  ): Promise<Video[]> {
    let videos: Video[] = [];

    if (filters?.categoryId) {
      videos = await this.getVideosByCategory(filters.categoryId);
      videos = videos.filter(v => v.tenantId === tenantId);
    } else if (filters?.tagId) {
      videos = await this.getVideosByTag(filters.tagId);
      videos = videos.filter(v => v.tenantId === tenantId);
    } else {
      videos = await this.getVideosByTenant(tenantId);
    }

    return videos;
  }
}

export const db = new Database();
