import { Hono } from 'hono';
import { MockStorageService } from '../storage-mock';
import { verifyToken, extractToken } from '../auth';
import { secureDb as db } from '../database-secure';
import {
  asyncHandler,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  StorageError,
  validateRequired,
  validateUUID,
  withRetry,
} from '../error-handler';

type Bindings = {
  STORAGE: R2Bucket;
  CACHE: KVNamespace;
};

const storage = new Hono<{ Bindings: Bindings }>();

// ============================================================================
// Authentication Middleware
// ============================================================================

async function authenticate(c: any, next: any) {
  const token = extractToken(c.req.header('Authorization'));
  
  if (!token) {
    throw new AuthenticationError('Authentication required');
  }

  const payload = await verifyToken(token);
  
  if (!payload) {
    throw new AuthenticationError('Invalid or expired token');
  }

  c.set('user', payload);
  await next();
}

// ============================================================================
// Generate Upload URL
// ============================================================================

storage.post('/upload-url', authenticate, asyncHandler(async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { videoId, contentType, expiresIn } = body;

  validateRequired(body, ['videoId']);
  validateUUID(videoId, 'videoId');

  const storageService = new MockStorageService();
  const result = await withRetry(
    () => storageService.generateUploadUrl(
      user.tenantId,
      videoId,
      contentType || 'video/mp4',
      expiresIn || 3600
    ),
    { retryableErrors: ['STORAGE' as any, 'EXTERNAL_API' as any] }
  );

  return c.json({
    uploadUrl: result.uploadUrl,
    key: result.key,
    videoId,
    expiresIn: expiresIn || 3600,
  });
}));

// ============================================================================
// Upload Video
// ============================================================================

storage.post('/upload', authenticate, asyncHandler(async (c) => {
  const user = c.get('user');
  const formData = await c.req.formData();
  
  const file = formData.get('file') as File;
  const videoId = formData.get('videoId') as string;
  const title = formData.get('title') as string;
  const description = formData.get('description') as string;

  if (!file || !videoId || !title) {
    throw new ValidationError('file, videoId, and title are required');
  }

  validateUUID(videoId, 'videoId');

  // Upload to R2
  const storageService = new MockStorageService();
  const buffer = await file.arrayBuffer();
  
  const uploadResult = await withRetry(
    () => storageService.uploadVideo(
      user.tenantId,
      videoId,
      buffer,
      {
        contentType: file.type,
        customMetadata: {
          originalName: file.name,
          uploadedBy: user.userId,
        },
      }
    ),
    { retryableErrors: ['STORAGE' as any] }
  );

  // Create video record in database
  const video = {
    id: videoId,
    tenantId: user.tenantId,
    title,
    description: description || '',
    url: uploadResult.url,
    thumbnailUrl: '',
    duration: 0,
    views: 0,
    createdAt: new Date().toISOString(),
  };

  await withRetry(() => db.createVideo(video));

  console.log('[VIDEO_UPLOADED]', {
    timestamp: new Date().toISOString(),
    videoId,
    tenantId: user.tenantId,
    userId: user.userId,
    size: uploadResult.size,
  });

  return c.json({
    message: 'Video uploaded successfully',
    video,
    storage: {
      key: uploadResult.key,
      size: uploadResult.size,
    },
  }, 201);
}));

// ============================================================================
// Upload Thumbnail
// ============================================================================

storage.post('/thumbnail/:videoId', authenticate, asyncHandler(async (c) => {
  const user = c.get('user');
  const videoId = c.req.param('videoId');
  const formData = await c.req.formData();
  
  validateUUID(videoId, 'videoId');
  
  const file = formData.get('file') as File;

  if (!file) {
    throw new ValidationError('file is required');
  }

  // Verify video exists and belongs to user's tenant
  const video = await withRetry(() => db.getVideoById(videoId));
  
  if (!video) {
    throw new NotFoundError('Video', { videoId });
  }
  
  if (video.tenantId !== user.tenantId) {
    throw new AuthorizationError('Access denied to this video', { videoId, tenantId: user.tenantId });
  }

  // Upload thumbnail to R2
  const storageService = new MockStorageService();
  const buffer = await file.arrayBuffer();
  
  const uploadResult = await withRetry(
    () => storageService.uploadThumbnail(
      user.tenantId,
      videoId,
      buffer,
      { contentType: file.type }
    ),
    { retryableErrors: ['STORAGE' as any] }
  );

  // Update video record with thumbnail URL
  await withRetry(() => db.updateVideo(videoId, { thumbnailUrl: uploadResult.url }));

  console.log('[THUMBNAIL_UPLOADED]', {
    timestamp: new Date().toISOString(),
    videoId,
    tenantId: user.tenantId,
    userId: user.userId,
  });

  return c.json({
    message: 'Thumbnail uploaded successfully',
    thumbnail: uploadResult,
  });
}));

// ============================================================================
// Get Signed URL
// ============================================================================

