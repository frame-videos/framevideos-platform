import { R2Bucket } from '@cloudflare/workers-types';

/**
 * Storage service for R2 bucket operations
 * Handles video uploads, thumbnail generation, and signed URLs
 */

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  customMetadata?: Record<string, string>;
}

export interface SignedUrlOptions {
  expiresIn?: number; // seconds, default 3600 (1 hour)
  method?: 'GET' | 'PUT';
}

export class StorageService {
  private bucket: R2Bucket;
  private bucketName: string;

  constructor(bucket: R2Bucket, bucketName: string = 'frame-videos-storage') {
    this.bucket = bucket;
    this.bucketName = bucketName;
  }

  /**
   * Upload a video file to R2
   */
  async uploadVideo(
    tenantId: string,
    videoId: string,
    file: ArrayBuffer | ReadableStream,
    options: UploadOptions = {}
  ): Promise<{ key: string; url: string; size: number }> {
    const key = this.getVideoKey(tenantId, videoId);
    
    const uploadOptions: any = {
      httpMetadata: {
        contentType: options.contentType || 'video/mp4',
      },
      customMetadata: {
        tenantId,
        videoId,
        uploadedAt: new Date().toISOString(),
        ...options.customMetadata,
      },
    };

    await this.bucket.put(key, file, uploadOptions);

    // Get object info to return size
    const object = await this.bucket.head(key);
    
    return {
      key,
      url: this.getPublicUrl(key),
      size: object?.size || 0,
    };
  }

  /**
   * Upload a thumbnail image
   */
  async uploadThumbnail(
    tenantId: string,
    videoId: string,
    image: ArrayBuffer | ReadableStream,
    options: UploadOptions = {}
  ): Promise<{ key: string; url: string }> {
    const key = this.getThumbnailKey(tenantId, videoId);
    
    const uploadOptions: any = {
      httpMetadata: {
        contentType: options.contentType || 'image/jpeg',
        cacheControl: 'public, max-age=31536000', // 1 year cache for thumbnails
      },
      customMetadata: {
        tenantId,
        videoId,
        type: 'thumbnail',
        uploadedAt: new Date().toISOString(),
        ...options.customMetadata,
      },
    };

    await this.bucket.put(key, image, uploadOptions);

    return {
      key,
      url: this.getPublicUrl(key),
    };
  }

  /**
   * Generate a signed URL for secure access
   * Useful for private videos or temporary access
   */
  async getSignedUrl(
    key: string,
    options: SignedUrlOptions = {}
  ): Promise<string> {
    const expiresIn = options.expiresIn || 3600; // 1 hour default
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // R2 doesn't have native signed URLs yet, so we'll use a token-based approach
    // In production, you'd want to implement proper signed URLs with HMAC
    const token = await this.generateAccessToken(key, expiresAt);
    
    return `${this.getPublicUrl(key)}?token=${token}&expires=${expiresAt.getTime()}`;
  }

  /**
   * Get a video file from R2
   */
  async getVideo(tenantId: string, videoId: string): Promise<R2ObjectBody | null> {
    const key = this.getVideoKey(tenantId, videoId);
    return await this.bucket.get(key);
  }

  /**
   * Get a thumbnail from R2
   */
  async getThumbnail(tenantId: string, videoId: string): Promise<R2ObjectBody | null> {
    const key = this.getThumbnailKey(tenantId, videoId);
    return await this.bucket.get(key);
  }

  /**
   * Delete a video and its thumbnail
   */
  async deleteVideo(tenantId: string, videoId: string): Promise<void> {
    const videoKey = this.getVideoKey(tenantId, videoId);
    const thumbnailKey = this.getThumbnailKey(tenantId, videoId);

    await Promise.all([
      this.bucket.delete(videoKey),
      this.bucket.delete(thumbnailKey),
    ]);
  }

  /**
   * List all videos for a tenant
   */
  async listVideos(tenantId: string, limit: number = 100): Promise<string[]> {
    const prefix = `videos/${tenantId}/`;
    const list = await this.bucket.list({ prefix, limit });
    
    return list.objects.map(obj => obj.key);
  }

  /**
   * Get object metadata
   */
  async getMetadata(key: string): Promise<Record<string, string> | null> {
    const object = await this.bucket.head(key);
    return object?.customMetadata || null;
  }

  /**
   * Generate upload URL for direct client uploads
   * This creates a presigned PUT URL that clients can use
   */
  async generateUploadUrl(
    tenantId: string,
    videoId: string,
    contentType: string = 'video/mp4',
    expiresIn: number = 3600
  ): Promise<{ uploadUrl: string; key: string }> {
    const key = this.getVideoKey(tenantId, videoId);
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    const token = await this.generateAccessToken(key, expiresAt);

    return {
      uploadUrl: `${this.getPublicUrl(key)}?token=${token}&expires=${expiresAt.getTime()}&method=PUT`,
      key,
    };
  }

  // Private helper methods

  private getVideoKey(tenantId: string, videoId: string): string {
    return `videos/${tenantId}/${videoId}/video.mp4`;
  }

  private getThumbnailKey(tenantId: string, videoId: string): string {
    return `videos/${tenantId}/${videoId}/thumbnail.jpg`;
  }

  private getPublicUrl(key: string): string {
    // In production, this would be your R2 public bucket URL or custom domain
    return `https://storage.framevideos.com/${key}`;
  }

  private async generateAccessToken(key: string, expiresAt: Date): Promise<string> {
    // Simple token generation - in production use proper HMAC signing
    const data = `${key}:${expiresAt.getTime()}`;
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 32);
  }

  /**
   * Verify access token for signed URLs
   */
  async verifyAccessToken(key: string, token: string, expires: number): Promise<boolean> {
    if (Date.now() > expires) {
      return false;
    }

    const expiresAt = new Date(expires);
    const expectedToken = await this.generateAccessToken(key, expiresAt);
    
    return token === expectedToken;
  }
}

/**
 * Thumbnail optimization utilities
 */
export class ThumbnailService {
  /**
   * Generate thumbnail from video at specific timestamp
   * This is a placeholder - actual implementation would use Workers AI or external service
   */
  static async generateFromVideo(
    videoBuffer: ArrayBuffer,
    timestamp: number = 0
  ): Promise<ArrayBuffer> {
    // TODO: Implement with Cloudflare Workers AI or external service
    // For now, return empty buffer as placeholder
    throw new Error('Thumbnail generation not yet implemented. Use external service or upload manually.');
  }

  /**
   * Optimize thumbnail image (resize, compress)
   * This is a placeholder - actual implementation would use Workers AI or Image Resizing
   */
  static async optimize(
    imageBuffer: ArrayBuffer,
    maxWidth: number = 640,
    maxHeight: number = 360,
    quality: number = 85
  ): Promise<ArrayBuffer> {
    // TODO: Implement with Cloudflare Image Resizing or Workers AI
    // For now, return original buffer
    throw new Error('Thumbnail optimization not yet implemented. Use Cloudflare Image Resizing.');
  }
}

export default StorageService;
