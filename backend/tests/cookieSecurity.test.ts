import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { cleanupUser, createTestApp, createUser, fetchCsrf } from './helpers.ts';

function parseCookies(setCookieHeader: unknown): Record<string, string> {
  const list = Array.isArray(setCookieHeader) ? setCookieHeader : String(setCookieHeader ?? '').split(',');
  const result: Record<string, string> = {};
  for (const raw of list) {
    const match = raw.trim().match(/^(news\.sid|news\.csrf)=([^;]*);(.*)$/);
    if (!match) continue;
    result[match[1]] = match[3].toLowerCase();
  }
  return result;
}

describe('Sécurité des cookies', () => {
  it('développement (HTTP local) : news.sid = HttpOnly, SameSite=Lax, sans Secure', async () => {
    const app = createTestApp({ cookieSecure: false });
    const { user, password } = await createUser();
    try {
      const httpAgent = request.agent(app);
      const csrf = await fetchCsrf(app, httpAgent);
      const login = await httpAgent
        .post('/api/auth/login')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.token)
        .send({ username: user.username, password });
      expect(login.status).toBe(200);

      const cookies = parseCookies(login.headers['set-cookie']);
      expect(cookies['news.sid']).toContain('httponly');
      expect(cookies['news.sid']).toContain('samesite=lax');
      expect(cookies['news.sid']).toContain('path=/');
      expect(cookies['news.sid']).not.toContain('secure');
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('production : news.sid = HttpOnly, Secure, SameSite=Lax', async () => {
    const app = createTestApp({ cookieSecure: true });
    const { user, password } = await createUser();
    try {
      const httpAgent = request.agent(app);
      const csrf = await fetchCsrf(app, httpAgent);
      const login = await httpAgent
        .post('/api/auth/login')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.token)
        .send({ username: user.username, password });
      expect(login.status).toBe(200);

      const cookies = parseCookies(login.headers['set-cookie']);
      expect(cookies['news.sid']).toContain('httponly');
      expect(cookies['news.sid']).toContain('samesite=lax');
      expect(cookies['news.sid']).toContain('secure');
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('news.csrf est lisible par le frontend (sans HttpOnly)', async () => {
    const app = createTestApp({ cookieSecure: false });
    const httpAgent = request.agent(app);
    const res = await httpAgent.get('/api/auth/csrf');
    const cookies = parseCookies(res.headers['set-cookie']);
    expect(cookies['news.csrf']).toBeDefined();
    expect(cookies['news.csrf']).not.toContain('httponly');
    expect(cookies['news.csrf']).toContain('samesite=lax');
  });
});
