import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client.ts';
import {
  cleanupUser,
  createTestApp,
  createUser,
  fetchCsrf,
  loginAs,
} from './helpers.ts';

const app = createTestApp();

/** Rend l'utilisateur donné le SEUL ADMIN actif (isolation pour la règle dernier ADMIN). */
async function isolateSingleActiveAdmin(keepId: string): Promise<string[]> {
  const others = await prisma.user.findMany({
    where: { role: 'ADMIN', status: 'ACTIVE', deleted_at: null, id: { not: keepId } },
    select: { id: true },
  });
  for (const o of others) {
    await prisma.user.update({ where: { id: o.id }, data: { status: 'DISABLED' } });
  }
  return others.map((o) => o.id);
}

async function restoreAdmins(ids: string[]): Promise<void> {
  for (const id of ids) {
    await prisma.user.update({ where: { id }, data: { status: 'ACTIVE' } });
  }
}

/** Login HTTP complet avec jeton CSRF (sessions isolées). */
async function attemptLogin(username: string, password: string) {
  const agent = request.agent(app);
  const csrf = await fetchCsrf(app, agent);
  const res = await agent
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrf.token)
    .send({ username, password });
  return { agent, res };
}

describe('PATCH /api/admin/users/:id/status (desactivation / reactivation)', () => {
  it('USER → 403', async () => {
    const { user, password } = await createUser({ role: 'USER' });
    const { user: target } = await createUser();
    try {
      const { agent } = await loginAs(app, user.username, password);
      const res = await agent.patch(`/api/admin/users/${target.id}/status`).send({ status: 'DISABLED' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    } finally {
      await cleanupUser(user.id);
      await cleanupUser(target.id);
    }
  });

  it('desactivation : statut DISABLED, sessions revoquees en base, login refuse, audit present', async () => {
    const { user: admin, password: adminPw } = await createUser({ role: 'ADMIN' });
    const { user: target, password: targetPw } = await createUser();
    try {
      const { agent, csrf } = await loginAs(app, admin.username, adminPw);

      const { agent: targetAgent } = await attemptLogin(target.username, targetPw);
      const before = await targetAgent.get('/api/auth/me');
      expect(before.status).toBe(200);

      const res = await agent
        .patch(`/api/admin/users/${target.id}/status`)
        .set('X-CSRF-Token', csrf.token)
        .send({ status: 'DISABLED' });
      expect(res.status).toBe(200);
      expect(res.body.user.status).toBe('DISABLED');

      const stored = await prisma.user.findUnique({ where: { id: target.id } });
      expect(stored!.status).toBe('DISABLED');

      const sessions = await prisma.session.findMany({ where: { user_id: target.id } });
      expect(sessions.length).toBeGreaterThan(0);
      for (const s of sessions) expect(s.revoked_at).not.toBeNull();

      const meAfter = await targetAgent.get('/api/auth/me');
      expect(meAfter.status).toBe(401);

      const { res: loginAfter } = await attemptLogin(target.username, targetPw);
      expect(loginAfter.status).toBe(401);
      expect(loginAfter.body.error.code).toBe('ACCOUNT_DISABLED');

      const audits = await prisma.auditLog.findMany({
        where: { action: 'USER_DISABLED', entity_id: target.id },
      });
      expect(audits.length).toBeGreaterThan(0);
      expect(audits[0].user_id).toBe(admin.id);
      expect(JSON.stringify(audits[0].metadata)).not.toContain('password');
    } finally {
      await cleanupUser(admin.id);
      await cleanupUser(target.id);
    }
  });

  it('reactivation : ACTIVE, login a nouveau possible, audit USER_ENABLED', async () => {
    const { user: admin, password: adminPw } = await createUser({ role: 'ADMIN' });
    const { user: target, password: targetPw } = await createUser({ status: 'DISABLED' });
    try {
      const { agent, csrf } = await loginAs(app, admin.username, adminPw);

      const res = await agent
        .patch(`/api/admin/users/${target.id}/status`)
        .set('X-CSRF-Token', csrf.token)
        .send({ status: 'ACTIVE' });
      expect(res.status).toBe(200);
      expect(res.body.user.status).toBe('ACTIVE');

      const { res: loginAfter } = await attemptLogin(target.username, targetPw);
      expect(loginAfter.status).toBe(200);

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'USER_ENABLED', entity_id: target.id },
      });
      expect(audit).not.toBeNull();
    } finally {
      await cleanupUser(admin.id);
      await cleanupUser(target.id);
    }
  });

  it('desactiver deja desactive → 409 ALREADY_DISABLED', async () => {
    const { user: admin, password: adminPw } = await createUser({ role: 'ADMIN' });
    const { user: target } = await createUser({ status: 'DISABLED' });
    try {
      const { agent, csrf } = await loginAs(app, admin.username, adminPw);
      const res = await agent
        .patch(`/api/admin/users/${target.id}/status`)
        .set('X-CSRF-Token', csrf.token)
        .send({ status: 'DISABLED' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_DISABLED');
    } finally {
      await cleanupUser(admin.id);
      await cleanupUser(target.id);
    }
  });

  it('un ADMIN peut desactiver un autre ADMIN (au moins un ADMIN actif reste)', async () => {
    const { user: adminA, password: pwA } = await createUser({ role: 'ADMIN' });
    const { user: adminB } = await createUser({ role: 'ADMIN' });
    try {
      const { agent, csrf } = await loginAs(app, adminA.username, pwA);
      const res = await agent
        .patch(`/api/admin/users/${adminB.id}/status`)
        .set('X-CSRF-Token', csrf.token)
        .send({ status: 'DISABLED' });
      expect(res.status).toBe(200);
      expect(res.body.user.status).toBe('DISABLED');
    } finally {
      await cleanupUser(adminA.id);
      await cleanupUser(adminB.id);
    }
  });

  it('dernier ADMIN actif ne peut pas se desactiver lui-meme → 409 LAST_ADMIN', async () => {
    const { user: admin, password } = await createUser({ role: 'ADMIN' });
    const isolated = await isolateSingleActiveAdmin(admin.id);
    try {
      const { agent, csrf } = await loginAs(app, admin.username, password);
      const res = await agent
        .patch(`/api/admin/users/${admin.id}/status`)
        .set('X-CSRF-Token', csrf.token)
        .send({ status: 'DISABLED' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('LAST_ADMIN');

      const stored = await prisma.user.findUnique({ where: { id: admin.id } });
      expect(stored!.status).toBe('ACTIVE');
    } finally {
      await restoreAdmins(isolated);
      await cleanupUser(admin.id);
    }
  });
});
