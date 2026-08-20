import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client.ts';
import { cleanupUser, createTestApp, createUser, loginAs } from './helpers.ts';

const app = createTestApp();

describe('POST /api/auth/login', () => {
  it('SUCCESS : 200, cookie news.sid, session en base, login_log SUCCESS', async () => {
    const { user, password } = await createUser();
    try {
      const { res } = await loginAs(app, user.username, password);

      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(user.id);
      expect(res.body.user.username).toBe(user.username);
      expect(res.body.user).not.toHaveProperty('password_hash');

      const setCookie = res.headers['set-cookie'];
      expect(String(setCookie)).toContain('news.sid=');
      expect(String(setCookie)).toContain('HttpOnly');
      expect(String(setCookie)).toContain('SameSite=Lax');

      const sessions = await prisma.session.findMany({ where: { user_id: user.id } });
      expect(sessions).toHaveLength(1);

      const log = await prisma.loginLog.findFirst({
        where: { user_id: user.id, result: 'SUCCESS' },
      });
      expect(log).not.toBeNull();
      expect(log!.username).toBe(user.username);
      expect(log!.session_id).toBe(sessions[0].id);

      const updated = await prisma.user.findUnique({ where: { id: user.id } });
      expect(updated!.last_login_at).not.toBeNull();
      expect(updated!.failed_login_attempts).toBe(0);
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('ECHEC : mauvais mot de passe → reponse generique + login_log FAILURE', async () => {
    const { user } = await createUser();
    try {
      const { res } = await loginAs(app, user.username, 'mauvais-mot-de-passe');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toContain('Identifiants');
      expect(JSON.stringify(res.body)).not.toContain('mauvais-mot-de-passe');

      const log = await prisma.loginLog.findFirst({
        where: { user_id: user.id, result: 'FAILURE' },
      });
      expect(log).not.toBeNull();
      expect(log!.username).toBe(user.username);
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('Utilisateur inexistant : reponse generique, pas de fuite d information', async () => {
    const username = `inexistant_${Date.now()}`;
    const { res } = await loginAs(app, username, 'mot-de-passe-quelconque');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.error.message).toContain('Identifiants');
    expect(JSON.stringify(res.body)).not.toContain(username);
    expect(JSON.stringify(res.body)).not.toContain('inexistant');

    const log = await prisma.loginLog.findFirst({
      where: { username, result: 'FAILURE' },
    });
    expect(log).not.toBeNull();
    expect(log!.user_id).toBeNull();
  });

  it('Utilisateur desactive : refus', async () => {
    const { user, password } = await createUser({ status: 'DISABLED' });
    try {
      const { res } = await loginAs(app, user.username, password);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('validation Zod : corps invalide → 400 VALIDATION_ERROR', async () => {
    const agent = request.agent(app);
    const csrf = await (async () => {
      const r = await agent.get('/api/auth/csrf');
      const setCookie = String(r.headers['set-cookie']);
      const match = setCookie.match(/news\.csrf=([^;]+)/);
      return { token: r.body.csrfToken, cookie: match ? match[1] : '' };
    })();
    const res = await agent
      .post('/api/auth/login')
      .set('Cookie', `news.csrf=${csrf.cookie}`)
      .set('X-CSRF-Token', csrf.token)
      .send({ username: '', password: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('login propre : aucune fixation de session (nouvelle session a chaque login)', async () => {
    const { user, password } = await createUser();
    try {
      const first = await loginAs(app, user.username, password);
      const second = await loginAs(app, user.username, password);

      const cookie1 = String(first.res.headers['set-cookie']);
      const cookie2 = String(second.res.headers['set-cookie']);
      expect(cookie1).not.toBe(cookie2);

      const sessions = await prisma.session.findMany({ where: { user_id: user.id } });
      expect(sessions.length).toBeGreaterThanOrEqual(2);
    } finally {
      await cleanupUser(user.id);
    }
  });
});
