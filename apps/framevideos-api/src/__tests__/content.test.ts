// Unit tests — Content routes validation schemas

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Re-create schemas matching content.ts (can't import Hono route directly)
const createVideoSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(500),
  description: z.string().max(10000).optional().default(''),
  slug: z.string().max(300).optional(),
  videoUrl: z.string().url().optional(),
  embedUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  durationSeconds: z.number().int().min(0).optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  categoryIds: z.array(z.string()).max(10).optional().default([]),
  tagIds: z.array(z.string()).max(30).optional().default([]),
  performerIds: z.array(z.string()).max(20).optional().default([]),
  channelId: z.string().optional(),
});

const createCategorySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  slug: z.string().max(150).optional(),
  description: z.string().max(2000).optional().default(''),
  imageUrl: z.string().url().optional(),
  parentId: z.string().optional(),
  sortOrder: z.number().int().min(0).optional().default(0),
});

const bulkVideoActionSchema = z.object({
  ids: z.array(z.string()).min(1).max(50, 'Máximo de 50 itens por vez'),
  action: z.enum(['publish', 'draft', 'archive', 'delete']),
});

describe('Content Routes — Validation', () => {
  describe('Video schemas', () => {
    it('should accept valid video data', () => {
      const data = {
        title: 'Test Video',
        description: 'A test video description',
        status: 'draft',
      };
      const result = createVideoSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject video without title', () => {
      const data = { description: 'No title here' };
      const result = createVideoSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid status', () => {
      const data = { title: 'Test', status: 'invalid' };
      const result = createVideoSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid video URL', () => {
      const data = { title: 'Test', videoUrl: 'not-a-url' };
      const result = createVideoSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should accept video with all optional fields', () => {
      const data = {
        title: 'Full Video',
        description: 'Complete',
        slug: 'full-video',
        videoUrl: 'https://example.com/video.mp4',
        embedUrl: 'https://example.com/embed',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        durationSeconds: 120,
        status: 'published',
        categoryIds: ['cat1', 'cat2'],
        tagIds: ['tag1'],
        performerIds: ['perf1'],
        channelId: 'ch1',
      };
      const result = createVideoSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should default status to draft', () => {
      const data = { title: 'Test' };
      const result = createVideoSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('draft');
      }
    });
  });

  describe('Category schemas', () => {
    it('should accept valid category', () => {
      const data = { name: 'Action', description: 'Action videos' };
      const result = createCategorySchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject category without name', () => {
      const data = { description: 'No name' };
      const result = createCategorySchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should default sortOrder to 0', () => {
      const data = { name: 'Test' };
      const result = createCategorySchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sortOrder).toBe(0);
      }
    });
  });

  describe('Bulk operations', () => {
    it('should accept valid bulk action', () => {
      const data = { ids: ['id1', 'id2'], action: 'publish' };
      const result = bulkVideoActionSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject empty ids array', () => {
      const data = { ids: [], action: 'publish' };
      const result = bulkVideoActionSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid action', () => {
      const data = { ids: ['id1'], action: 'invalid' };
      const result = bulkVideoActionSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject more than 50 items', () => {
      const ids = Array.from({ length: 51 }, (_, i) => `id${i}`);
      const data = { ids, action: 'delete' };
      const result = bulkVideoActionSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });
});
