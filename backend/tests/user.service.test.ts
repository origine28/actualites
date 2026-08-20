import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client.ts';
import { userService } from '../src/services/user.service.ts';
import type { AuthUser, ClientInfo } from '../src/types/auth.ts';
import { cleanupUser, createTestApp, createUser, loginAs } from './helpers.ts';

describe('Désactivation d un utilisateur (service)', () => {
  it('ACTIVE → DISABLED, révoque toutes les sessions, prochain accès 401, audit present', async () => {
    const app = createTestApp();
    const { user, password } = await createUser();
    const { user: admin } = await createUser({ role: 'ADMIN' });
    try {
      const { agent } = await loginAs(app, user.username, password);
      const meBefore = await agent.get('/api/auth/me');
      expect(meBefore.status).toBe(200);

      const adminAuth: AuthUser = {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        status: admin.status,
        first_name: admin.first_name,
        last_name: admin.last_name,
        last_login_at: admin.last_login_at,
        created_at: admin.created_at,
      };
      const clientInfo: ClientInfo = { ip: '127.0.0.1', sourcePort: null, userAgent: 'vitest' };
      await userService.disableUser(user.id, adminAuth, clientInfo);

      const stored = await prisma.user.findUnique({ where: { id: user.id } });
      expect(stored!.status).toBe('DISABLED');

      const sessions = await prisma.session.findMany({ where: { user_id: user.id } });
      for (const session of sessions) {
        expect(session.revoked_at).not.toBeNull();
      }

      const meAfter = await agent.get('/api/auth/me');
      expect(meAfter.status).toBe(401);

      const audits = await prisma.auditLog.findMany({
        where: { entity_id: user.id, action: { in: ['USER_DISABLED', 'SESSION_REVOKED'] } },
      });
      const actions = audits.map((a) => a.action);
      expect(actions).toContain('USER_DISABLED');
      expect(actions).toContain('SESSION_REVOKED');
    } finally {
      await cleanupUser(user.id);
      await cleanupUser(admin.id);
    }
  });

  it('refuse la desactivation d un utilisateur deja desactive', async () => {
    const { user: disabled } = await createUser({ status: 'DISABLED' });
    const { user: admin } = await createUser({ role: 'ADMIN' });
    try {
      const adminAuth: AuthUser = {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        status: admin.status,
        first_name: admin.first_name,
        last_name: admin.last_name,
        last_login_at: admin.last_login_at,
        created_at: admin.created_at,
      };
      await expect(
        userService.disableUser(disabled.id, adminAuth, { ip: '127.0.0.1', sourcePort: null, userAgent: 'vitest' }),
      ).rejects.toMatchObject({ status: 409, code: 'ALREADY_DISABLED' });
    } finally {
      await cleanupUser(disabled.id);
      await cleanupUser(admin.id);
    }
  });
});
