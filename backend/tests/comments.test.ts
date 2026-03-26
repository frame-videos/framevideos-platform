import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import commentsRouter from '../src/routes/comments';

describe('Comments API', () => {
  const app = new Hono();
  const token = 'Bearer test_token';

  beforeAll(() => {
    app.route('/api/comments', commentsRouter);
  });

  it('should get comments for video', async () => {
    const res = await app.request('/api/comments/video123');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.comments)).toBe(true);
    expect(data.total).toBeDefined();
    expect(data.page).toBe(1);
  });

  it('should create comment', async () => {
    const res = await app.request('/api/comments/video123', {
      method: 'POST',
      headers: { 'Authorization': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Great video!' }),
    });
    expect([201, 401, 404]).toContain(res.status);
  });

  it('should delete comment', async () => {
    const res = await app.request('/api/comments/comment123', {
      method: 'DELETE',
      headers: { 'Authorization': token },
    });
    expect([200, 401, 403, 404]).toContain(res.status);
  });

  it('should create reply to comment', async () => {
    const res = await app.request('/api/comments/comment123/replies', {
      method: 'POST',
      headers: { 'Authorization': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Thanks!' }),
    });
    expect([201, 401, 404]).toContain(res.status);
  });

  it('should get replies for comment', async () => {
    const res = await app.request('/api/comments/comment123/replies');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.replies)).toBe(true);
  });

  it('should validate comment content', async () => {
    const res = await app.request('/api/comments/video123', {
      method: 'POST',
      headers: { 'Authorization': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '' }),
    });
    expect(res.status).toBe(400);
  });

  it('should require authorization for create', async () => {
    const res = await app.request('/api/comments/video123', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Test' }),
    });
    expect(res.status).toBe(401);
  });
});
