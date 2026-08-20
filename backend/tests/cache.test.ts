import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { cleanupUser, createTestApp, createUser, fetchCsrf } from './helpers.ts';

describe('Cache des réponses authentifiées', () => {
  it('GET /api/auth/me → Cache-Control: private, no-store', async () => {
    const app = createTestApp();
    const { user, password } = await createUser();
    try {
      const agent = request.agent(app);
      const csrf = await fetchCsrf(app, agent);
      const login = await agent
        .post('/api/auth/login')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.token)
        .send({ username: user.username, password });
      expect(login.status).toBe(200);

      const me = await agent.get('/api/auth/me');
      expect(me.status).toBe(200);
      expect(me.headers['cache-control']).toMatch(/private/);
      expect(me.headers['cache-control']).toMatch(/no-store/);
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('les réponses avec Set-Cookie sont non-cacheables (login)', async () => {
    const app = createTestApp();
    const { user, password } = await createUser();
    try {
      const agent = request.agent(app);
      const csrf = await fetchCsrf(app, agent);
      const login = await agent
        .post('/api/auth/login')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.token)
        .send({ username: user.username, password });
      expect(login.status).toBe(200);
      expect(login.headers['cache-control']).toMatch(/no-store/);
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('toutes les routes /api/auth sont no-store (csrf inclus)', async () => {
    const app = createTestApp();
    const res = await request(app).get('/api/auth/csrf');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/no-store/);
  });
});
