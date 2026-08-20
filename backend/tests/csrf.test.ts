import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { cleanupUser, createTestApp, createUser, fetchCsrf } from './helpers.ts';

const app = createTestApp({ exposeTestRoutes: true });

describe('Protection CSRF', () => {
  it('mutation sans token → 403 CSRF_INVALID', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'x', password: 'y' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });

  it('mutation avec mauvais token → 403 CSRF_INVALID', async () => {
    const agent = request.agent(app);
    const csrf = await fetchCsrf(app, agent);
    const res = await agent
      .post('/api/auth/login')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', 'mauvais-token')
      .send({ username: 'x', password: 'y' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });

  it('mutation avec token valide → autorisee (si autres conditions OK)', async () => {
    const { user, password } = await createUser();
    try {
      const agent = request.agent(app);
      const csrf = await fetchCsrf(app, agent);
      const res = await agent
        .post('/api/auth/login')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.token)
        .send({ username: user.username, password });
      expect(res.status).toBe(200);
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('le token CSRF ne permet pas de contourner l authentification', async () => {
    const agent = request.agent(app);
    const csrf = await fetchCsrf(app, agent);
    const res = await agent
      .get('/api/test/protected')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.token);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('token dans le body uniquement → refuse', async () => {
    const agent = request.agent(app);
    const csrf = await fetchCsrf(app, agent);
    const res = await agent
      .post('/api/auth/login')
      .set('Cookie', csrf.cookieHeader)
      .send({ username: 'x', password: 'y', csrfToken: csrf.token });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });

  it('un token fourni en parametre d URL seul est refuse', async () => {
    const agent = request.agent(app);
    const csrf = await fetchCsrf(app, agent);
    const res = await agent
      .post(`/api/auth/login?csrf=${csrf.token}`)
      .set('Cookie', csrf.cookieHeader)
      .send({ username: 'x', password: 'y' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });
});
