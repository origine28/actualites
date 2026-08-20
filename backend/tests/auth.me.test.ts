import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { cleanupUser, createTestApp, createUser, loginAs } from './helpers.ts';

const app = createTestApp();

describe('GET /api/auth/me', () => {
  it('sans session → 401 AUTH_REQUIRED', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('avec session → 200 avec les champs attendus, jamais password_hash', async () => {
    const { user, password } = await createUser();
    try {
      const { res: loginRes, agent } = await loginAs(app, user.username, password);
      expect(loginRes.status).toBe(200);

      const me = await agent.get('/api/auth/me');
      expect(me.status).toBe(200);
      expect(me.body.user.id).toBe(user.id);
      expect(me.body.user.username).toBe(user.username);
      expect(me.body.user.email).toBe(user.email);
      expect(me.body.user.role).toBe('USER');
      expect(me.body.user.status).toBe('ACTIVE');
      expect(me.body.user).toHaveProperty('first_name');
      expect(me.body.user).toHaveProperty('last_name');
      expect(me.body.user).toHaveProperty('last_login_at');
      expect(me.body.user).toHaveProperty('created_at');
      expect(me.body.user).not.toHaveProperty('password_hash');
      expect(JSON.stringify(me.body)).not.toContain('news.sid');
      expect(JSON.stringify(me.body)).not.toContain('token');
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('retourne Cache-Control: private, no-store', async () => {
    const { user, password } = await createUser();
    try {
      const { agent } = await loginAs(app, user.username, password);
      const me = await agent.get('/api/auth/me');
      expect(me.headers['cache-control']).toContain('private');
      expect(me.headers['cache-control']).toContain('no-store');
    } finally {
      await cleanupUser(user.id);
    }
  });
});
