import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client.ts';
import {
  cleanupUser,
  createTestApp,
  createUser,
  loginAs,
} from './helpers.ts';

const app = createTestApp();

const SPOOF_IP = '203.0.113.7';

/** Login complet avec une IP simulée (chaîne de confiance CF-Connecting-IP). */
async function loginAgent(username: string, password: string) {
  const agent = request.agent(app);
  const csrfRes = await agent.get('/api/auth/csrf');
  const token = csrfRes.body.csrfToken as string;
  const login = await agent
    .post('/api/auth/login')
    .set('X-CSRF-Token', token)
    .set('CF-Connecting-IP', SPOOF_IP)
    .send({ username, password });
  return { agent, login, csrf: { token } };
}

describe('GET /api/admin/users/:id/login-history (historique cible)', () => {
  it('historique : SUCCESS, FAILURE et LOGOUT, plus recent d abord, IP fiable', async () => {
    const { user: admin, password: adminPw } = await createUser({ role: 'ADMIN' });
    const { user: target, password: targetPw } = await createUser();
    try {
      const { agent, csrf: _csrf } = await loginAs(app, admin.username, adminPw);

      const { agent: targetAgent, login: okLogin, csrf: targetCsrf } = await loginAgent(target.username, targetPw);
      expect(okLogin.status).toBe(200);

      const badLogin = await loginAgent(target.username, 'MauvaisMdp!1');
      expect(badLogin.login.status).toBe(401);

      await targetAgent.post('/api/auth/logout').set('X-CSRF-Token', targetCsrf.token);

      const res = await agent.get(`/api/admin/users/${target.id}/login-history?page=1&pageSize=50`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.pagination.total).toBe(3);

      const results = res.body.data.map((e: { result: string }) => e.result);
      expect(results).toEqual(expect.arrayContaining(['LOGOUT', 'FAILURE', 'SUCCESS']));
      expect(res.body.data[0].result).toBe('LOGOUT');

      const success = res.body.data.find((e: { result: string }) => e.result === 'SUCCESS');
      expect(success.ip).toBe(SPOOF_IP);
      expect(typeof success.source_port).toBe('number');
      expect(success.access_type).toBe('USER');
      expect(success.session_id_masked).toMatch(/^[a-f0-9]{8}\.\.\.$/);

      const failure = res.body.data.find((e: { result: string }) => e.result === 'FAILURE');
      expect(failure.session_id_masked).toBeNull();
    } finally {
      await cleanupUser(admin.id);
      await cleanupUser(target.id);
    }
  });

  it('session_id masque : prefixe 8 caracteres suivi de ... jamais la valeur complete', async () => {
    const { user: admin, password: adminPw } = await createUser({ role: 'ADMIN' });
    const { user: target, password: targetPw } = await createUser();
    try {
      const { agent, csrf: _csrf } = await loginAs(app, admin.username, adminPw);
      const { login } = await loginAgent(target.username, targetPw);
      expect(login.status).toBe(200);
      const sessionRow = await prisma.session.findFirst({
        where: { user_id: target.id },
        orderBy: { created_at: 'desc' },
      });
      const sessionId = sessionRow!.id;

      const res = await agent.get(`/api/admin/users/${target.id}/login-history?page=1&pageSize=50`);
      const success = res.body.data.find((e: { result: string }) => e.result === 'SUCCESS');
      expect(success.session_id_masked).toBe(`${sessionId.slice(0, 8)}...`);
      expect(success.session_id_masked).not.toContain(sessionId);
    } finally {
      await cleanupUser(admin.id);
      await cleanupUser(target.id);
    }
  });

  it('filtres result et periode from/to', async () => {
    const { user: admin, password: adminPw } = await createUser({ role: 'ADMIN' });
    const { user: target, password: targetPw } = await createUser();
    try {
      const { agent, csrf: _csrf } = await loginAs(app, admin.username, adminPw);
      await loginAgent(target.username, targetPw);
      await loginAgent(target.username, 'MauvaisMdp!1');

      const failed = await agent.get(
        `/api/admin/users/${target.id}/login-history?result=FAILURE&pageSize=50`,
      );
      expect(failed.body.data).toHaveLength(1);
      expect(failed.body.data[0].result).toBe('FAILURE');

      const from = new Date().toISOString();
      const emptyTo = await agent.get(
        `/api/admin/users/${target.id}/login-history?from=${encodeURIComponent(from)}&pageSize=50`,
      );
      expect(emptyTo.body.pagination.total).toBe(0);

      const emptyFrom = await agent.get(
        `/api/admin/users/${target.id}/login-history?to=2020-01-01T00:00:00Z&pageSize=50`,
      );
      expect(emptyFrom.body.pagination.total).toBe(0);
    } finally {
      await cleanupUser(admin.id);
      await cleanupUser(target.id);
    }
  });

  it('utilisateur introuvable → 404', async () => {
    const { user: admin, password: adminPw } = await createUser({ role: 'ADMIN' });
    try {
      const { agent } = await loginAs(app, admin.username, adminPw);
      const res = await agent.get('/api/admin/users/00000000-0000-4000-8000-000000000000/login-history');
      expect(res.status).toBe(404);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('USER → 403', async () => {
    const { user, password } = await createUser({ role: 'USER' });
    const { user: target } = await createUser();
    try {
      const { agent } = await loginAs(app, user.username, password);
      const res = await agent.get(`/api/admin/users/${target.id}/login-history`);
      expect(res.status).toBe(403);
    } finally {
      await cleanupUser(user.id);
      await cleanupUser(target.id);
    }
  });
});

describe('GET /api/admin/login-history (historique global)', () => {
  it('recherche par username et filtre par resultat', async () => {
    const { user: admin, password: adminPw } = await createUser({ role: 'ADMIN' });
    const { user: target, password: targetPw } = await createUser();
    try {
      const { agent } = await loginAs(app, admin.username, adminPw);
      await loginAgent(target.username, targetPw);
      await loginAgent(target.username, 'MauvaisMdp!1');

      const res = await agent.get('/api/admin/login-history?page=1&pageSize=50');
      expect(res.status).toBe(200);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(3);

      const searched = await agent.get(
        `/api/admin/login-history?search=${encodeURIComponent(target.username)}&pageSize=50`,
      );
      expect(searched.body.pagination.total).toBeGreaterThanOrEqual(2);
      for (const e of searched.body.data) expect(e.username).toBe(target.username);

      const failed = await agent.get('/api/admin/login-history?result=FAILURE&pageSize=50');
      for (const e of failed.body.data) expect(e.result).toBe('FAILURE');
    } finally {
      await cleanupUser(admin.id);
      await cleanupUser(target.id);
    }
  });

  it('USER → 403', async () => {
    const { user, password } = await createUser({ role: 'USER' });
    try {
      const { agent } = await loginAs(app, user.username, password);
      const res = await agent.get('/api/admin/login-history');
      expect(res.status).toBe(403);
    } finally {
      await cleanupUser(user.id);
    }
  });
});
