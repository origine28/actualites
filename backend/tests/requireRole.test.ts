import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { cleanupUser, createTestApp, createUser, loginAs } from './helpers.ts';

const app = createTestApp({ exposeTestRoutes: true });

describe('requireRole (route /api/test/protected, test uniquement)', () => {
  it('sans authentification → 401', async () => {
    const res = await request(app).get('/api/test/protected');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('ADMIN → autorise', async () => {
    const { user, password } = await createUser({ role: 'ADMIN' });
    try {
      const { agent } = await loginAs(app, user.username, password);
      const res = await agent.get('/api/test/protected');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('USER → 403 FORBIDDEN', async () => {
    const { user, password } = await createUser({ role: 'USER' });
    try {
      const { agent } = await loginAs(app, user.username, password);
      const res = await agent.get('/api/test/protected');
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('la route de test est absente de l API de production (exposeTestRoutes false)', async () => {
    const prodApp = createTestApp({ exposeTestRoutes: false });
    const res = await request(prodApp).get('/api/test/protected');
    expect(res.status).toBe(404);
  });
});
