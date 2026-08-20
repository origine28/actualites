import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/db/client.ts';
import { verifyPassword } from '../src/services/password.service.ts';
import {
  cleanupUser,
  createTestApp,
  createUser,
  loginAs,
  TEST_PASSWORD,
} from './helpers.ts';

const app = createTestApp();

async function loginAdmin() {
  const { user, password } = await createUser({ role: 'ADMIN' });
  const { agent, csrf } = await loginAs(app, user.username, password);
  return { admin: user, agent, csrf };
}

describe('GET /api/admin/users (liste)', () => {
  it('sans session → 401', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('USER → 403 FORBIDDEN', async () => {
    const { user, password } = await createUser({ role: 'USER' });
    try {
      const { agent } = await loginAs(app, user.username, password);
      const res = await agent.get('/api/admin/users');
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('ADMIN → réponse structurée sans password_hash', async () => {
    const { agent, admin } = await loginAdmin();
    try {
      const res = await agent.get('/api/admin/users?page=1&pageSize=20');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.pagination).toMatchObject({ page: 1, pageSize: 20, total: expect.any(Number), totalPages: expect.any(Number) });
      for (const user of res.body.data) {
        expect(user).not.toHaveProperty('password_hash');
        expect(user).not.toHaveProperty('failed_login_attempts');
        expect(user).not.toHaveProperty('locked_until');
      }
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('pagination : pageSize/2 pages et total corrects', async () => {
    const { agent, admin } = await loginAdmin();
    const created: string[] = [];
    try {
      for (let i = 0; i < 3; i++) {
        const { user } = await createUser();
        created.push(user.id);
      }
      const res = await agent.get('/api/admin/users?page=1&pageSize=2');
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(3);
      expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(2);

      const res2 = await agent.get('/api/admin/users?page=2&pageSize=2');
      expect(res2.body.data.length).toBeGreaterThanOrEqual(1);
    } finally {
      for (const id of created) await cleanupUser(id);
      await cleanupUser(admin.id);
    }
  });

  it('recherche par username (insensible a la casse)', async () => {
    const { agent, admin } = await loginAdmin();
    const { user } = await createUser({ username: `cherche_moi_${Date.now()}` });
    try {
      const res = await agent.get(`/api/admin/users?search=${encodeURIComponent('CHERCHE_MOI')}`);
      expect(res.body.data.some((u: { id: string }) => u.id === user.id)).toBe(true);
    } finally {
      await cleanupUser(user.id);
      await cleanupUser(admin.id);
    }
  });

  it('filtre par statut et par role', async () => {
    const { agent, admin } = await loginAdmin();
    const { user: disabled } = await createUser({ status: 'DISABLED' });
    const { user: adminUser } = await createUser({ role: 'ADMIN' });
    try {
      const resDisabled = await agent.get('/api/admin/users?status=DISABLED');
      expect(resDisabled.body.data.some((u: { id: string }) => u.id === disabled.id)).toBe(true);

      const resActive = await agent.get('/api/admin/users?status=ACTIVE');
      expect(resActive.body.data.some((u: { id: string }) => u.id === disabled.id)).toBe(false);

      const resAdmin = await agent.get('/api/admin/users?role=ADMIN');
      expect(resAdmin.body.data.some((u: { id: string }) => u.id === adminUser.id)).toBe(true);
    } finally {
      await cleanupUser(disabled.id);
      await cleanupUser(adminUser.id);
      await cleanupUser(admin.id);
    }
  });

  it('tri cote serveur controle : username asc/desc', async () => {
    const { agent, admin } = await loginAdmin();
    try {
      const resAsc = await agent.get('/api/admin/users?sort=username&order=asc&pageSize=100');
      const usernamesAsc = resAsc.body.data.map((u: { username: string }) => u.username);
      expect([...usernamesAsc].sort()).toEqual(usernamesAsc);

      const resDesc = await agent.get('/api/admin/users?sort=username&order=desc&pageSize=100');
      const usernamesDesc = resDesc.body.data.map((u: { username: string }) => u.username);
      expect([...usernamesDesc].sort().reverse()).toEqual(usernamesDesc);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('pageSize excede la limite → 400', async () => {
    const { agent, admin } = await loginAdmin();
    try {
      const res = await agent.get('/api/admin/users?pageSize=1000');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('Cache-Control: private, no-store sur les reponses admin', async () => {
    const { agent, admin } = await loginAdmin();
    try {
      const res = await agent.get('/api/admin/users');
      expect(res.headers['cache-control']).toContain('no-store');
    } finally {
      await cleanupUser(admin.id);
    }
  });
});

describe('POST /api/admin/users (creation)', () => {
  async function adminAuth() {
    const { agent, csrf, admin } = await loginAdmin();
    return { agent, csrf, admin };
  }

  it('ADMIN cree un USER : hash Argon2id en base, mot de passe jamais retourne', async () => {
    const { agent, csrf, admin } = await adminAuth();
    try {
      const username = `cree_${Date.now()}`;
      const email = `${username}@example.test`;
      const res = await agent
        .post('/api/admin/users')
        .set('X-CSRF-Token', csrf.token)
        .send({ username, email, firstName: 'Jean', lastName: 'Dupont', password: TEST_PASSWORD, role: 'USER' });
      expect(res.status).toBe(201);
      expect(res.body.user).toMatchObject({ username, email, role: 'USER', status: 'ACTIVE', first_name: 'Jean' });
      expect(res.body.user).not.toHaveProperty('password_hash');

      const stored = await prisma.user.findUnique({ where: { id: res.body.user.id } });
      expect(stored).not.toBeNull();
      expect(stored!.password_hash).not.toContain(TEST_PASSWORD);
      expect(await verifyPassword(TEST_PASSWORD, stored!.password_hash)).toBe(true);

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'USER_CREATED', entity_id: res.body.user.id },
      });
      expect(audit).not.toBeNull();
      expect(audit!.user_id).toBe(admin.id);
      const meta = audit!.metadata as Record<string, unknown>;
      expect(meta).not.toHaveProperty('password');
      expect(JSON.stringify(audit!.metadata)).not.toContain(TEST_PASSWORD);

      await cleanupUser(res.body.user.id);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('doublon username → 409 USERNAME_TAKEN', async () => {
    const { agent, csrf, admin } = await adminAuth();
    const { user } = await createUser({ username: 'doublon_' + Date.now() });
    try {
      const res = await agent
        .post('/api/admin/users')
        .set('X-CSRF-Token', csrf.token)
        .send({ username: user.username, email: 'autre@example.test', password: TEST_PASSWORD });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('USERNAME_TAKEN');
    } finally {
      await cleanupUser(user.id);
      await cleanupUser(admin.id);
    }
  });

  it('doublon email → 409 EMAIL_TAKEN', async () => {
    const { agent, csrf, admin } = await adminAuth();
    const { user } = await createUser({ email: `email_${Date.now()}@example.test` });
    try {
      const res = await agent
        .post('/api/admin/users')
        .set('X-CSRF-Token', csrf.token)
        .send({ username: 'autre_' + Date.now(), email: user.email, password: TEST_PASSWORD });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_TAKEN');
    } finally {
      await cleanupUser(user.id);
      await cleanupUser(admin.id);
    }
  });

  it('mot de passe faible → 400', async () => {
    const { agent, csrf, admin } = await adminAuth();
    try {
      const res = await agent
        .post('/api/admin/users')
        .set('X-CSRF-Token', csrf.token)
        .send({ username: 'faible_' + Date.now(), email: 'faible@example.test', password: 'court' });
      expect(res.status).toBe(400);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('mutation sans jeton CSRF → 403', async () => {
    const { agent, admin } = await adminAuth();
    try {
      const res = await agent.post('/api/admin/users').send({
        username: 'sans_csrf',
        email: 'sans_csrf@example.test',
        password: TEST_PASSWORD,
      });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CSRF_INVALID');
    } finally {
      await cleanupUser(admin.id);
    }
  });
});

describe('PUT /api/admin/users/:id (modification)', () => {
  it('ADMIN modifie username/email/nom/role', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const { user } = await createUser();
    try {
      const newUsername = `modifie_${Date.now()}`;
      const res = await agent
        .put(`/api/admin/users/${user.id}`)
        .set('X-CSRF-Token', csrf.token)
        .send({ username: newUsername, email: `${newUsername}@example.test`, firstName: 'Marie', lastName: 'Curie', role: 'ADMIN' });
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ username: newUsername, first_name: 'Marie', role: 'ADMIN' });
      expect(res.body.user).not.toHaveProperty('password_hash');

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'USER_UPDATED', entity_id: user.id },
        orderBy: { created_at: 'desc' },
      });
      expect(audit).not.toBeNull();
      const meta = audit!.metadata as { changedFields: string[] };
      expect(meta.changedFields).toEqual(expect.arrayContaining(['username', 'email', 'firstName', 'lastName', 'role']));
      expect(JSON.stringify(audit!.metadata)).not.toContain('password');
    } finally {
      await cleanupUser(user.id);
      await cleanupUser(admin.id);
    }
  });

  it('auto-elevation : un ADMIN ne peut pas modifier son propre role', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const res = await agent
        .put(`/api/admin/users/${admin.id}`)
        .set('X-CSRF-Token', csrf.token)
        .send({ username: admin.username, email: admin.email, firstName: admin.first_name, lastName: admin.last_name, role: 'USER' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SELF_ROLE_CHANGE');
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('nom d utilisateur deja pris → 409', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const { user } = await createUser({ username: 'occup_' + Date.now() });
    try {
      const res = await agent
        .put(`/api/admin/users/${admin.id}`)
        .set('X-CSRF-Token', csrf.token)
        .send({ username: user.username, email: admin.email, firstName: admin.first_name, lastName: admin.last_name, role: 'ADMIN' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('USERNAME_TAKEN');
    } finally {
      await cleanupUser(user.id);
      await cleanupUser(admin.id);
    }
  });

  it('role invalide → 400', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const { user } = await createUser();
    try {
      const res = await agent
        .put(`/api/admin/users/${user.id}`)
        .set('X-CSRF-Token', csrf.token)
        .send({ username: user.username, email: user.email, firstName: null, lastName: null, role: 'SUPERUSER' });
      expect(res.status).toBe(400);
    } finally {
      await cleanupUser(user.id);
      await cleanupUser(admin.id);
    }
  });

  it('utilisateur introuvable → 404', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const res = await agent
        .put('/api/admin/users/00000000-0000-0000-0000-000000000000')
        .set('X-CSRF-Token', csrf.token)
        .send({ username: 'abc', email: 'x@example.test', firstName: null, lastName: null, role: 'USER' });
      expect(res.status).toBe(404);
    } finally {
      await cleanupUser(admin.id);
    }
  });
});
