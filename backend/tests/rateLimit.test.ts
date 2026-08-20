import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestApp, fetchCsrf } from './helpers.ts';

describe('Rate limiting de POST /api/auth/login', () => {
  it('apres max tentatives → 429 RATE_LIMITED, sans bloquer le reste du site', async () => {
    const app = createTestApp({ loginRateLimit: { windowMs: 60_000, max: 3 } });
    const agent = request.agent(app);
    const csrf = await fetchCsrf(app, agent);

    let lastStatus = 0;
    for (let i = 0; i < 3; i += 1) {
      const res = await agent
        .post('/api/auth/login')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.token)
        .send({ username: `inconnu_${i}`, password: 'mot-de-passe' });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(401);

    const limited = await agent
      .post('/api/auth/login')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.token)
      .send({ username: 'inconnu_encore', password: 'mot-de-passe' });
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');

    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);

    const csrfRoute = await request(app).get('/api/auth/csrf');
    expect(csrfRoute.status).toBe(200);
  });
});
