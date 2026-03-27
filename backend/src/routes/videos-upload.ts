import { Hono } from 'hono';
import { tenantIsolation, getTenantContext } from '../middleware/tenant-isolation';
import {
  asyncHandler,
  ValidationError,
  StorageError,
  validateRequired,
  validateUUID,
  withRetry,
} from '../error-handler';
import { D1Database } from '../database-d1';
import { Video } from '../database';

type Bindings = {
  STORAGE: R2Bucket;
  CACHE: KVNamespace;
};

type Variables = {
  db: D1Database;
};

const upload = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Apply tenant isolation middleware
upload.use('*', tenantIsolation);

// ============================================================================
// Upload Video with Multipart Support
// ============================================================================

upload.post('/', asyncHandler(async (c) => {
  const db = c.get('db');
  const { tenantId, userId } = getTenantContext(c);
  
  // Parse multipart form data
  const formData = await c.req.formData();
  
  const videoFile = formData.get('video') as File;
  const title = formData.get('title') as string;
  const description = formData.get('description') as string || '';
  const category = formData.get('category') as string || '';
  const tags = formData.get('tags') as string || '';

  // Validation
  if (!videoFile) {
    throw new ValidationError('Video file is required');
  }

  if (!title || !title.trim()) {
    throw new ValidationError('Title is required');
  }

  // Validate file type
  const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
  if (!validTypes.includes(videoFile.type)) {
    throw new ValidationError('Invalid video format. Accepted: mp4, mov, avi, mkv');
  }

  // Validate file size (500MB max)
  const maxSize = 500 * 1024 * 1024;
  if (videoFile.size > maxSize) {
    throw new ValidationError('Video file too large. Maximum: 500MB');
  }

  // Generate video ID
  const videoId = crypto.randomUUID();
  
  // Upload to R2
  const key = `videos/${tenantId}/${videoId}/video.mp4`;
  
  try {
    const arrayBuffer = await videoFile.arrayBuffer();
    
    await c.env.STORAGE.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: videoFile.type,
      },
      customMetadata: {
        tenantId,
        userId,
        originalName: videoFile.name,
        uploadedAt: new Date().toISOString(),
      },
    });

    // Generate public URL
    const videoUrl = `https://pub-frame-videos.r2.dev/${key}`;

    // Create video record in database
    const video: any = {
      id: videoId,
      userId,
      tenantId,
      title: title.trim(),
      description: description.trim(),
      status: 'active',
      url: videoUrl,
      thumbnailUrl: '',
      duration: 0,
      views: 0,
      createdAt: new Date().toISOString(),
    };

    await withRetry(() => db.createVideo(video));

    // Process tags if provided
    if (tags && tags.trim()) {
      const tagList = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
      
      for (const tagName of tagList) {
        // Create or get tag
        const tagId = crypto.randomUUID();
        try {
          await db.createTag({ id: tagId, name: tagName, tenantId }, tenantId);
        } catch (err) {
          // Tag might already exist, that's ok
        }
        
        // Link video to tag
        try {
          await db.addVideoTag(videoId, tagId, tenantId);
        } catch (err) {
          console.warn('Failed to add tag:', err);
        }
      }
    }

    console.log('[VIDEO_UPLOADED]', {
      timestamp: new Date().toISOString(),
      videoId,
      tenantId,
      userId,
      size: videoFile.size,
      title,
    });

    return c.json({
      message: 'Video uploaded successfully',
      video,
      storage: {
        key,
        size: videoFile.size,
        url: videoUrl,
      },
    }, 201);

  } catch (error) {
    console.error('[UPLOAD_ERROR]', {
      timestamp: new Date().toISOString(),
      videoId,
      tenantId,
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    throw new StorageError('Failed to upload video to storage', {
      videoId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

// ============================================================================
// Upload Thumbnail
// ============================================================================

upload.post('/:id/thumbnail', asyncHandler(async (c) => {
  const db = c.get('db');
  const videoId = c.req.param('id');
  const { tenantId, userId } = getTenantContext(c);
  
  // Validate UUID
  validateUUID(videoId, 'videoId');
  
  // Verify video exists and belongs to tenant
  const video = await withRetry(() => db.getVideoById(videoId, tenantId));
  
  if (!video) {
    throw new ValidationError('Video not found or access denied');
  }
  
  // Parse form data
  const formData = await c.req.formData();
  const thumbnailFile = formData.get('thumbnail') as File;
  
  if (!thumbnailFile) {
    throw new ValidationError('Thumbnail file is required');
  }
  
  // Validate file type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(thumbnailFile.type)) {
    throw new ValidationError('Invalid thumbnail format. Accepted: jpg, png, webp');
  }
  
  // Upload to R2
  const key = `videos/${tenantId}/${videoId}/thumbnail.jpg`;
  
  try {
    const arrayBuffer = await thumbnailFile.arrayBuffer();
    
    await c.env.STORAGE.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: thumbnailFile.type,
      },
      customMetadata: {
        tenantId,
        userId,
        uploadedAt: new Date().toISOString(),
      },
    });
    
    // Generate public URL
    const thumbnailUrl = `https://pub-frame-videos.r2.dev/${key}`;
    
    // Update video record
    await withRetry(() => db.updateVideo(videoId, { thumbnailUrl }, tenantId));
    
    console.log('[THUMBNAIL_UPLOADED]', {
      timestamp: new Date().toISOString(),
      videoId,
      tenantId,
      userId,
    });
    
    return c.json({
      message: 'Thumbnail uploaded successfully',
      thumbnailUrl,
    });
    
  } catch (error) {
    console.error('[THUMBNAIL_UPLOAD_ERROR]', {
      timestamp: new Date().toISOString(),
      videoId,
      tenantId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    throw new StorageError('Failed to upload thumbnail', {
      videoId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

// ============================================================================
// Generate Auto Thumbnail from Video
// ============================================================================

upload.post('/:id/auto-thumbnail', asyncHandler(async (c) => {
  const db = c.get('db');
  const videoId = c.req.param('id');
  const { tenantId, userId } = getTenantContext(c);
  
  // Validate UUID
  validateUUID(videoId, 'videoId');
  
  // Verify video exists
  const video = await withRetry(() => db.getVideoById(videoId, tenantId));
  
  if (!video) {
    throw new ValidationError('Video not found or access denied');
  }
  
  // For now, return a placeholder response
  // In production, this would use ffmpeg or a video processing service
  return c.json({
    message: 'Auto-thumbnail generation not yet implemented',
    note: 'This feature requires video processing capabilities',
    videoId,
  });
}));

export default upload;
