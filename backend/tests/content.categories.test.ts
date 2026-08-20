import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client.ts';
import {
  cleanupArticle,
  cleanupCategory,
  cleanupUser,
  createArticle,
  createCategory,
  createTestApp,
  createUser,
  loginAs,
} from './helpers.ts';

const app = createTestApp();

async function loginAdmin() {
  const { user, password } = await createUser({ role: 'ADMIN' });
  const { res, agent, csrf } = await loginAs(app, user.username, password);
  expect(res.status).toBe(200);
  return { admin: user, agent, csrf };
}

describe('GET /api/admin/categories (controle d acces)', () => {
  it('anonymous → 401, USER → 403, ADMIN → 200', async () => {
    const anon = await request.agent(app).get('/api/admin/categories');
    expect(anon.status).toBe(401);

    const { user, password } = await createUser({ role: 'USER' });
    try {
      const { agent } = await loginAs(app, user.username, password);
      const denied = await agent.get('/api/admin/categories');
      expect(denied.status).toBe(403);
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('CSRF requis pour les mutations', async () => {
    const { agent, admin } = await loginAdmin();
    try {
      const res = await agent.post('/api/admin/categories').send({ name: 'Sans CSRF' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CSRF_INVALID');
    } finally {
      await cleanupUser(admin.id);
    }
  });
});

describe('POST /api/admin/categories', () => {
  it('cree une categorie racine : slug auto depuis le nom, tri par defaut', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const res = await agent
        .post('/api/admin/categories')
        .set('X-CSRF-Token', csrf.token)
        .send({ name: 'Actualite Internationale' });
      expect(res.status).toBe(201);
      expect(res.body.category.name).toBe('Actualite Internationale');
      expect(res.body.category.slug).toBe('actualite-internationale');
      expect(res.body.category.parent_id).toBeNull();
      expect(res.body.category.sort_order).toBe(0);
      expect(res.body.category.status).toBe('ACTIVE');
      expect(res.body.category.children_count).toBe(0);
      await cleanupCategory(res.body.category.id);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('rejette un nom deja utilise au meme niveau (409 DUPLICATE_CATEGORY)', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const first = await agent
        .post('/api/admin/categories')
        .set('X-CSRF-Token', csrf.token)
        .send({ name: 'Economie' });
      expect(first.status).toBe(201);

      const dup = await agent
        .post('/api/admin/categories')
        .set('X-CSRF-Token', csrf.token)
        .send({ name: 'Economie' });
      expect(dup.status).toBe(409);
      expect(dup.body.error.code).toBe('DUPLICATE_CATEGORY');
      await cleanupCategory(first.body.category.id);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('parent introuvable → 400 INVALID_CATEGORY ; parent valide → hierarchie', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const badParent = await agent
        .post('/api/admin/categories')
        .set('X-CSRF-Token', csrf.token)
        .send({ name: 'Orphelin', parent_id: '00000000-0000-0000-0000-000000000000' });
      expect(badParent.status).toBe(400);
      expect(badParent.body.error.code).toBe('INVALID_CATEGORY');

      const root = await agent
        .post('/api/admin/categories')
        .set('X-CSRF-Token', csrf.token)
        .send({ name: 'Sport' });
      const child = await agent
        .post('/api/admin/categories')
        .set('X-CSRF-Token', csrf.token)
        .send({ name: 'Tennis', parent_id: root.body.category.id });
      expect(child.status).toBe(201);
      expect(child.body.category.parent_id).toBe(root.body.category.id);
      await cleanupCategory(child.body.category.id);
      await cleanupCategory(root.body.category.id);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('slug explicite normalise et unique (409 DUPLICATE_SLUG)', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const withSlug = await agent
        .post('/api/admin/categories')
        .set('X-CSRF-Token', csrf.token)
        .send({ name: 'Politique', slug: 'LA-POLITIQUE' });
      expect(withSlug.status).toBe(201);
      expect(withSlug.body.category.slug).toBe('la-politique');

      const dupSlug = await agent
        .post('/api/admin/categories')
        .set('X-CSRF-Token', csrf.token)
        .send({ name: 'Politique Europeenne', slug: 'LA-POLITIQUE' });
      expect(dupSlug.status).toBe(409);
      expect(dupSlug.body.error.code).toBe('DUPLICATE_SLUG');
      await cleanupCategory(withSlug.body.category.id);
    } finally {
      await cleanupUser(admin.id);
    }
  });
});

describe('PUT /api/admin/categories/:id', () => {
  it('auto-parent (parent_id = id) → 400 CATEGORY_CYCLE', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const root = await createCategory({ name: 'Technologie' });
    try {
      const res = await agent
        .put(`/api/admin/categories/${root.id}`)
        .set('X-CSRF-Token', csrf.token)
        .send({ parent_id: root.id });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CATEGORY_CYCLE');
    } finally {
      await cleanupCategory(root.id);
      await cleanupUser(admin.id);
    }
  });

  it('cycle via descendant → 400 CATEGORY_CYCLE', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const root = await createCategory({ name: 'Racine' });
    const child = await createCategory({ name: 'Enfant', parent_id: root.id });
    try {
      const res = await agent
        .put(`/api/admin/categories/${root.id}`)
        .set('X-CSRF-Token', csrf.token)
        .send({ parent_id: child.id });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CATEGORY_CYCLE');
    } finally {
      await cleanupCategory(child.id);
      await cleanupCategory(root.id);
      await cleanupUser(admin.id);
    }
  });

  it('parent introuvable → 400 INVALID_CATEGORY', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const root = await createCategory({ name: 'Culture' });
    try {
      const res = await agent
        .put(`/api/admin/categories/${root.id}`)
        .set('X-CSRF-Token', csrf.token)
        .send({ parent_id: '00000000-0000-0000-0000-000000000000' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CATEGORY');
    } finally {
      await cleanupCategory(root.id);
      await cleanupUser(admin.id);
    }
  });

  it('nom duplique entre freres → 409 DUPLICATE_CATEGORY', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const parent = await createCategory({ name: 'Parent' });
    const a = await createCategory({ name: 'Enfant A', parent_id: parent.id });
    const b = await createCategory({ name: 'Enfant B', parent_id: parent.id });
    try {
      const res = await agent
        .put(`/api/admin/categories/${b.id}`)
        .set('X-CSRF-Token', csrf.token)
        .send({ name: 'Enfant A' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_CATEGORY');
    } finally {
      await cleanupCategory(b.id);
      await cleanupCategory(a.id);
      await cleanupCategory(parent.id);
      await cleanupUser(admin.id);
    }
  });

  it('renomme et deplace une categorie (statut, ordre, slug explicite)', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const root = await createCategory({ name: 'Initial', sort_order: 5 });
    try {
      const res = await agent
        .put(`/api/admin/categories/${root.id}`)
        .set('X-CSRF-Token', csrf.token)
        .send({ name: 'Rename', sort_order: 9, status: 'INACTIVE', slug: 'rename-cat' });
      expect(res.status).toBe(200);
      expect(res.body.category.name).toBe('Rename');
      expect(res.body.category.slug).toBe('rename-cat');
      expect(res.body.category.sort_order).toBe(9);
      expect(res.body.category.status).toBe('INACTIVE');
    } finally {
      await cleanupCategory(root.id);
      await cleanupUser(admin.id);
    }
  });
});

describe('DELETE /api/admin/categories/:id', () => {
  it('categorie avec enfants → 409 CATEGORY_HAS_CHILDREN', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const root = await createCategory({ name: 'Parente' });
    const child = await createCategory({ name: 'Enfant', parent_id: root.id });
    try {
      const res = await agent
        .delete(`/api/admin/categories/${root.id}`)
        .set('X-CSRF-Token', csrf.token);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CATEGORY_HAS_CHILDREN');
    } finally {
      await cleanupCategory(child.id);
      await cleanupCategory(root.id);
      await cleanupUser(admin.id);
    }
  });

  it('categorie utilisee par un article → 409 CATEGORY_IN_USE', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const cat = await createCategory({ name: 'En Usage' });
    const article = await createArticle({ author_id: admin.id, category_id: cat.id });
    try {
      const res = await agent
        .delete(`/api/admin/categories/${cat.id}`)
        .set('X-CSRF-Token', csrf.token);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CATEGORY_IN_USE');
    } finally {
      await cleanupArticle(article.id);
      await cleanupCategory(cat.id);
      await cleanupUser(admin.id);
    }
  });

  it('categorie vide → 204 et disparait de la liste', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const cat = await createCategory({ name: 'A Supprimer' });
    try {
      const res = await agent
        .delete(`/api/admin/categories/${cat.id}`)
        .set('X-CSRF-Token', csrf.token);
      expect(res.status).toBe(204);

      const list = await agent.get('/api/admin/categories?search=A%20Supprimer');
      expect(list.status).toBe(200);
      expect(list.body.data).toHaveLength(0);
    } finally {
      await cleanupUser(admin.id);
    }
  });
});

describe('Audit des categories', () => {
  it('trace CATEGORY_CREATED / CATEGORY_DELETED', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const created = await agent
      .post('/api/admin/categories')
      .set('X-CSRF-Token', csrf.token)
      .send({ name: 'Auditee' });
    expect(created.status).toBe(201);

    const createLog = await prisma.auditLog.findFirst({
      where: { action: 'CATEGORY_CREATED', entity_id: created.body.category.id },
    });
    expect(createLog).toBeTruthy();
    expect(createLog!.user_id).toBe(admin.id);

    const del = await agent
      .delete(`/api/admin/categories/${created.body.category.id}`)
      .set('X-CSRF-Token', csrf.token);
    expect(del.status).toBe(204);

    const delLog = await prisma.auditLog.findFirst({
      where: { action: 'CATEGORY_DELETED', entity_id: created.body.category.id },
    });
    expect(delLog).toBeTruthy();
    await cleanupUser(admin.id);
  });
});

describe('GET /api/categories/tree (public)', () => {
  it('arbre public : uniquement ACTIVE, hierarchie incluse', async () => {
    const root = await createCategory({ name: 'Racine Active' });
    const child = await createCategory({ name: 'Enfant Actif', parent_id: root.id });
    const inactive = await createCategory({ name: 'Inactive', status: 'INACTIVE' });
    try {
      const res = await request.agent(app).get('/api/categories/tree');
      expect(res.status).toBe(200);
      expect(res.body.categories.some((c: { name: string }) => c.name === 'Inactive')).toBe(false);

      const node = res.body.categories.find(
        (c: { name: string }) => c.name === 'Racine Active',
      );
      expect(node).toBeTruthy();
      expect(node.children.map((c: { name: string }) => c.name)).toContain('Enfant Actif');
    } finally {
      await cleanupCategory(child.id);
      await cleanupCategory(root.id);
      await cleanupCategory(inactive.id);
    }
  });
});
