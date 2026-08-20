import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client.ts';
import {
  cleanupArticle,
  cleanupCategory,
  cleanupTag,
  cleanupUser,
  createArticle,
  createCategory,
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

const CONTENT = 'Contenu complet de l article de test.'.repeat(10);

describe('Controle d acces', () => {
  it('routes ADMIN : anonymous → 401, USER → 403', async () => {
    const anon = await request.agent(app).get('/api/admin/articles');
    expect(anon.status).toBe(401);

    const { user, password } = await createUser({ role: 'USER' });
    try {
      const { agent } = await loginAs(app, user.username, password);
      expect((await agent.get('/api/admin/articles')).status).toBe(403);
      expect(
        (await agent.post('/api/admin/articles').send({ title: 'X', content: 'Y' })).status,
      ).toBe(403);
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('routes publiques accessibles sans session ; mutations CSRF', async () => {
    const anon = request.agent(app);
    expect((await anon.get('/api/articles')).status).toBe(200);
    expect((await anon.get('/api/categories/tree')).status).toBe(200);

    const { agent, admin } = await loginAdmin();
    try {
      const noCsrf = await agent
        .post('/api/admin/articles')
        .send({ title: 'Sans CSRF', content: 'X' });
      expect(noCsrf.status).toBe(403);
      expect(noCsrf.body.error.code).toBe('CSRF_INVALID');
    } finally {
      await cleanupUser(admin.id);
    }
  });
});

describe('POST /api/admin/articles (creation)', () => {
  it('cree un brouillon : slug auto, auteur = session, published_at null', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const res = await agent
        .post('/api/admin/articles')
        .set('X-CSRF-Token', csrf.token)
        .send({ title: 'Bonjour le Monde', summary: 'Resume', content: CONTENT });
      expect(res.status).toBe(201);
      expect(res.body.article.slug).toBe('bonjour-le-monde');
      expect(res.body.article.status).toBe('DRAFT');
      expect(res.body.article.published_at).toBeNull();
      expect(res.body.article.author.id).toBe(admin.id);
      expect(res.body.article.tags).toEqual([]);
      expect(res.body.article.category).toBeNull();
      await cleanupArticle(res.body.article.id);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('categorie invalide → 400 INVALID_CATEGORY ; tag invalide → 400 INVALID_TAG', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const badCat = await agent
        .post('/api/admin/articles')
        .set('X-CSRF-Token', csrf.token)
        .send({
          title: 'Categorie Erreur',
          content: CONTENT,
          category_id: '00000000-0000-0000-0000-000000000000',
        });
      expect(badCat.status).toBe(400);
      expect(badCat.body.error.code).toBe('INVALID_CATEGORY');

      const badTag = await agent
        .post('/api/admin/articles')
        .set('X-CSRF-Token', csrf.token)
        .send({
          title: 'Tag Erreur',
          content: CONTENT,
          tags: ['00000000-0000-0000-0000-000000000000'],
        });
      expect(badTag.status).toBe(400);
      expect(badTag.body.error.code).toBe('INVALID_TAG');
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('associe categorie et tags existants', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const cat = await createCategory({ name: 'Science' });
    const tagA = await createTag({ name: 'Recherche' });
    const tagB = await createTag({ name: 'Brevets' });
    try {
      const res = await agent
        .post('/api/admin/articles')
        .set('X-CSRF-Token', csrf.token)
        .send({
          title: 'Une Decouverte',
          content: CONTENT,
          category_id: cat.id,
          tags: [tagA.id, tagB.id, tagA.id],
        });
      expect(res.status).toBe(201);
      const names = res.body.article.tags.map((t: { name: string }) => t.name).sort();
      expect(names).toEqual(['Brevets', 'Recherche']);
      expect(res.body.article.category.slug).toBe(cat.slug);
      await cleanupArticle(res.body.article.id);
    } finally {
      await cleanupTag(tagA.id);
      await cleanupTag(tagB.id);
      await cleanupCategory(cat.id);
      await cleanupUser(admin.id);
    }
  });

  it('PUBLISHED sans published_at → date de publication = maintenant', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const before = Date.now() - 5000;
      const res = await agent
        .post('/api/admin/articles')
        .set('X-CSRF-Token', csrf.token)
        .send({ title: 'Publie Maintenant', content: CONTENT, status: 'PUBLISHED' });
      expect(res.status).toBe(201);
      const at = new Date(res.body.article.published_at).getTime();
      expect(at).toBeGreaterThanOrEqual(before);
      expect(at).toBeLessThanOrEqual(Date.now() + 5000);
      await cleanupArticle(res.body.article.id);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('publication programmee : PUBLISHED avec date future', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const future = new Date(Date.now() + 3600_000).toISOString();
    try {
      const res = await agent
        .post('/api/admin/articles')
        .set('X-CSRF-Token', csrf.token)
        .send({ title: 'Programme', content: CONTENT, status: 'PUBLISHED', published_at: future });
      expect(res.status).toBe(201);
      expect(res.body.article.status).toBe('PUBLISHED');
      await cleanupArticle(res.body.article.id);
    } finally {
      await cleanupUser(admin.id);
    }
  });
});

describe('GET /api/admin/articles/:id (detail)', () => {
  it('retourne le contenu complet, les relations et le statut', async () => {
    const { agent, admin } = await loginAdmin();
    const cat = await createCategory({ name: 'Detail' });
    const tag = await createTag({ name: 'TagDetail' });
    const article = await createArticle({
      author_id: admin.id,
      category_id: cat.id,
      tagIds: [tag.id],
      title: 'Detail Complet',
    });
    try {
      const res = await agent.get(`/api/admin/articles/${article.id}`);
      expect(res.status).toBe(200);
      expect(res.body.article.content).toBe(article.content);
      expect(res.body.article.category.id).toBe(cat.id);
      expect(res.body.article.tags.map((t: { id: string }) => t.id)).toContain(tag.id);
      expect(res.body.article.author.id).toBe(admin.id);
      expect(res.body.article.id).toBe(article.id);
    } finally {
      await cleanupArticle(article.id);
      await cleanupTag(tag.id);
      await cleanupCategory(cat.id);
      await cleanupUser(admin.id);
    }
  });

  it('inexistant → 404 ARTICLE_NOT_FOUND', async () => {
    const { agent, admin } = await loginAdmin();
    try {
      const res = await agent.get('/api/admin/articles/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ARTICLE_NOT_FOUND');
    } finally {
      await cleanupUser(admin.id);
    }
  });
});

describe('PUT /api/admin/articles/:id (mise a jour)', () => {
  it('modifie titre/contenu/source/langue ; slug STABLE', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const article = await createArticle({ author_id: admin.id, title: 'Titre Stable' });
    try {
      const res = await agent
        .put(`/api/admin/articles/${article.id}`)
        .set('X-CSRF-Token', csrf.token)
        .send({ title: 'Nouveau Titre', content: 'Nouveau contenu', source: 'AFP', language: 'en' });
      expect(res.status).toBe(200);
      expect(res.body.article.title).toBe('Nouveau Titre');
      expect(res.body.article.slug).toBe(article.slug);
      expect(res.body.article.source).toBe('AFP');
      expect(res.body.article.language).toBe('en');
      expect(res.body.article.content).toBe('Nouveau contenu');
    } finally {
      await cleanupArticle(article.id);
      await cleanupUser(admin.id);
    }
  });

  it('remplace les tags et peut detacher la categorie', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const cat = await createCategory({ name: 'Initiale' });
    const tagA = await createTag({ name: 'Premier' });
    const tagB = await createTag({ name: 'Second' });
    const article = await createArticle({
      author_id: admin.id,
      category_id: cat.id,
      tagIds: [tagA.id],
    });
    try {
      const res = await agent
        .put(`/api/admin/articles/${article.id}`)
        .set('X-CSRF-Token', csrf.token)
        .send({ tags: [tagB.id], category_id: null });
      expect(res.status).toBe(200);
      expect(res.body.article.tags.map((t: { id: string }) => t.id)).toEqual([tagB.id]);
      expect(res.body.article.category).toBeNull();
    } finally {
      await cleanupArticle(article.id);
      await cleanupTag(tagA.id);
      await cleanupTag(tagB.id);
      await cleanupCategory(cat.id);
      await cleanupUser(admin.id);
    }
  });

  it('transition invalide via PUT → 409 INVALID_STATUS_TRANSITION', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const article = await createArticle({ author_id: admin.id, status: 'PUBLISHED' });
    try {
      const res = await agent
        .put(`/api/admin/articles/${article.id}`)
        .set('X-CSRF-Token', csrf.token)
        .send({ status: 'DRAFT' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    } finally {
      await cleanupArticle(article.id);
      await cleanupUser(admin.id);
    }
  });
});

describe('PATCH /api/admin/articles/:id/status (machine a etats)', () => {
  it('DRAFT → PUBLISHED ok (published_at renseigne)', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const article = await createArticle({ author_id: admin.id, status: 'DRAFT' });
    try {
      const res = await agent
        .patch(`/api/admin/articles/${article.id}/status`)
        .set('X-CSRF-Token', csrf.token)
        .send({ status: 'PUBLISHED' });
      expect(res.status).toBe(200);
      expect(res.body.article.status).toBe('PUBLISHED');
      expect(res.body.article.published_at).not.toBeNull();
    } finally {
      await cleanupArticle(article.id);
      await cleanupUser(admin.id);
    }
  });

  it('PUBLISHED → ARCHIVED puis ARCHIVED → PUBLISHED ok', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const article = await createArticle({ author_id: admin.id, status: 'PUBLISHED' });
    try {
      const arch = await agent
        .patch(`/api/admin/articles/${article.id}/status`)
        .set('X-CSRF-Token', csrf.token)
        .send({ status: 'ARCHIVED' });
      expect(arch.status).toBe(200);
      expect(arch.body.article.status).toBe('ARCHIVED');

      const repub = await agent
        .patch(`/api/admin/articles/${article.id}/status`)
        .set('X-CSRF-Token', csrf.token)
        .send({ status: 'PUBLISHED' });
      expect(repub.status).toBe(200);
      expect(repub.body.article.status).toBe('PUBLISHED');
    } finally {
      await cleanupArticle(article.id);
      await cleanupUser(admin.id);
    }
  });

  it('transitions interdites : DRAFT→ARCHIVED et PUBLISHED→DRAFT → 409', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const draft = await createArticle({ author_id: admin.id, status: 'DRAFT' });
    const pub = await createArticle({ author_id: admin.id, status: 'PUBLISHED' });
    try {
      const bad1 = await agent
        .patch(`/api/admin/articles/${draft.id}/status`)
        .set('X-CSRF-Token', csrf.token)
        .send({ status: 'ARCHIVED' });
      expect(bad1.status).toBe(409);
      expect(bad1.body.error.code).toBe('INVALID_STATUS_TRANSITION');

      const bad2 = await agent
        .patch(`/api/admin/articles/${pub.id}/status`)
        .set('X-CSRF-Token', csrf.token)
        .send({ status: 'DRAFT' });
      expect(bad2.status).toBe(409);
      expect(bad2.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    } finally {
      await cleanupArticle(draft.id);
      await cleanupArticle(pub.id);
      await cleanupUser(admin.id);
    }
  });

  it('meme statut → 409 ALREADY_IN_STATUS', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const article = await createArticle({ author_id: admin.id, status: 'DRAFT' });
    try {
      const res = await agent
        .patch(`/api/admin/articles/${article.id}/status`)
        .set('X-CSRF-Token', csrf.token)
        .send({ status: 'DRAFT' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_IN_STATUS');
    } finally {
      await cleanupArticle(article.id);
      await cleanupUser(admin.id);
    }
  });
});

describe('DELETE /api/admin/articles/:id (soft delete)', () => {
  it('supprime (204), disparait de la liste admin et du public', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const article = await createArticle({ author_id: admin.id, status: 'PUBLISHED' });
    try {
      const del = await agent
        .delete(`/api/admin/articles/${article.id}`)
        .set('X-CSRF-Token', csrf.token);
      expect(del.status).toBe(204);

      const detail = await agent.get(`/api/admin/articles/${article.id}`);
      expect(detail.status).toBe(404);

      const pub = await request.agent(app).get(`/api/articles/${article.slug}`);
      expect(pub.status).toBe(404);

      const log = await prisma.auditLog.findFirst({
        where: { action: 'ARTICLE_DELETED', entity_id: article.id },
      });
      expect(log).toBeTruthy();
    } finally {
      await cleanupArticle(article.id);
      await cleanupUser(admin.id);
    }
  });
});

describe('GET /api/articles (flux public)', () => {
  it('seuls les PUBLISHED effectifs (date <= maintenant) sont visibles', async () => {
    const { admin } = await loginAdmin();
    const future = new Date(Date.now() + 3600_000);
    const pub = await createArticle({ author_id: admin.id, status: 'PUBLISHED', title: 'Visible' });
    const draft = await createArticle({ author_id: admin.id, status: 'DRAFT', title: 'Brouillon' });
    const arch = await createArticle({ author_id: admin.id, status: 'ARCHIVED', title: 'Archive' });
    const scheduled = await createArticle({
      author_id: admin.id,
      status: 'PUBLISHED',
      title: 'Programme',
      published_at: future,
    });
    try {
      const res = await request.agent(app).get('/api/articles?pageSize=50');
      expect(res.status).toBe(200);
      const titles = res.body.data.map((a: { title: string }) => a.title);
      expect(titles).toContain('Visible');
      expect(titles).not.toContain('Brouillon');
      expect(titles).not.toContain('Archive');
      expect(titles).not.toContain('Programme');
      // Aucun contenu complet dans la liste publique.
      expect(res.body.data[0].content).toBeUndefined();
    } finally {
      await cleanupArticle(pub.id);
      await cleanupArticle(draft.id);
      await cleanupArticle(arch.id);
      await cleanupArticle(scheduled.id);
      await cleanupUser(admin.id);
    }
  });

  it('filtres category/tag par slug, recherche, tri par published_at desc', async () => {
    const { admin } = await loginAdmin();
    const cat = await createCategory({ name: 'Economie' });
    const tag = await createTag({ name: 'Croissance' });
    const inCat = await createArticle({
      author_id: admin.id,
      status: 'PUBLISHED',
      category_id: cat.id,
      title: 'PIB en hausse',
    });
    const tagged = await createArticle({
      author_id: admin.id,
      status: 'PUBLISHED',
      tagIds: [tag.id],
      title: 'Marché du travail',
    });
    try {
      const byCat = await request.agent(app).get(`/api/articles?category=${cat.slug}`);
      const catTitles = byCat.body.data.map((a: { title: string }) => a.title);
      expect(catTitles).toContain('PIB en hausse');
      expect(catTitles).not.toContain('Marché du travail');

      const byTag = await request.agent(app).get(`/api/articles?tag=${tag.slug}`);
      const tagTitles = byTag.body.data.map((a: { title: string }) => a.title);
      expect(tagTitles).toContain('Marché du travail');
      expect(tagTitles).not.toContain('PIB en hausse');

      const search = await request.agent(app).get('/api/articles?search=PIB');
      const searchTitles = search.body.data.map((a: { title: string }) => a.title);
      expect(searchTitles).toContain('PIB en hausse');
      expect(searchTitles).not.toContain('Marché du travail');

      const sorted = await request.agent(app).get('/api/articles?sort=published_at&order=desc');
      expect(sorted.body.data[0].published_at).toBeDefined();
    } finally {
      await cleanupArticle(inCat.id);
      await cleanupArticle(tagged.id);
      await cleanupTag(tag.id);
      await cleanupCategory(cat.id);
      await cleanupUser(admin.id);
    }
  });
});

describe('GET /api/articles/:slug (detail public)', () => {
  it('PUBLISHED → 200 avec contenu ; invisibles → 404', async () => {
    const { admin } = await loginAdmin();
    const pub = await createArticle({ author_id: admin.id, status: 'PUBLISHED', title: 'Article Public' });
    const draft = await createArticle({ author_id: admin.id, status: 'DRAFT', title: 'Cache' });
    const scheduled = await createArticle({
      author_id: admin.id,
      status: 'PUBLISHED',
      title: 'Futur',
      published_at: new Date(Date.now() + 3600_000),
    });
    try {
      const ok = await request.agent(app).get(`/api/articles/${pub.slug}`);
      expect(ok.status).toBe(200);
      expect(ok.body.article.content).toBe(pub.content);
      expect(ok.body.article.status).toBe('PUBLISHED');

      const hidden = await request.agent(app).get(`/api/articles/${draft.slug}`);
      expect(hidden.status).toBe(404);

      const future = await request.agent(app).get(`/api/articles/${scheduled.slug}`);
      expect(future.status).toBe(404);

      const missing = await request.agent(app).get('/api/articles/slug-inexistant');
      expect(missing.status).toBe(404);
    } finally {
      await cleanupArticle(pub.id);
      await cleanupArticle(draft.id);
      await cleanupArticle(scheduled.id);
      await cleanupUser(admin.id);
    }
  });
});
