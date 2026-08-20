import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client.ts';
import {
  cleanupArticle,
  cleanupTag,
  cleanupUser,
  createArticle,
  createTag,
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

describe('GET /api/admin/tags (controle d acces)', () => {
  it('anonymous → 401, USER → 403, ADMIN → 200', async () => {
    const anon = await request.agent(app).get('/api/admin/tags');
    expect(anon.status).toBe(401);

    const { user, password } = await createUser({ role: 'USER' });
    try {
      const { agent } = await loginAs(app, user.username, password);
      const denied = await agent.get('/api/admin/tags');
      expect(denied.status).toBe(403);
    } finally {
      await cleanupUser(user.id);
    }
  });
});

describe('POST /api/admin/tags', () => {
  it('cree un tag : slug auto, articles_count = 0', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const res = await agent
        .post('/api/admin/tags')
        .set('X-CSRF-Token', csrf.token)
        .send({ name: 'Intelligence Artificielle' });
      expect(res.status).toBe(201);
      expect(res.body.tag.slug).toBe('intelligence-artificielle');
      expect(res.body.tag.articles_count).toBe(0);
      await cleanupTag(res.body.tag.id);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('nom duplique insensible a la casse → 409 DUPLICATE_TAG', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const first = await agent
        .post('/api/admin/tags')
        .set('X-CSRF-Token', csrf.token)
        .send({ name: 'Politique' });
      expect(first.status).toBe(201);

      const dup = await agent
        .post('/api/admin/tags')
        .set('X-CSRF-Token', csrf.token)
        .send({ name: 'politique' });
      expect(dup.status).toBe(409);
      expect(dup.body.error.code).toBe('DUPLICATE_TAG');
      await cleanupTag(first.body.tag.id);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('slug explicite duplique → 409 DUPLICATE_SLUG', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const tag = await createTag({ name: 'Geo', slug: 'geo' });
    try {
      const res = await agent
        .post('/api/admin/tags')
        .set('X-CSRF-Token', csrf.token)
        .send({ name: 'Geographie', slug: 'GEO' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_SLUG');
    } finally {
      await cleanupTag(tag.id);
      await cleanupUser(admin.id);
    }
  });
});

describe('DELETE /api/admin/tags/:id', () => {
  it('tag utilise par un article → 409 TAG_IN_USE', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const tag = await createTag({ name: 'Utilise' });
    const article = await createArticle({ author_id: admin.id, tagIds: [tag.id] });
    try {
      const res = await agent
        .delete(`/api/admin/tags/${tag.id}`)
        .set('X-CSRF-Token', csrf.token);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('TAG_IN_USE');
    } finally {
      await cleanupArticle(article.id);
      await cleanupTag(tag.id);
      await cleanupUser(admin.id);
    }
  });

  it('tag libre → 204 et audit TAG_DELETED', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const tag = await createTag({ name: 'Libre' });
    try {
      const res = await agent
        .delete(`/api/admin/tags/${tag.id}`)
        .set('X-CSRF-Token', csrf.token);
      expect(res.status).toBe(204);

      const log = await prisma.auditLog.findFirst({
        where: { action: 'TAG_DELETED', entity_id: tag.id },
      });
      expect(log).toBeTruthy();
      expect(log!.user_id).toBe(admin.id);
    } finally {
      await cleanupUser(admin.id);
    }
  });
});

describe('GET /api/admin/tags (liste)', () => {
  it('liste paginee avec articles_count', async () => {
    const { agent, admin } = await loginAdmin();
    const tag = await createTag({ name: 'Compteur' });
    const article = await createArticle({ author_id: admin.id, tagIds: [tag.id] });
    try {
      const res = await agent.get('/api/admin/tags?search=Compteur&pageSize=50');
      expect(res.status).toBe(200);
      expect(res.body.pagination.total).toBe(1);
      expect(res.body.data[0].articles_count).toBe(1);
      expect(res.body.data[0].id).toBe(tag.id);
    } finally {
      await cleanupArticle(article.id);
      await cleanupTag(tag.id);
      await cleanupUser(admin.id);
    }
  });
});
