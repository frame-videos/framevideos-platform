import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import recommendationsRouter from '../src/routes/recommendations';

describe('Recommendations API', () => {
  let app: Hono;
  let testToken: string;

  beforeAll(async () => {
    app = new Hono();
    app.route('/api/recommendations', recommendationsRouter);

    // Mock token
    testToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNzExNDAwMDAwfQ.test';
  });

  describe('GET /api/recommendations', () => {
    it('should return trending videos', async () => {
      const res = await app.request('/api/recommendations?type=trending&limit=5', {
        headers: {
          'Authorization': testToken,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.type).toBe('trending');
      expect(data.count).toBeLessThanOrEqual(5);
      expect(Array.isArray(data.videos)).toBe(true);
    });

    it('should return popular videos', async () => {
      const res = await app.request('/api/recommendations?type=popular&limit=10', {
        headers: {
          'Authorization': testToken,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.type).toBe('popular');
      expect(Array.isArray(data.videos)).toBe(true);
    });

    it('should return similar videos when videoId is provided', async () => {
      const res = await app.request('/api/recommendations?type=similar&videoId=123&limit=5', {
        headers: {
          'Authorization': testToken,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.type).toBe('similar');
    });

    it('should return personalized recommendations', async () => {
      const res = await app.request('/api/recommendations?type=personalized&limit=10', {
        headers: {
          'Authorization': testToken,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.type).toBe('personalized');
      expect(Array.isArray(data.videos)).toBe(true);
    });

    it('should return 401 without token', async () => {
      const res = await app.request('/api/recommendations');
      expect(res.status).toBe(401);
    });

    it('should validate limit parameter', async () => {
      const res = await app.request('/api/recommendations?limit=1000', {
        headers: {
          'Authorization': testToken,
        },
      });

      expect(res.status).toBe(400);
    });

    it('should require videoId for similar recommendations', async () => {
      const res = await app.request('/api/recommendations?type=similar', {
        headers: {
          'Authorization': testToken,
        },
      });

      expect(res.status).toBe(400);
    });
  });
});
