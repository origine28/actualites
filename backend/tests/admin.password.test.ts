import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client.ts';
import { verifyPassword } from '../src/services/password.service.ts';
import {
  cleanupUser,
  createTestApp,
  createUser,
  loginAs,
} from './helpers.ts';

const app = createTestApp();

const NEW_PASSWORD = 'NouveauP@ssw0rd!';

async function loginAgent(username: string, password: string) {
  const agent = request.agent(app);
  const csrfRes = await agent.get('/api/auth/csrf');
  const token = csrfRes.body.csrfToken as string;
  const login = await agent
    .post('/api/auth/login')
    .set('X-CSRF-Token', token)
    .send({ username, password });
  return { agent, login };
}

describe('POST /api/admin/users/:id/reset-password (reinitialisation)', () => {
  it('USER → 403', async () => {
    const { user, password } = await createUser({ role: 'USER' });
    const { user: target } = await createUser();
    try {
      const { agent } = await loginAs(app, user.username, password);
      const res = await agent
        .post(`/api/admin/users/${target.id}/reset-password`)
        .send({ password: NEW_PASSWORD });
      expect(res.status).toBe(403);
    } finally {
      await cleanupUser(user.id);
      await cleanupUser(target.id);
    }
  });

  it('reinitialisation : hash change en base, ancien mdp refuse, nouveau accepte, sessions revoquees', async () => {
    const { user: admin, password: adminPw } = await createUser({ role: 'ADMIN' });
    const { user: target, password: targetPw } = await createUser();
    try {
      const { agent, csrf } = await loginAs(app, admin.username, adminPw);
      const { agent: targetAgent } = await loginAgent(target.username, targetPw);
      const me = await targetAgent.get('/api/auth/me');
      expect(me.status).toBe(200);

      const res = await agent
        .post(`/api/admin/users/${target.id}/reset-password`)
        .set('X-CSRF-Token', csrf.token)
        .send({ password: NEW_PASSWORD });
      expect(res.status).toBe(204);

      const stored = await prisma.user.findUnique({ where: { id: target.id } });
      expect(await verifyPassword(NEW_PASSWORD, stored!.password_hash)).toBe(true);
      expect(await verifyPassword(targetPw, stored!.password_hash)).toBe(false);

      const sessions = await prisma.session.findMany({ where: { user_id: target.id } });
      expect(sessions.length).toBeGreaterThan(0);
      for (const s of sessions) expect(s.revoked_at).not.toBeNull();

      const meAfter = await targetAgent.get('/api/auth/me');
      expect(meAfter.status).toBe(401);

      const oldLogin = await loginAgent(target.username, targetPw);
      expect(oldLogin.login.status).toBe(401);

      const newLogin = await loginAgent(target.username, NEW_PASSWORD);
      expect(newLogin.login.status).toBe(200);

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'USER_PASSWORD_RESET', entity_id: target.id },
      });
      expect(audit).not.toBeNull();
      expect(audit!.user_id).toBe(admin.id);
      expect(JSON.stringify(audit!.metadata)).not.toContain('password');
    } finally {
      await cleanupUser(admin.id);
      await cleanupUser(target.id);
    }
  });

  it('mot de passe faible → 400', async () => {
    const { user: admin, password: adminPw } = await createUser({ role: 'ADMIN' });
    const { user: target } = await createUser();
    try {
      const { agent, csrf } = await loginAs(app, admin.username, adminPw);
      const res = await agent
        .post(`/api/admin/users/${target.id}/reset-password`)
        .set('X-CSRF-Token', csrf.token)
        .send({ password: 'court' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    } finally {
      await cleanupUser(admin.id);
      await cleanupUser(target.id);
    }
  });

  it('utilisateur introuvable → 404', async () => {
    const { user: admin, password: adminPw } = await createUser({ role: 'ADMIN' });
    try {
      const { agent, csrf } = await loginAs(app, admin.username, adminPw);
      const res = await agent
        .post('/api/admin/users/00000000-0000-4000-8000-000000000000/reset-password')
        .set('X-CSRF-Token', csrf.token)
        .send({ password: NEW_PASSWORD });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    } finally {
      await cleanupUser(admin.id);
    }
  });
});
