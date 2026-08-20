import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/db/client.ts';
import { cleanupUser, createTestApp, createUser, loginAs } from './helpers.ts';

const app = createTestApp();

describe('POST /api/auth/logout', () => {
  it('login → logout 204 → ancienne session 401 → login_log LOGOUT present', async () => {
    const { user, password } = await createUser();
    try {
      const { agent, csrf } = await loginAs(app, user.username, password);

      const meBefore = await agent.get('/api/auth/me');
      expect(meBefore.status).toBe(200);

      const logout = await agent
        .post('/api/auth/logout')
        .set('X-CSRF-Token', csrf.token);
      expect(logout.status).toBe(204);

      const setCookie = String(logout.headers['set-cookie']);
      expect(setCookie).toContain('news.sid=');
      expect(setCookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);

      const meAfter = await agent.get('/api/auth/me');
      expect(meAfter.status).toBe(401);

      const session = await prisma.session.findFirst({ where: { user_id: user.id } });
      expect(session).not.toBeNull();
      expect(session!.revoked_at).not.toBeNull();

      const log = await prisma.loginLog.findFirst({
        where: { user_id: user.id, result: 'LOGOUT' },
      });
      expect(log).not.toBeNull();
      expect(log!.session_id).toBe(session!.id);
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('le token precedemment utilise ne permet plus l acces', async () => {
    const { user, password } = await createUser();
    try {
      const { res: loginRes, agent, csrf } = await loginAs(app, user.username, password);
      const setCookie = String(loginRes.headers['set-cookie']);
      const sessionToken = setCookie.match(/news\.sid=([^;]+)/)?.[1] ?? '';

      await agent.post('/api/auth/logout').set('X-CSRF-Token', csrf.token);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', `news.sid=${sessionToken}`);
      expect(res.status).toBe(401);
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('logout est idempotent : 204 meme sans session valide', async () => {
    const app2 = createTestApp();
    const agent = request.agent(app2);
    const csrf = await (async () => {
      const r = await agent.get('/api/auth/csrf');
      const setCookie = String(r.headers['set-cookie']);
      const match = setCookie.match(/news\.csrf=([^;]+)/);
      return { token: r.body.csrfToken, cookie: match ? match[1] : '' };
    })();

    const first = await agent.post('/api/auth/logout').set('X-CSRF-Token', csrf.token);
    expect(first.status).toBe(204);
    const second = await agent.post('/api/auth/logout').set('X-CSRF-Token', csrf.token);
    expect(second.status).toBe(204);
  });
});
