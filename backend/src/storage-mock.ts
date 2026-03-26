/**
 * Mock Storage Service - Simulates R2 without actual bucket
 * Saves metadata and generates fake URLs for development
 */

export interface UploadResult {
  key: string;
  url: string;
  size: number;
}

export class MockStorageService {
  private baseUrl = 'https://storage.framevideos.com';

  async uploadVideo(
    tenantId: string,
    videoId: string,
    file: ArrayBuffer | File,
    contentType: string = 'video/mp4'
  ): Promise<UploadResult> {
    const size = file instanceof ArrayBuffer ? file.byteLength : file.size;
    const key = `videos/${tenantId}/${videoId}/video.mp4`;
    
    return {
      key,
      url: `${this.baseUrl}/${key}`,
      size,
    };
  }

  async uploadThumbnail(
    tenantId: string,
    videoId: string,
    file: ArrayBuffer | File,
    contentType: string = 'image/jpeg'
  ): Promise<{ key: string; url: string }> {
    const key = `videos/${tenantId}/${videoId}/thumbnail.jpg`;
    
    return {
      key,
      url: `${this.baseUrl}/${key}`,
    };
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const token = Math.random().toString(36).substring(7);
    const expiresAt = Date.now() + expiresIn * 1000;
    return `${this.baseUrl}/${key}?token=${token}&expires=${expiresAt}`;
  }

  async deleteVideo(tenantId: string, videoId: string): Promise<void> {
    // Mock delete - no actual storage
    return;
  }
}

export default MockStorageService;
