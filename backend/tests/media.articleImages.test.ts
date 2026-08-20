import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  cleanupArticle,
  cleanupImage,
  cleanupUser,
  createArticle,
  createTestApp,
  createUser,
  loginAs,
  makePngBuffer,
  uploadImage,
} from './helpers.ts';

const app = createTestApp();

async function loginAdmin() {
  const { user, password } = await createUser({ role: 'ADMIN' });
  const { res, agent, csrf } = await loginAs(app, user.username, password);
  expect(res.status).toBe(200);
  return { admin: user, agent, csrf };
}

describe('Galerie d images des articles', () => {
  it('article inconnu → 404 sur la galerie', async () => {
    const { agent, admin } = await loginAdmin();
    try {
      const res = await agent.get('/api/admin/articles/00000000-0000-0000-0000-000000000000/images');
      expect(res.status).toBe(404);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('ajoute des images en fin de galerie (positions successives)', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const article = await createArticle({ author_id: admin.id });
    try {
      const imgA = await uploadImage(app, agent, csrf, await makePngBuffer(32, 32), 'galA.png');
      const imgB = await uploadImage(app, agent, csrf, await makePngBuffer(32, 32), 'galB.png');

      const attach = await agent
        .post(`/api/admin/articles/${article.id}/images`)
        .set('X-CSRF-Token', csrf.token)
        .send({ image_ids: [imgA.body.image.id, imgB.body.image.id] });
      expect(attach.status).toBe(201);
      expect(attach.body.images.map((g: { image: { id: string } }) => g.image.id)).toEqual([
        imgA.body.image.id,
        imgB.body.image.id,
      ]);
      expect(attach.body.images.map((g: { position: number }) => g.position)).toEqual([0, 1]);

      await cleanupImage(imgA.body.image.id);
      await cleanupImage(imgB.body.image.id);
      await cleanupArticle(article.id);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('refuse une image inexistante → 400 INVALID_IMAGE', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const article = await createArticle({ author_id: admin.id });
    try {
      const res = await agent
        .post(`/api/admin/articles/${article.id}/images`)
        .set('X-CSRF-Token', csrf.token)
        .send({ image_ids: ['00000000-0000-0000-0000-000000000000'] });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_IMAGE');
      await cleanupArticle(article.id);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('doublon : re-ajouter la meme image ne cree pas de doublon', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const article = await createArticle({ author_id: admin.id });
    try {
      const img = await uploadImage(app, agent, csrf, await makePngBuffer(32, 32), 'dup.png');
      await agent
        .post(`/api/admin/articles/${article.id}/images`)
        .set('X-CSRF-Token', csrf.token)
        .send({ image_ids: [img.body.image.id] });
      const again = await agent
        .post(`/api/admin/articles/${article.id}/images`)
        .set('X-CSRF-Token', csrf.token)
        .send({ image_ids: [img.body.image.id] });
      expect(again.status).toBe(201);
      expect(again.body.images).toHaveLength(1);
      await cleanupImage(img.body.image.id);
      await cleanupArticle(article.id);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('reordonne la galerie', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const article = await createArticle({ author_id: admin.id });
    try {
      const a = await uploadImage(app, agent, csrf, await makePngBuffer(), 'o1.png');
      const b = await uploadImage(app, agent, csrf, await makePngBuffer(), 'o2.png');
      const c = await uploadImage(app, agent, csrf, await makePngBuffer(), 'o3.png');
      const ids = [a.body.image.id, b.body.image.id, c.body.image.id];
      await agent
        .post(`/api/admin/articles/${article.id}/images`)
        .set('X-CSRF-Token', csrf.token)
        .send({ image_ids: ids });

      const reorder = await agent
        .put(`/api/admin/articles/${article.id}/images/order`)
        .set('X-CSRF-Token', csrf.token)
        .send({ image_ids: [ids[2], ids[0]] });
      expect(reorder.status).toBe(200);
      expect(reorder.body.images.map((g: { position: number }) => g.position)).toEqual([0, 1, 2]);
      expect(reorder.body.images[0].image.id).toBe(ids[2]);

      await cleanupImage(a.body.image.id);
      await cleanupImage(b.body.image.id);
      await cleanupImage(c.body.image.id);
      await cleanupArticle(article.id);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('detache une image ; absente de la galerie → 404 IMAGE_NOT_IN_GALLERY', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const article = await createArticle({ author_id: admin.id });
    try {
      const a = await uploadImage(app, agent, csrf, await makePngBuffer(), 'd1.png');
      const b = await uploadImage(app, agent, csrf, await makePngBuffer(), 'd2.png');
      await agent
        .post(`/api/admin/articles/${article.id}/images`)
        .set('X-CSRF-Token', csrf.token)
        .send({ image_ids: [a.body.image.id, b.body.image.id] });

      const detach = await agent
        .delete(`/api/admin/articles/${article.id}/images/${a.body.image.id}`)
        .set('X-CSRF-Token', csrf.token);
      expect(detach.status).toBe(200);
      expect(detach.body.images).toHaveLength(1);
      expect(detach.body.images[0].image.id).toBe(b.body.image.id);

      const notInGallery = await agent
        .delete(`/api/admin/articles/${article.id}/images/${a.body.image.id}`)
        .set('X-CSRF-Token', csrf.token);
      expect(notInGallery.status).toBe(404);
      expect(notInGallery.body.error.code).toBe('IMAGE_NOT_IN_GALLERY');

      await cleanupImage(a.body.image.id);
      await cleanupImage(b.body.image.id);
      await cleanupArticle(article.id);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('assigne et retire l image principale (featured)', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const article = await createArticle({ author_id: admin.id });
    try {
      const img = await uploadImage(app, agent, csrf, await makePngBuffer(), 'feat.png');
      const set = await agent
        .put(`/api/admin/articles/${article.id}/featured-image`)
        .set('X-CSRF-Token', csrf.token)
        .send({ image_id: img.body.image.id });
      expect(set.status).toBe(200);
      expect(set.body.featured_image.id).toBe(img.body.image.id);

      const clear = await agent
        .put(`/api/admin/articles/${article.id}/featured-image`)
        .set('X-CSRF-Token', csrf.token)
        .send({ image_id: null });
      expect(clear.status).toBe(200);
      expect(clear.body.featured_image).toBeNull();

      const bad = await agent
        .put(`/api/admin/articles/${article.id}/featured-image`)
        .set('X-CSRF-Token', csrf.token)
        .send({ image_id: '00000000-0000-0000-0000-000000000000' });
      expect(bad.status).toBe(400);
      expect(bad.body.error.code).toBe('INVALID_IMAGE');

      await cleanupImage(img.body.image.id);
      await cleanupArticle(article.id);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('le detail article (admin) expose featured_image + galerie ; le detail public aussi', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    let articleId: string | null = null;
    try {
      const img = await uploadImage(app, agent, csrf, await makePngBuffer(), 'article.png');
      const created = await agent
        .post('/api/admin/articles')
        .set('X-CSRF-Token', csrf.token)
        .send({
          title: 'Article multimedia',
          content: 'Contenu avec image principale et galerie.',
          status: 'DRAFT',
        });
      articleId = created.body.article.id;
      await agent
        .post(`/api/admin/articles/${articleId}/images`)
        .set('X-CSRF-Token', csrf.token)
        .send({ image_ids: [img.body.image.id] });
      await agent
        .put(`/api/admin/articles/${articleId}/featured-image`)
        .set('X-CSRF-Token', csrf.token)
        .send({ image_id: img.body.image.id });

      const adminDetail = await agent.get(`/api/admin/articles/${articleId}`);
      expect(adminDetail.status).toBe(200);
      expect(adminDetail.body.article.featured_image.id).toBe(img.body.image.id);
      expect(adminDetail.body.article.gallery).toHaveLength(1);
      expect(adminDetail.body.article.gallery[0].image.id).toBe(img.body.image.id);

      // Publication puis consultation publique.
      await agent
        .patch(`/api/admin/articles/${articleId}/status`)
        .set('X-CSRF-Token', csrf.token)
        .send({ status: 'PUBLISHED' });
      const publicDetail = await request.agent(app).get(`/api/articles/${adminDetail.body.article.slug}`);
      expect(publicDetail.status).toBe(200);
      expect(publicDetail.body.article.featured_image.id).toBe(img.body.image.id);
      expect(publicDetail.body.article.gallery).toHaveLength(1);

      await cleanupImage(img.body.image.id);
    } finally {
      if (articleId) await cleanupArticle(articleId);
      await cleanupUser(admin.id);
    }
  });
});