storage.get('/signed-url/:videoId', authenticate, asyncHandler(async (c) => {
  const user = c.get('user');
  const videoId = c.req.param('videoId');
  const expiresIn = parseInt(c.req.query('expiresIn') || '3600');

  validateUUID(videoId, 'videoId');

  // Verify video exists and belongs to user's tenant
  const video = await withRetry(() => db.getVideoById(videoId));
  
  if (!video) {
    throw new NotFoundError('Video', { videoId });
  }
  
  if (video.tenantId !== user.tenantId) {
    throw new AuthorizationError('Access denied to this video', { videoId, tenantId: user.tenantId });
  }

  // Generate signed URL
  const storageService = new MockStorageService();
  const key = `videos/${user.tenantId}/${videoId}/video.mp4`;
  const signedUrl = await withRetry(
    () => storageService.getSignedUrl(key, { expiresIn }),
    { retryableErrors: ['STORAGE' as any] }
  );

  return c.json({
    signedUrl,
    expiresIn,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  });
}));

// ============================================================================
// Download Video
// ============================================================================

storage.get('/download/:videoId', authenticate, asyncHandler(async (c) => {
  const user = c.get('user');
  const videoId = c.req.param('videoId');

  validateUUID(videoId, 'videoId');

  // Verify video exists and belongs to user's tenant
  const video = await withRetry(() => db.getVideoById(videoId));
  
  if (!video) {
    throw new NotFoundError('Video', { videoId });
  }
  
  if (video.tenantId !== user.tenantId) {
    throw new AuthorizationError('Access denied to this video', { videoId, tenantId: user.tenantId });
  }

  // Get video from R2
  const storageService = new MockStorageService();
  const videoObject = await withRetry(
    () => storageService.getVideo(user.tenantId, videoId),
    { retryableErrors: ['STORAGE' as any] }
  );

  if (!videoObject) {
    throw new StorageError('Video file not found in storage', { videoId });
  }

  // Return video with proper headers
  return new Response(videoObject.body, {
    headers: {
      'Content-Type': videoObject.httpMetadata?.contentType || 'video/mp4',
      'Content-Length': videoObject.size.toString(),
      'Content-Disposition': `attachment; filename="${video.title}.mp4"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}));

// ============================================================================
// Stream Video
// ============================================================================

storage.get('/stream/:videoId', authenticate, asyncHandler(async (c) => {
  const user = c.get('user');
  const videoId = c.req.param('videoId');

  validateUUID(videoId, 'videoId');

  // Verify video exists and belongs to user's tenant
  const video = await withRetry(() => db.getVideoById(videoId));
  
  if (!video) {
    throw new NotFoundError('Video', { videoId });
  }
  
  if (video.tenantId !== user.tenantId) {
    throw new AuthorizationError('Access denied to this video', { videoId, tenantId: user.tenantId });
  }

  // Get video from R2
  const storageService = new MockStorageService();
  const videoObject = await withRetry(
    () => storageService.getVideo(user.tenantId, videoId),
    { retryableErrors: ['STORAGE' as any] }
  );

  if (!videoObject) {
    throw new StorageError('Video file not found in storage', { videoId });
  }

  // Support range requests for video streaming
  const range = c.req.header('Range');
  
  if (range) {
    // Parse range header
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : videoObject.size - 1;
    const chunkSize = end - start + 1;

    // Get range from R2
    const rangeObject = await c.env.STORAGE.get(
      `videos/${user.tenantId}/${videoId}/video.mp4`,
      {
        range: { offset: start, length: chunkSize },
      }
    );

    if (!rangeObject) {
      throw new StorageError('Failed to get video range', { videoId, range });
    }

    return new Response(rangeObject.body, {
      status: 206,
      headers: {
        'Content-Type': videoObject.httpMetadata?.contentType || 'video/mp4',
        'Content-Length': chunkSize.toString(),
        'Content-Range': `bytes ${start}-${end}/${videoObject.size}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  }

  // Return full video
  return new Response(videoObject.body, {
    headers: {
      'Content-Type': videoObject.httpMetadata?.contentType || 'video/mp4',
      'Content-Length': videoObject.size.toString(),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}));

// ============================================================================
// Delete Video
// ============================================================================

storage.delete('/:videoId', authenticate, asyncHandler(async (c) => {
  const user = c.get('user');
  const videoId = c.req.param('videoId');

  validateUUID(videoId, 'videoId');

  // Verify video exists and belongs to user's tenant
  const video = await withRetry(() => db.getVideoById(videoId));
  
  if (!video) {
    throw new NotFoundError('Video', { videoId });
  }
  
  if (video.tenantId !== user.tenantId) {
    throw new AuthorizationError('Access denied to this video', { videoId, tenantId: user.tenantId });
  }

  // Delete from R2
  const storageService = new MockStorageService();
  await withRetry(
    () => storageService.deleteVideo(user.tenantId, videoId),
    { retryableErrors: ['STORAGE' as any] }
  );

  // Delete from database
  await withRetry(() => db.deleteVideo(videoId));

  console.log('[VIDEO_DELETED_FROM_STORAGE]', {
    timestamp: new Date().toISOString(),
    videoId,
    tenantId: user.tenantId,
    userId: user.userId,
  });

  return c.json({
    message: 'Video deleted successfully',
  });
}));

export default storage;
