import sharp from 'sharp';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { env } from '../src/config/env.ts';
import { prisma } from '../src/db/client.ts';
import {
  cleanupImage,
  cleanupUser,
  createTestApp,
  createUser,
  loginAs,
  makeJpegBuffer,
  makePngBuffer,
  makeWebpBuffer,
  uploadImage,
} from './helpers.ts';

const app = createTestApp();

async function loginAdmin() {
  const { user, password } = await createUser({ role: 'ADMIN' });
  const { res, agent, csrf } = await loginAs(app, user.username, password);
  expect(res.status).toBe(200);
  return { admin: user, agent, csrf };
}

async function loginUser() {
  const { user, password } = await createUser({ role: 'USER' });
  const { res, agent, csrf } = await loginAs(app, user.username, password);
  expect(res.status).toBe(200);
  return { user, agent, csrf };
}

describe('Controle d acces des images', () => {
  it('upload : anonymous → 401, USER → 403', async () => {
    const anon = await request.agent(app).post('/api/admin/images').attach('image', await makePngBuffer(), {
      filename: 'a.png',
      contentType: 'image/png',
    });
    expect(anon.status).toBe(401);

    const { user, agent } = await loginUser();
    try {
      const res = await agent.post('/api/admin/images').attach('image', await makePngBuffer(), {
        filename: 'a.png',
        contentType: 'image/png',
      });
      expect(res.status).toBe(403);
      expect((await agent.get('/api/admin/images')).status).toBe(403);
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('upload sans jeton CSRF → 403 CSRF_INVALID', async () => {
    const { admin, agent } = await loginAdmin();
    try {
      const res = await agent.post('/api/admin/images').attach('image', await makePngBuffer(), {
        filename: 'a.png',
        contentType: 'image/png',
      });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CSRF_INVALID');
    } finally {
      await cleanupUser(admin.id);
    }
  });
});

describe('POST /api/admin/images (upload)', () => {
  it('uploade un PNG : variantes generes, sha256, dimensions, nom assaini', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const res = await uploadImage(app, agent, csrf, await makePngBuffer(120, 80), 'Ma Photo.png');
      expect(res.status).toBe(201);
      const image = res.body.image;
      expect(image.id).toBeTruthy();
      expect(image.mime_type).toBe('image/png');
      expect(image.width).toBe(120);
      expect(image.height).toBe(80);
      expect(image.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(image.original_name).toBe('Ma Photo.png');
      expect(image.url).toBe(`/api/images/${image.id}`);
      expect(image.urls).toEqual({
        original: `/api/images/${image.id}`,
        thumb: `/api/images/${image.id}?variant=thumb`,
        medium: `/api/images/${image.id}?variant=medium`,
        large: `/api/images/${image.id}?variant=large`,
      });
      await cleanupImage(image.id);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('uploade un JPEG puis un WEBP', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const jpeg = await uploadImage(app, agent, csrf, await makeJpegBuffer(), 'shot.jpg', 'image/jpeg');
      expect(jpeg.status).toBe(201);
      expect(jpeg.body.image.mime_type).toBe('image/jpeg');

      const webp = await uploadImage(app, agent, csrf, await makeWebpBuffer(), 'anim.webp', 'image/webp');
      expect(webp.status).toBe(201);
      expect(webp.body.image.mime_type).toBe('image/webp');

      await cleanupImage(jpeg.body.image.id);
      await cleanupImage(webp.body.image.id);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('rejette un fichier sans signature image (magic bytes)', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const res = await uploadImage(app, agent, csrf, Buffer.from('Ceci est juste du texte.'), 'faux.png');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_IMAGE');
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('rejette un SVG déguisé en image', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
      const res = await uploadImage(app, agent, csrf, svg, 'malicious.svg', 'image/svg+xml');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_IMAGE');
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('rejette un fichier dépassant la taille maximale → 413', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const huge = Buffer.alloc(env.MAX_IMAGE_SIZE + 1);
      huge[0] = 0xff;
      huge[1] = 0xd8;
      huge[2] = 0xff;
      const res = await uploadImage(app, agent, csrf, huge, 'huge.jpg', 'image/jpeg');
      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe('FILE_TOO_LARGE');
    } finally {
      await cleanupUser(admin.id);
    }
  });
});

describe('GET /api/admin/images', () => {
  it('liste paginee, detail, alt, suppression', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const uploaded = await uploadImage(app, agent, csrf, await makePngBuffer(), 'liste.png');
      expect(uploaded.status).toBe(201);
      const id = uploaded.body.image.id;

      const list = await agent.get('/api/admin/images');
      expect(list.status).toBe(200);
      expect(Array.isArray(list.body.data)).toBe(true);
      expect(list.body.pagination.total).toBeGreaterThanOrEqual(1);

      const detail = await agent.get(`/api/admin/images/${id}`);
      expect(detail.status).toBe(200);
      expect(detail.body.image.id).toBe(id);

      const alt = await agent
        .patch(`/api/admin/images/${id}`)
        .set('X-CSRF-Token', csrf.token)
        .send({ alt: 'Photo principale' });
      expect(alt.status).toBe(200);
      expect(alt.body.image.alt).toBe('Photo principale');

      const missing = await agent.get('/api/admin/images/00000000-0000-0000-0000-000000000000');
      expect(missing.status).toBe(404);

      const del = await agent.delete(`/api/admin/images/${id}`).set('X-CSRF-Token', csrf.token);
      expect(del.status).toBe(204);
      expect((await agent.get(`/api/admin/images/${id}`)).status).toBe(404);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('suppression d une image inconnue → 404', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const res = await agent
        .delete('/api/admin/images/00000000-0000-0000-0000-000000000000')
        .set('X-CSRF-Token', csrf.token);
      expect(res.status).toBe(404);
    } finally {
      await cleanupUser(admin.id);
    }
  });
});

describe('Lecture du fichier image (/api/images/:id)', () => {
  it('USER authentifie lit l original ; anonymous → 401', async () => {
    const { agent: adminAgent, csrf, admin } = await loginAdmin();
    let imageId: string | null = null;
    try {
      const up = await uploadImage(app, adminAgent, csrf, await makePngBuffer(64, 64), 'read.png');
      imageId = up.body.image.id;

      const anon = await request.agent(app).get(`/api/images/${imageId}`);
      expect(anon.status).toBe(401);

      const { agent: userAgent, user } = await loginUser();
      try {
        const res = await userAgent.get(`/api/images/${imageId}`);
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('image/png');
        expect(res.body.length).toBeGreaterThan(0);
      } finally {
        await cleanupUser(user.id);
      }
    } finally {
      if (imageId) await cleanupImage(imageId);
      await cleanupUser(admin.id);
    }
  });

  it('sert les variantes thumb/medium/large (webp, dimension bornee)', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    let imageId: string | null = null;
    try {
      const up = await uploadImage(app, agent, csrf, await makePngBuffer(800, 600), 'big.png');
      imageId = up.body.image.id;

      const thumb = await agent.get(`/api/images/${imageId}?variant=thumb`);
      expect(thumb.status).toBe(200);
      expect(thumb.headers['content-type']).toContain('image/webp');
      const thumbMeta = await sharp(thumb.body).metadata();
      expect(thumbMeta.width).toBeLessThanOrEqual(256);

      const large = await agent.get(`/api/images/${imageId}?variant=large`);
      expect(large.status).toBe(200);
      const largeMeta = await sharp(large.body).metadata();
      expect(largeMeta.width).toBeLessThanOrEqual(1920);
    } finally {
      if (imageId) await cleanupImage(imageId);
      await cleanupUser(admin.id);
    }
  });

  it('variante inconnue → 400 ; image inconnue → 404', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    let imageId: string | null = null;
    try {
      const up = await uploadImage(app, agent, csrf, await makePngBuffer(), 'v.png');
      imageId = up.body.image.id;

      const badVariant = await agent.get(`/api/images/${imageId}?variant=huge`);
      expect(badVariant.status).toBe(400);

      const missing = await agent.get('/api/images/00000000-0000-0000-0000-000000000000');
      expect(missing.status).toBe(404);
    } finally {
      if (imageId) await cleanupImage(imageId);
      await cleanupUser(admin.id);
    }
  });

  it('le fichier est physiquement supprimé après DELETE', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const up = await uploadImage(app, agent, csrf, await makePngBuffer(), 'del.png');
      const id = up.body.image.id;
      await agent.delete(`/api/admin/images/${id}`).set('X-CSRF-Token', csrf.token);

      // Après suppression : lecture → 404 (le stream est introuvable sur disque).
      const res = await agent.get(`/api/images/${id}`);
      expect(res.status).toBe(404);

      // Le nom du fichier était généré serveur ; aucun fichier ne doit survivre.
      const row = await prisma.image.findUnique({ where: { id } });
      expect(row).toBeNull();
    } finally {
      await cleanupUser(admin.id);
    }
  });
});
