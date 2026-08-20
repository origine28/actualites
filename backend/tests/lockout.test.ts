import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/db/client.ts';
import { cleanupUser, createTestApp, createUser, fetchCsrf } from './helpers.ts';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Lockout par compte (5 echecs → blocage 15 min, configurable en test)', () => {
  it('verrouille le compte apres max echecs, refuse la bonne tentative, puis debloque', async () => {
    const app = createTestApp({ lockout: { maxAttempts: 3, lockoutMinutes: 0.001 }, loginRateLimit: null });
    const { user, password } = await createUser();
    try {
      const agent = request.agent(app);
      const csrf = await fetchCsrf(app, agent);

      for (let i = 0; i < 3; i += 1) {
        const res = await agent
          .post('/api/auth/login')
          .set('Cookie', csrf.cookieHeader)
          .set('X-CSRF-Token', csrf.token)
          .send({ username: user.username, password: 'mauvais-mdp' });
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      }

      const locked = await prisma.user.findUnique({ where: { id: user.id } });
      expect(locked!.failed_login_attempts).toBe(3);
      expect(locked!.locked_until).not.toBeNull();
      expect(locked!.locked_until!.getTime()).toBeGreaterThan(Date.now());

      const correctWhileLocked = await agent
        .post('/api/auth/login')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.token)
        .send({ username: user.username, password });
      expect(correctWhileLocked.status).toBe(401);
      expect(correctWhileLocked.body.error.code).toBe('ACCOUNT_LOCKED');

      await sleep(120);

      const afterExpiry = await agent
        .post('/api/auth/login')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.token)
        .send({ username: user.username, password });
      expect(afterExpiry.status).toBe(200);

      const reset = await prisma.user.findUnique({ where: { id: user.id } });
      expect(reset!.failed_login_attempts).toBe(0);
      expect(reset!.locked_until).toBeNull();
    } finally {
      await cleanupUser(user.id);
    }
  });
});
