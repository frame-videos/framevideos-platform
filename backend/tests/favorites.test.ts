import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import favoritesRouter from '../src/routes/favorites';

describe('Favorites API', () => {
  const app = new Hono();
  const token = 'Bearer test_token';

  beforeAll(() => {
    app.route('/api/favorites', favoritesRouter);
  });

  it('should get user favorites', async () => {
    const res = await app.request('/api/favorites', {
      headers: { 'Authorization': token },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBeDefined();
    expect(Array.isArray(data.videos)).toBe(true);
  });

  it('should add video to favorites', async () => {
    const res = await app.request('/api/favorites', {
      method: 'POST',
      headers: { 'Authorization': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: 'video123' }),
    });
    expect([201, 409]).toContain(res.status);
  });

  it('should remove video from favorites', async () => {
    const res = await app.request('/api/favorites/video123', {
      method: 'DELETE',
      headers: { 'Authorization': token },
    });
    expect([200, 404]).toContain(res.status);
  });

  it('should check if video is favorite', async () => {
    const res = await app.request('/api/favorites/video123', {
      headers: { 'Authorization': token },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.isFavorite).toBe('boolean');
  });

  it('should return 401 without token', async () => {
    const res = await app.request('/api/favorites');
    expect(res.status).toBe(401);
  });
});
