import { describe, expect, it } from 'vitest';
import {
  cleanupArticle,
  cleanupImage,
  cleanupUser,
  cleanupVideo,
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

describe('Sécurité du pipeline d upload', () => {
  it('neutralise la traversée de chemin dans le nom de fichier', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const res = await uploadImage(app, agent, csrf, await makePngBuffer(), '../../../../etc/passwd.png');
      expect(res.status).toBe(201);
      expect(res.body.image.original_name).toBe('passwd.png');

      const windows = await uploadImage(app, agent, csrf, await makePngBuffer(), '..\\..\\evil.png');
      expect(windows.status).toBe(201);
      expect(windows.body.image.original_name).toBe('evil.png');

      await cleanupImage(res.body.image.id);
      await cleanupImage(windows.body.image.id);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('neutralise un caractère de contrôle dans le nom (assaini par la chaîne multipart)', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const res = await uploadImage(app, agent, csrf, await makePngBuffer(), 'bad\nname.png');
      expect(res.status).toBe(201);
      expect(res.body.image.original_name).not.toContain('\n');
      expect(res.body.image.original_name).not.toContain('\r');
      await cleanupImage(res.body.image.id);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('rejette un HTML déguisé en image (extension .jpg mais pas de signature)', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const html = Buffer.from('<html><script>alert(1)</script></html>');
      const res = await uploadImage(app, agent, csrf, html, 'page.jpg', 'image/jpeg');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_IMAGE');
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('polyglotte PNG+script : accepté comme image mais sert un PNG nettoyé', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    let imageId: string | null = null;
    try {
      const polyglot = Buffer.concat([await makePngBuffer(), Buffer.from('<script>alert(1)</script>')]);
      const up = await uploadImage(app, agent, csrf, polyglot, 'polyglot.png');
      expect(up.status).toBe(201);
      imageId = up.body.image.id;

      const read = await agent.get(`/api/images/${imageId}`);
      expect(read.status).toBe(200);
      expect(read.headers['content-type']).toContain('image/png');
      expect(read.body.toString('utf8')).not.toContain('<script>');
    } finally {
      if (imageId) await cleanupImage(imageId);
      await cleanupUser(admin.id);
    }
  });

  it('en-têtes de sécurité sur la lecture : nosniff + cache immutable', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    let imageId: string | null = null;
    try {
      const up = await uploadImage(app, agent, csrf, await makePngBuffer(), 'headers.png');
      imageId = up.body.image.id;
      const read = await agent.get(`/api/images/${imageId}`);
      expect(read.headers['x-content-type-options']).toBe('nosniff');
      expect(read.headers['cache-control']).toContain('immutable');
    } finally {
      if (imageId) await cleanupImage(imageId);
      await cleanupUser(admin.id);
    }
  });

  it('rejette un PDF uploadé comme image → 400 INVALID_IMAGE', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('1 0 obj<<>>endobj\n%%EOF')]);
      const res = await uploadImage(app, agent, csrf, pdf, 'document.pdf', 'application/pdf');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_IMAGE');
    } finally {
      await cleanupUser(admin.id);
    }
  });
});

describe('Suppression protégée des images référencées', () => {
  it('refuse la suppression tant que l image est featured, dans la galerie ou miniature', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    const article = await createArticle({ author_id: admin.id });
    let featuredId: string | null = null;
    let galleryId: string | null = null;
    let thumbId: string | null = null;
    try {
      // 1. image principale d'un article
      const featured = await uploadImage(app, agent, csrf, await makePngBuffer(), 'feat.png');
      featuredId = featured.body.image.id;
      await agent
        .put(`/api/admin/articles/${article.id}/featured-image`)
        .set('X-CSRF-Token', csrf.token)
        .send({ image_id: featuredId });
      const delFeatured = await agent.delete(`/api/admin/images/${featuredId}`).set('X-CSRF-Token', csrf.token);
      expect(delFeatured.status).toBe(409);
      expect(delFeatured.body.error.code).toBe('IMAGE_IN_USE');

      // 2. membre de galerie
      const gallery = await uploadImage(app, agent, csrf, await makePngBuffer(), 'gal.png');
      galleryId = gallery.body.image.id;
      await agent
        .post(`/api/admin/articles/${article.id}/images`)
        .set('X-CSRF-Token', csrf.token)
        .send({ image_ids: [galleryId] });
      const delGallery = await agent.delete(`/api/admin/images/${galleryId}`).set('X-CSRF-Token', csrf.token);
      expect(delGallery.status).toBe(409);

      // 3. miniature d'une vidéo
      const thumb = await uploadImage(app, agent, csrf, await makePngBuffer(), 'thumb.png');
      thumbId = thumb.body.image.id;
      const video = await agent
        .post('/api/admin/videos')
        .set('X-CSRF-Token', csrf.token)
        .send({ title: 'Miniature', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', thumbnail_image_id: thumbId });
      expect(video.status).toBe(201);
      const delThumb = await agent.delete(`/api/admin/images/${thumbId}`).set('X-CSRF-Token', csrf.token);
      expect(delThumb.status).toBe(409);

      // 4. après retrait des usages, la suppression passe
      await agent
        .put(`/api/admin/articles/${article.id}/featured-image`)
        .set('X-CSRF-Token', csrf.token)
        .send({ image_id: null });
      await agent
        .delete(`/api/admin/articles/${article.id}/images/${galleryId}`)
        .set('X-CSRF-Token', csrf.token);
      await cleanupVideo(video.body.video.id);

      expect((await agent.delete(`/api/admin/images/${featuredId}`).set('X-CSRF-Token', csrf.token)).status).toBe(204);
      expect((await agent.delete(`/api/admin/images/${galleryId}`).set('X-CSRF-Token', csrf.token)).status).toBe(204);
      expect((await agent.delete(`/api/admin/images/${thumbId}`).set('X-CSRF-Token', csrf.token)).status).toBe(204);

      featuredId = null;
      galleryId = null;
      thumbId = null;
    } finally {
      await cleanupArticle(article.id);
      if (featuredId) await cleanupImage(featuredId);
      if (galleryId) await cleanupImage(galleryId);
      if (thumbId) await cleanupImage(thumbId);
      await cleanupUser(admin.id);
    }
  });
});
