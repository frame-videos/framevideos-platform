// Analytics Module for Frame Videos
// Tracks views, likes, comments, and engagement metrics

export interface VideoAnalytics {
  videoId: string;
  tenantId: string;
  views: number;
  likes: number;
  dislikes: number;
  comments: number;
  shares: number;
  watchTime: number; // Total watch time in seconds
  avgWatchTime: number; // Average watch time per view
  completionRate: number; // % of viewers who watched to the end
  createdAt: string;
  updatedAt: string;
}

export interface UserVideoInteraction {
  id: string;
  userId: string;
  videoId: string;
  tenantId: string;
  liked: boolean;
  disliked: boolean;
  watched: boolean;
  watchTime: number; // Seconds watched
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrendingScore {
  videoId: string;
  score: number;
  views: number;
  likes: number;
  recencyBoost: number;
  calculatedAt: string;
}

export class AnalyticsDatabase {
  private analytics: Map<string, VideoAnalytics> = new Map();
  private interactions: Map<string, UserVideoInteraction> = new Map();
  private trendingCache: Map<string, TrendingScore[]> = new Map(); // Cache per tenant

  // ============================================
  // VIDEO ANALYTICS
  // ============================================

  async getOrCreateAnalytics(videoId: string, tenantId: string): Promise<VideoAnalytics> {
    const existing = this.analytics.get(videoId);
    
    if (existing) {
      return existing;
    }

    const analytics: VideoAnalytics = {
      videoId,
      tenantId,
      views: 0,
      likes: 0,
      dislikes: 0,
      comments: 0,
      shares: 0,
      watchTime: 0,
      avgWatchTime: 0,
      completionRate: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.analytics.set(videoId, analytics);
    return analytics;
  }

  async getAnalytics(videoId: string, tenantId: string): Promise<VideoAnalytics | null> {
    const analytics = this.analytics.get(videoId);
    
    if (!analytics) {
      return null;
    }

    // Tenant isolation
    if (analytics.tenantId !== tenantId) {
      console.warn('[SECURITY] Cross-tenant analytics access attempt', {
        videoId,
        analyticsTenantId: analytics.tenantId,
        requestTenantId: tenantId,
      });
      return null;
    }

    return analytics;
  }

  async incrementViews(videoId: string, tenantId: string): Promise<void> {
    const analytics = await this.getOrCreateAnalytics(videoId, tenantId);
    analytics.views += 1;
    analytics.updatedAt = new Date().toISOString();
    this.analytics.set(videoId, analytics);
    
    // Invalidate trending cache for this tenant
    this.trendingCache.delete(tenantId);
  }

  async incrementLikes(videoId: string, tenantId: string): Promise<void> {
    const analytics = await this.getOrCreateAnalytics(videoId, tenantId);
    analytics.likes += 1;
    analytics.updatedAt = new Date().toISOString();
    this.analytics.set(videoId, analytics);
    
    // Invalidate trending cache
    this.trendingCache.delete(tenantId);
  }

  async decrementLikes(videoId: string, tenantId: string): Promise<void> {
    const analytics = await this.getOrCreateAnalytics(videoId, tenantId);
    analytics.likes = Math.max(0, analytics.likes - 1);
    analytics.updatedAt = new Date().toISOString();
    this.analytics.set(videoId, analytics);
    
    // Invalidate trending cache
    this.trendingCache.delete(tenantId);
  }

  async updateWatchTime(
    videoId: string, 
    tenantId: string, 
    watchTime: number,
    completed: boolean
  ): Promise<void> {
    const analytics = await this.getOrCreateAnalytics(videoId, tenantId);
    
    analytics.watchTime += watchTime;
    
    // Recalculate average watch time
    if (analytics.views > 0) {
      analytics.avgWatchTime = analytics.watchTime / analytics.views;
    }
    
    // Update completion rate (simple approximation)
    if (completed) {
      const currentCompletions = Math.floor((analytics.completionRate / 100) * analytics.views);
      analytics.completionRate = ((currentCompletions + 1) / analytics.views) * 100;
    }
    
    analytics.updatedAt = new Date().toISOString();
    this.analytics.set(videoId, analytics);
  }

  // ============================================
  // USER INTERACTIONS
  // ============================================

  private getInteractionKey(userId: string, videoId: string): string {
    return `${userId}:${videoId}`;
  }

  async getInteraction(userId: string, videoId: string, tenantId: string): Promise<UserVideoInteraction | null> {
    const key = this.getInteractionKey(userId, videoId);
    const interaction = this.interactions.get(key);
    
    if (!interaction) {
      return null;
    }

    // Tenant isolation
    if (interaction.tenantId !== tenantId) {
      return null;
    }

    return interaction;
  }

  async createOrUpdateInteraction(
    userId: string,
    videoId: string,
    tenantId: string,
    updates: Partial<UserVideoInteraction>
  ): Promise<UserVideoInteraction> {
    const key = this.getInteractionKey(userId, videoId);
    const existing = this.interactions.get(key);

    if (existing) {
      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.interactions.set(key, updated);
      return updated;
    }

    const interaction: UserVideoInteraction = {
      id: crypto.randomUUID(),
      userId,
      videoId,
      tenantId,
      liked: false,
      disliked: false,
      watched: false,
      watchTime: 0,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...updates,
    };

    this.interactions.set(key, interaction);
    return interaction;
  }

  async toggleLike(userId: string, videoId: string, tenantId: string): Promise<{ liked: boolean }> {
    const interaction = await this.getInteraction(userId, videoId, tenantId);
    const currentlyLiked = interaction?.liked || false;

    // Update interaction
    await this.createOrUpdateInteraction(userId, videoId, tenantId, {
      liked: !currentlyLiked,
      disliked: false, // Unlike if previously disliked
    });

    // Update analytics
    if (!currentlyLiked) {
      await this.incrementLikes(videoId, tenantId);
    } else {
      await this.decrementLikes(videoId, tenantId);
    }

    return { liked: !currentlyLiked };
  }

  // ============================================
  // TRENDING ALGORITHM
  // ============================================

  /**
   * Calculate trending score for a video
   * Formula: (views * 1.0) + (likes * 5.0) + recencyBoost
   * 
   * Recency boost:
   * - Last 24h: +100
   * - Last 7 days: +50
   * - Last 30 days: +20
   * - Older: 0
   */
  private calculateTrendingScore(
    analytics: VideoAnalytics,
    videoCreatedAt: string
  ): number {
    const viewWeight = 1.0;
    const likeWeight = 5.0;
    
    const viewScore = analytics.views * viewWeight;
    const likeScore = analytics.likes * likeWeight;
    
    // Calculate recency boost
    const now = Date.now();
    const createdAt = new Date(videoCreatedAt).getTime();
    const ageInHours = (now - createdAt) / (1000 * 60 * 60);
    
    let recencyBoost = 0;
    if (ageInHours <= 24) {
      recencyBoost = 100;
    } else if (ageInHours <= 24 * 7) {
      recencyBoost = 50;
    } else if (ageInHours <= 24 * 30) {
      recencyBoost = 20;
    }
    
    return viewScore + likeScore + recencyBoost;
  }

  async getTrending(
    tenantId: string,
    videos: Array<{ id: string; createdAt: string }>,
    limit: number = 10
  ): Promise<TrendingScore[]> {
    // Check cache (valid for 5 minutes)
    const cached = this.trendingCache.get(tenantId);
    if (cached && cached.length > 0) {
      const cacheAge = Date.now() - new Date(cached[0].calculatedAt).getTime();
      if (cacheAge < 5 * 60 * 1000) {
        return cached.slice(0, limit);
      }
    }

    // Calculate scores for all videos
    const scores: TrendingScore[] = [];
    
    for (const video of videos) {
      const analytics = await this.getOrCreateAnalytics(video.id, tenantId);
      const score = this.calculateTrendingScore(analytics, video.createdAt);
      
      scores.push({
        videoId: video.id,
        score,
        views: analytics.views,
        likes: analytics.likes,
        recencyBoost: score - (analytics.views + analytics.likes * 5),
        calculatedAt: new Date().toISOString(),
      });
    }

    // Sort by score (descending)
    scores.sort((a, b) => b.score - a.score);

    // Cache the results
    this.trendingCache.set(tenantId, scores);

    return scores.slice(0, limit);
  }

  // ============================================
  // DASHBOARD STATS
  // ============================================

  async getDashboardStats(tenantId: string, videos: Array<{ id: string }>): Promise<{
    totalViews: number;
    totalLikes: number;
    totalVideos: number;
    avgViewsPerVideo: number;
    avgLikesPerVideo: number;
  }> {
    let totalViews = 0;
    let totalLikes = 0;
    
    for (const video of videos) {
      const analytics = await this.getOrCreateAnalytics(video.id, tenantId);
      totalViews += analytics.views;
      totalLikes += analytics.likes;
    }

    const totalVideos = videos.length;
    
    return {
      totalViews,
      totalLikes,
      totalVideos,
      avgViewsPerVideo: totalVideos > 0 ? totalViews / totalVideos : 0,
      avgLikesPerVideo: totalVideos > 0 ? totalLikes / totalVideos : 0,
    };
  }
}

// Export singleton instance
export const analyticsDb = new AnalyticsDatabase();
