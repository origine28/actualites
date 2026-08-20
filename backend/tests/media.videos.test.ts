import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  cleanupCategory,
  cleanupUser,
  cleanupVideo,
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

const YT_WATCH = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const YT_SHORT = 'https://youtu.be/dQw4w9WgXcQ';
const YT_EMBED = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
const VIMEO_URL = 'https://vimeo.com/76979871';
const VIMEO_EMBED = 'https://player.vimeo.com/video/76979871';

describe('POST /api/admin/videos', () => {
  it('crée une vidéo YouTube (URL watch, raccourcie et embed) → URL normalisée', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      for (const url of [YT_WATCH, YT_SHORT, YT_EMBED]) {
        const res = await agent
          .post('/api/admin/videos')
          .set('X-CSRF-Token', csrf.token)
          .send({ title: `Vidéo ${url.slice(0, 20)}`, url });
        expect(res.status).toBe(201);
        const video = res.body.video;
        expect(video.platform).toBe('YOUTUBE');
        expect(video.external_id).toBe('dQw4w9WgXcQ');
        expect(video.url).toBe(YT_EMBED);
        expect(video.status).toBe('DRAFT');
        expect(video.author.id).toBe(admin.id);
        await cleanupVideo(video.id);
      }
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('crée une vidéo Vimeo → URL embed normalisée', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const res = await agent
        .post('/api/admin/videos')
        .set('X-CSRF-Token', csrf.token)
        .send({ title: 'Vimeo', url: VIMEO_URL, status: 'PUBLISHED' });
      expect(res.status).toBe(201);
      const video = res.body.video;
      expect(video.platform).toBe('VIMEO');
      expect(video.external_id).toBe('76979871');
      expect(video.url).toBe(VIMEO_EMBED);
      expect(video.status).toBe('PUBLISHED');
      expect(video.published_at).toBeTruthy();
      await cleanupVideo(video.id);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('refuse une URL non prise en charge ou un identifiant invalide → 400 INVALID_VIDEO_URL', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      for (const url of ['https://example.com/video', 'https://youtu.be/!!', 'https://vimeo.com/abc']) {
        const res = await agent
          .post('/api/admin/videos')
          .set('X-CSRF-Token', csrf.token)
          .send({ title: 'Invalide', url });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('INVALID_VIDEO_URL');
      }
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('refuse un doublon d identifiant externe → 409 DUPLICATE_VIDEO', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const first = await agent
        .post('/api/admin/videos')
        .set('X-CSRF-Token', csrf.token)
        .send({ title: 'Doublon', url: YT_WATCH });
      expect(first.status).toBe(201);

      const second = await agent
        .post('/api/admin/videos')
        .set('X-CSRF-Token', csrf.token)
        .send({ title: 'Doublon bis', url: YT_SHORT });
      expect(second.status).toBe(409);
      expect(second.body.error.code).toBe('DUPLICATE_VIDEO');

      await cleanupVideo(first.body.video.id);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('accepte une catégorie et une miniature existantes', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    let categoryId: string | null = null;
    try {
      const category = await createCategory({ name: 'Vidéos' });
      categoryId = category.id;
      const res = await agent
        .post('/api/admin/videos')
        .set('X-CSRF-Token', csrf.token)
        .send({ title: 'Categorisee', url: YT_WATCH, category_id: category.id });
      expect(res.status).toBe(201);
      expect(res.body.video.category.id).toBe(category.id);
      await cleanupVideo(res.body.video.id);
    } finally {
      if (categoryId) await cleanupCategory(categoryId);
      await cleanupUser(admin.id);
    }
  });
});

describe('Gestion admin des vidéos', () => {
  it('liste (pagination, filtre statut, recherche) et détail', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const a = await agent
        .post('/api/admin/videos')
        .set('X-CSRF-Token', csrf.token)
        .send({ title: 'Alpha Recherche', url: YT_WATCH, status: 'PUBLISHED' });
      const b = await agent
        .post('/api/admin/videos')
        .set('X-CSRF-Token', csrf.token)
        .send({ title: 'Beta', url: VIMEO_URL, status: 'DRAFT' });

      const all = await agent.get('/api/admin/videos');
      expect(all.status).toBe(200);
      expect(all.body.pagination.total).toBeGreaterThanOrEqual(2);

      const published = await agent.get('/api/admin/videos?status=PUBLISHED');
      expect(published.body.data.every((v: { status: string }) => v.status === 'PUBLISHED')).toBe(true);

      const search = await agent.get('/api/admin/videos?search=Alpha');
      expect(search.body.data.length).toBe(1);
      expect(search.body.data[0].id).toBe(a.body.video.id);

      const detail = await agent.get(`/api/admin/videos/${b.body.video.id}`);
      expect(detail.status).toBe(200);
      expect(detail.body.video.title).toBe('Beta');

      await cleanupVideo(a.body.video.id);
      await cleanupVideo(b.body.video.id);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('met à jour titre/description/URL', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const created = await agent
        .post('/api/admin/videos')
        .set('X-CSRF-Token', csrf.token)
        .send({ title: 'Avant', url: YT_WATCH });
      const id = created.body.video.id;

      const res = await agent
        .put(`/api/admin/videos/${id}`)
        .set('X-CSRF-Token', csrf.token)
        .send({ title: 'Apres', description: 'Une description', url: VIMEO_URL });
      expect(res.status).toBe(200);
      expect(res.body.video.title).toBe('Apres');
      expect(res.body.video.description).toBe('Une description');
      expect(res.body.video.platform).toBe('VIMEO');
      expect(res.body.video.url).toBe(VIMEO_EMBED);

      await cleanupVideo(id);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('machine à états : DRAFT→PUBLISHED→ARCHIVED→PUBLISHED ; PUBLISHED→DRAFT refusé', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const created = await agent
        .post('/api/admin/videos')
        .set('X-CSRF-Token', csrf.token)
        .send({ title: 'Machine', url: YT_WATCH });
      const id = created.body.video.id;

      const setStatus = (status: string) =>
        agent.patch(`/api/admin/videos/${id}/status`).set('X-CSRF-Token', csrf.token).send({ status });

      expect((await setStatus('PUBLISHED')).body.video.status).toBe('PUBLISHED');
      expect((await setStatus('ARCHIVED')).body.video.status).toBe('ARCHIVED');
      expect((await setStatus('PUBLISHED')).body.video.status).toBe('PUBLISHED');

      const invalid = await setStatus('DRAFT');
      expect(invalid.status).toBe(409);
      expect(invalid.body.error.code).toBe('INVALID_STATUS_TRANSITION');

      await cleanupVideo(id);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('suppression → 204, puis 404 ; id inconnu → 404', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const created = await agent
        .post('/api/admin/videos')
        .set('X-CSRF-Token', csrf.token)
        .send({ title: 'A supprimer', url: YT_WATCH });
      const id = created.body.video.id;

      const del = await agent.delete(`/api/admin/videos/${id}`).set('X-CSRF-Token', csrf.token);
      expect(del.status).toBe(204);
      expect((await agent.get(`/api/admin/videos/${id}`)).status).toBe(404);

      const missing = await agent
        .delete('/api/admin/videos/00000000-0000-0000-0000-000000000000')
        .set('X-CSRF-Token', csrf.token);
      expect(missing.status).toBe(404);
    } finally {
      await cleanupUser(admin.id);
    }
  });
});

describe('Visibilité publique des vidéos', () => {
  it('seules les vidéos PUBLISHED sont exposées ; DRAFT → 404', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const draft = await agent
        .post('/api/admin/videos')
        .set('X-CSRF-Token', csrf.token)
        .send({ title: 'Cachee', url: YT_WATCH });
      const published = await agent
        .post('/api/admin/videos')
        .set('X-CSRF-Token', csrf.token)
        .send({ title: 'Visible', url: VIMEO_URL, status: 'PUBLISHED' });

      expect((await request.agent(app).get(`/api/videos/${draft.body.video.id}`)).status).toBe(404);

      const pub = await request.agent(app).get(`/api/videos/${published.body.video.id}`);
      expect(pub.status).toBe(200);
      expect(pub.body.video.url).toBe(VIMEO_EMBED);

      const list = await request.agent(app).get('/api/videos');
      expect(list.status).toBe(200);
      const ids = list.body.data.map((v: { id: string }) => v.id);
      expect(ids).toContain(published.body.video.id);
      expect(ids).not.toContain(draft.body.video.id);

      await cleanupVideo(draft.body.video.id);
      await cleanupVideo(published.body.video.id);
    } finally {
      await cleanupUser(admin.id);
    }
  });
});
