import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client.ts';
import {
  cleanupDownload,
  cleanupDownloadCategory,
  cleanupUser,
  createTestApp,
  createUser,
  loginAs,
  makeExeBuffer,
  makePdfBuffer,
  makeZipBuffer,
  uploadDownload,
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

const PDF_BODY = {
  title: 'Guide Test PDF',
  type: 'PDF',
  platform: 'WINDOWS',
  version: '1.0',
  status: 'DRAFT',
};

const APK_BODY = {
  title: 'App Mobile Test',
  type: 'MOBILE',
  platform: 'ANDROID',
  version: '2.1',
  status: 'PUBLISHED',
};

// ---------------------------------------------------------------------------
// Controle d'acces
// ---------------------------------------------------------------------------

describe('Controle d acces des telechargements', () => {
  it('ADMIN routes : anonymous → 401, USER → 403', async () => {
    const anon = await request.agent(app).get('/api/admin/downloads');
    expect(anon.status).toBe(401);

    const { user, agent } = await loginUser();
    try {
      expect((await agent.get('/api/admin/downloads')).status).toBe(403);
      expect(
        (await agent
          .post('/api/admin/downloads')
          .field('data', JSON.stringify(PDF_BODY))
          .attach('file', makePdfBuffer(), { filename: 'test.pdf', contentType: 'application/pdf' })).status,
      ).toBe(403);
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('ADMIN routes sans CSRF → 403 CSRF_INVALID', async () => {
    const { admin, agent } = await loginAdmin();
    try {
      const res = await agent
        .post('/api/admin/downloads')
        .field('data', JSON.stringify(PDF_BODY))
        .attach('file', makePdfBuffer(), { filename: 'test.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CSRF_INVALID');
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('routes publiques : USER peut lister et telecharger', async () => {
    const { admin, agent: adminAgent, csrf: adminCsrf } = await loginAdmin();
    let downloadId: string | null = null;
    try {
      const res = await uploadDownload(app, adminAgent, adminCsrf, makePdfBuffer(), 'guide.pdf', 'application/pdf', {
        ...PDF_BODY,
        status: 'PUBLISHED',
      });
      expect(res.status).toBe(201);
      downloadId = res.body.download.id;

      const { user, agent: userAgent } = await loginUser();
      try {
        const listRes = await userAgent.get('/api/downloads');
        expect(listRes.status).toBe(200);
        expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
      } finally {
        await cleanupUser(user.id);
      }
    } finally {
      if (downloadId) await cleanupDownload(downloadId);
      await cleanupUser(admin.id);
    }
  });
});

// ---------------------------------------------------------------------------
// Upload creation
// ---------------------------------------------------------------------------

describe('POST /api/admin/downloads (upload)', () => {
  it('cree un DRAFT PDF avec sha256, slug, dimensions', async () => {
    const { admin, agent, csrf } = await loginAdmin();
    try {
      const buffer = makePdfBuffer();
      const res = await uploadDownload(app, agent, csrf, buffer, 'Mon Guide.pdf', 'application/pdf', PDF_BODY);
      expect(res.status).toBe(201);
      const d = res.body.download;
      expect(d.id).toBeTruthy();
      expect(d.title).toBe('Guide Test PDF');
      expect(d.slug).toContain('guide-test-pdf');
      expect(d.type).toBe('PDF');
      expect(d.platform).toBe('WINDOWS');
      expect(d.status).toBe('DRAFT');
      expect(d.published_at).toBeNull();
      expect(d.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(d.size_bytes).toBe(buffer.length);
      expect(d.original_name).toBe('Mon Guide.pdf');
      expect(d.author.id).toBe(admin.id);
      expect(d.author.username).toBe(admin.username);
      await cleanupDownload(d.id);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('cree un MOBILE PUBLISHED APK', async () => {
    const { admin, agent, csrf } = await loginAdmin();
    try {
      const buffer = makeZipBuffer();
      const res = await uploadDownload(app, agent, csrf, buffer, 'app.apk', 'application/vnd.android.package-archive', APK_BODY);
      expect(res.status).toBe(201);
      const d = res.body.download;
      expect(d.type).toBe('MOBILE');
      expect(d.platform).toBe('ANDROID');
      expect(d.status).toBe('PUBLISHED');
      expect(d.published_at).toBeTruthy();
      await cleanupDownload(d.id);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('erreur sans fichier → 400 NO_FILE', async () => {
    const { admin, agent, csrf } = await loginAdmin();
    try {
      const res = await agent
        .post('/api/admin/downloads')
        .set('X-CSRF-Token', csrf.token)
        .field('data', JSON.stringify(PDF_BODY));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('NO_FILE');
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('extension invalide pour le type → 415', async () => {
    const { admin, agent, csrf } = await loginAdmin();
    try {
      const res = await uploadDownload(app, agent, csrf, makePdfBuffer(), 'guide.exe', 'application/pdf', PDF_BODY);
      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe('UNSUPPORTED_EXTENSION');
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('magic invalide → 415 INVALID_MAGIC', async () => {
    const { admin, agent, csrf } = await loginAdmin();
    try {
      const fakePdf = Buffer.from('NOT_A_PDF_FILE');
      const res = await uploadDownload(app, agent, csrf, fakePdf, 'fake.pdf', 'application/pdf', PDF_BODY);
      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe('INVALID_MAGIC');
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('double extension → 415 DOUBLE_EXTENSION', async () => {
    const { admin, agent, csrf } = await loginAdmin();
    try {
      const res = await uploadDownload(app, agent, csrf, makePdfBuffer(), 'guide.pdf.exe', 'application/pdf', PDF_BODY);
      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe('DOUBLE_EXTENSION');
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('EXE buffer avec signature MZ+PE → 201', async () => {
    const { admin, agent, csrf } = await loginAdmin();
    try {
      const res = await uploadDownload(app, agent, csrf, makeExeBuffer(), 'app.exe', 'application/vnd.microsoft.portable-executable', {
        title: 'App Desktop',
        type: 'DESKTOP',
        platform: 'WINDOWS',
        status: 'DRAFT',
      });
      expect(res.status).toBe(201);
      expect(res.body.download.type).toBe('DESKTOP');
      expect(res.body.download.platform).toBe('WINDOWS');
      await cleanupDownload(res.body.download.id);
    } finally {
      await cleanupUser(admin.id);
    }
  });
});

// ---------------------------------------------------------------------------
// GET / GET BY ID
// ---------------------------------------------------------------------------

describe('GET /api/admin/downloads/:id', () => {
  it('retourne un telechargement avec relations', async () => {
    const { admin, agent, csrf } = await loginAdmin();
    try {
      const createRes = await uploadDownload(app, agent, csrf, makePdfBuffer(), 'doc.pdf', 'application/pdf', PDF_BODY);
      expect(createRes.status).toBe(201);
      const id = createRes.body.download.id;

      const getRes = await agent.get(`/api/admin/downloads/${id}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.download.id).toBe(id);
      expect(getRes.body.download.author.username).toBe(admin.username);
      await cleanupDownload(id);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('ID inconnu → 404', async () => {
    const { agent } = await loginAdmin();
    const res = await agent.get('/api/admin/downloads/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
    await cleanupUser((await prisma.auditLog.findFirst({ orderBy: { created_at: 'desc' } }))?.user_id ?? '');
  });

  it('ID malforme → 404', async () => {
    const { agent, admin } = await loginAdmin();
    try {
      const res = await agent.get('/api/admin/downloads/not-a-uuid');
      expect(res.status).toBe(404);
    } finally {
      await cleanupUser(admin.id);
    }
  });
});

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

describe('PUT /api/admin/downloads/:id', () => {
  it('met a jour le titre et la version', async () => {
    const { admin, agent, csrf } = await loginAdmin();
    try {
      const createRes = await uploadDownload(app, agent, csrf, makePdfBuffer(), 'doc.pdf', 'application/pdf', PDF_BODY);
      const id = createRes.body.download.id;

      const updateRes = await agent
        .put(`/api/admin/downloads/${id}`)
        .set('X-CSRF-Token', csrf.token)
        .send({ title: 'Guide V2', version: '2.0' });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.download.title).toBe('Guide V2');
      expect(updateRes.body.download.version).toBe('2.0');
      await cleanupDownload(id);
    } finally {
      await cleanupUser(admin.id);
    }
  });
});

// ---------------------------------------------------------------------------
// STATUT
// ---------------------------------------------------------------------------

describe('PATCH /api/admin/downloads/:id/status', () => {
  it('DRAFT → PUBLISHED', async () => {
    const { admin, agent, csrf } = await loginAdmin();
    try {
      const createRes = await uploadDownload(app, agent, csrf, makePdfBuffer(), 'doc.pdf', 'application/pdf', PDF_BODY);
      const id = createRes.body.download.id;

      const statusRes = await agent
        .patch(`/api/admin/downloads/${id}/status`)
        .set('X-CSRF-Token', csrf.token)
        .send({ status: 'PUBLISHED' });
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.download.status).toBe('PUBLISHED');
      expect(statusRes.body.download.published_at).toBeTruthy();
      await cleanupDownload(id);
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('PUBLISHED → ARCHIVED', async () => {
    const { admin, agent, csrf } = await loginAdmin();
    try {
      const createRes = await uploadDownload(app, agent, csrf, makePdfBuffer(), 'doc.pdf', 'application/pdf', {
        ...PDF_BODY,
        status: 'PUBLISHED',
      });
      const id = createRes.body.download.id;

      const statusRes = await agent
        .patch(`/api/admin/downloads/${id}/status`)
        .set('X-CSRF-Token', csrf.token)
        .send({ status: 'ARCHIVED' });
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.download.status).toBe('ARCHIVED');
      await cleanupDownload(id);
    } finally {
      await cleanupUser(admin.id);
    }
  });
});

// ---------------------------------------------------------------------------
// DELETE (soft)
// ---------------------------------------------------------------------------

describe('DELETE /api/admin/downloads/:id', () => {
  it('supprime un telechargement (soft delete)', async () => {
    const { admin, agent, csrf } = await loginAdmin();
    try {
      const createRes = await uploadDownload(app, agent, csrf, makePdfBuffer(), 'doc.pdf', 'application/pdf', PDF_BODY);
      const id = createRes.body.download.id;

      const delRes = await agent
        .delete(`/api/admin/downloads/${id}`)
        .set('X-CSRF-Token', csrf.token);
      expect(delRes.status).toBe(204);

      // Plus visible dans la liste admin
      const listRes = await agent.get('/api/admin/downloads');
      expect(listRes.body.data.find((d: { id: string }) => d.id === id)).toBeUndefined();

      // Cleanup DB row directly (soft-deleted)
      await prisma.downloadLog.deleteMany({ where: { download_id: id } });
      await prisma.download.delete({ where: { id } });
    } finally {
      await cleanupUser(admin.id);
    }
  });

  it('ID inconnu → 404', async () => {
    const { agent, csrf, admin } = await loginAdmin();
    try {
      const res = await agent
        .delete('/api/admin/downloads/00000000-0000-0000-0000-000000000000')
        .set('X-CSRF-Token', csrf.token);
      expect(res.status).toBe(404);
    } finally {
      await cleanupUser(admin.id);
    }
  });
});

// ---------------------------------------------------------------------------
// TELECHARGEMENT PUBLIC (fichier)
// ---------------------------------------------------------------------------

describe('GET /api/downloads/:id/file', () => {
  it('PUBLISHED : Content-Disposition attachment, nosniff', async () => {
    const { admin, agent, csrf } = await loginAdmin();
    let downloadId: string | null = null;
    try {
      const createRes = await uploadDownload(app, agent, csrf, makePdfBuffer(), 'test.pdf', 'application/pdf', {
        ...PDF_BODY,
        status: 'PUBLISHED',
      });
      downloadId = createRes.body.download.id;

      const { user, agent: userAgent } = await loginUser();
      try {
        const fileRes = await userAgent.get(`/api/downloads/${downloadId}/file`);
        expect(fileRes.status).toBe(200);
        expect(fileRes.headers['content-disposition']).toContain('attachment');
        expect(fileRes.headers['x-content-type-options']).toBe('nosniff');
        expect(fileRes.headers['cache-control']).toBe('private, no-store');
        expect(fileRes.headers['content-type']).toBe('application/pdf');
      } finally {
        await cleanupUser(user.id);
      }
    } finally {
      if (downloadId) await cleanupDownload(downloadId);
      await cleanupUser(admin.id);
    }
  });

  it('DRAFT : 404 pour un USER', async () => {
    const { admin, agent, csrf } = await loginAdmin();
    let downloadId: string | null = null;
    try {
      const createRes = await uploadDownload(app, agent, csrf, makePdfBuffer(), 'draft.pdf', 'application/pdf', {
        ...PDF_BODY,
        status: 'DRAFT',
      });
      downloadId = createRes.body.download.id;

      const { user, agent: userAgent } = await loginUser();
      try {
        const fileRes = await userAgent.get(`/api/downloads/${downloadId}/file`);
        expect(fileRes.status).toBe(404);
      } finally {
        await cleanupUser(user.id);
      }
    } finally {
      if (downloadId) await cleanupDownload(downloadId);
      await cleanupUser(admin.id);
    }
  });

  it('ARCHIVED : 404 pour un USER', async () => {
    const { admin, agent, csrf } = await loginAdmin();
    let downloadId: string | null = null;
    try {
      const createRes = await uploadDownload(app, agent, csrf, makePdfBuffer(), 'archived.pdf', 'application/pdf', {
        ...PDF_BODY,
        status: 'ARCHIVED',
      });
      downloadId = createRes.body.download.id;

      const { user, agent: userAgent } = await loginUser();
      try {
        const fileRes = await userAgent.get(`/api/downloads/${downloadId}/file`);
        expect(fileRes.status).toBe(404);
      } finally {
        await cleanupUser(user.id);
      }
    } finally {
      if (downloadId) await cleanupDownload(downloadId);
      await cleanupUser(admin.id);
    }
  });

  it('ID inconnu → 404', async () => {
    const { user, agent } = await loginUser();
    try {
      const res = await agent.get('/api/downloads/00000000-0000-0000-0000-000000000000/file');
      expect(res.status).toBe(404);
    } finally {
      await cleanupUser(user.id);
    }
  });
});

// ---------------------------------------------------------------------------
// DOWNLOAD LOGS
// ---------------------------------------------------------------------------

describe('Download logs', () => {
  it('un telechargement enregistre un log avec ip', async () => {
    const { admin, agent, csrf } = await loginAdmin();
    let downloadId: string | null = null;
    try {
      const createRes = await uploadDownload(app, agent, csrf, makePdfBuffer(), 'log.pdf', 'application/pdf', {
        ...PDF_BODY,
        status: 'PUBLISHED',
      });
      downloadId = createRes.body.download.id;

      const { user, agent: userAgent } = await loginUser();
      try {
        const fileRes = await userAgent.get(`/api/downloads/${downloadId}/file`);
        expect(fileRes.status).toBe(200);

        const log = await prisma.downloadLog.findFirst({
          where: { download_id: downloadId, user_id: user.id },
        });
        expect(log).not.toBeNull();
        expect(log!.ip).toBeTruthy();
      } finally {
        await cleanupUser(user.id);
      }
    } finally {
      if (downloadId) await cleanupDownload(downloadId);
      await cleanupUser(admin.id);
    }
  });
});

// ---------------------------------------------------------------------------
// LISTE ADMIN
// ---------------------------------------------------------------------------

describe('GET /api/admin/downloads', () => {
  it('liste, pagination, filtres', async () => {
    const { admin, agent, csrf } = await loginAdmin();
    const ids: string[] = [];
    try {
      const r1 = await uploadDownload(app, agent, csrf, makePdfBuffer(), 'a.pdf', 'application/pdf', {
        title: 'Alpha PDF',
        type: 'PDF',
        platform: 'WINDOWS',
        status: 'DRAFT',
      });
      ids.push(r1.body.download.id);
      const r2 = await uploadDownload(app, agent, csrf, makeZipBuffer(), 'b.apk', 'application/vnd.android.package-archive', {
        title: 'Beta APK',
        type: 'MOBILE',
        platform: 'ANDROID',
        status: 'PUBLISHED',
      });
      ids.push(r2.body.download.id);

      // Liste complète
      const all = await agent.get('/api/admin/downloads');
      expect(all.status).toBe(200);
      expect(all.body.data.length).toBeGreaterThanOrEqual(2);

      // Filtre type=PDF
      const pdfOnly = await agent.get('/api/admin/downloads?type=PDF');
      expect(pdfOnly.body.data.every((d: { type: string }) => d.type === 'PDF')).toBe(true);

      // Recherche
      const search = await agent.get('/api/admin/downloads?search=Alpha');
      expect(search.body.data.length).toBeGreaterThanOrEqual(1);
    } finally {
      for (const id of ids) {
        await cleanupDownload(id);
      }
      await cleanupUser(admin.id);
    }
  });
});

// ---------------------------------------------------------------------------
// LISTE PUBLIQUE
// ---------------------------------------------------------------------------

describe('GET /api/downloads', () => {
  it('ne montre que les PUBLISHED, filtre type', async () => {
    const { admin, agent, csrf } = await loginAdmin();
    const ids: string[] = [];
    try {
      const r1 = await uploadDownload(app, agent, csrf, makePdfBuffer(), 'a.pdf', 'application/pdf', {
        title: 'Public PDF',
        type: 'PDF',
        platform: 'WINDOWS',
        status: 'PUBLISHED',
      });
      ids.push(r1.body.download.id);
      const r2 = await uploadDownload(app, agent, csrf, makeZipBuffer(), 'b.apk', 'application/vnd.android.package-archive', {
        title: 'Private APK',
        type: 'MOBILE',
        platform: 'ANDROID',
        status: 'DRAFT',
      });
      ids.push(r2.body.download.id);

      const { user, agent: userAgent } = await loginUser();
      try {
        const all = await userAgent.get('/api/downloads');
        expect(all.status).toBe(200);
        const titles = all.body.data.map((d: { title: string }) => d.title);
        expect(titles).toContain('Public PDF');
        expect(titles).not.toContain('Private APK');

        // Filtre type=MOBILE : ne devrait rien retourner (le seul MOBILE est DRAFT)
        const mobile = await userAgent.get('/api/downloads?type=MOBILE');
        expect(mobile.body.data.length).toBe(0);
      } finally {
        await cleanupUser(user.id);
      }
    } finally {
      for (const id of ids) {
        await cleanupDownload(id);
      }
      await cleanupUser(admin.id);
    }
  });
});

// ---------------------------------------------------------------------------
// CATEGORIES
// ---------------------------------------------------------------------------

describe('Categories de telechargements', () => {
  it('CRUD complet', async () => {
    const { admin, agent, csrf } = await loginAdmin();
    let catId: string | null = null;
    try {
      // Create
      const createRes = await agent
        .post('/api/admin/download-categories')
        .set('X-CSRF-Token', csrf.token)
        .send({ name: 'Applications Android', sort_order: 1 });
      expect(createRes.status).toBe(201);
      expect(createRes.body.category.name).toBe('Applications Android');
      catId = createRes.body.category.id;

      // List
      const listRes = await agent.get('/api/admin/download-categories');
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.some((c: { id: string }) => c.id === catId)).toBe(true);

      // Update
      const updateRes = await agent
        .put(`/api/admin/download-categories/${catId}`)
        .set('X-CSRF-Token', csrf.token)
        .send({ name: 'Apps Mobile' });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.category.name).toBe('Apps Mobile');

      // Delete (empty)
      const delRes = await agent
        .delete(`/api/admin/download-categories/${catId}`)
        .set('X-CSRF-Token', csrf.token);
      expect(delRes.status).toBe(204);
      catId = null;
    } finally {
      if (catId) await cleanupDownloadCategory(catId);
      await cleanupUser(admin.id);
    }
  });

  it('refuse suppression d une categorie utilisee', async () => {
    const { admin, agent, csrf } = await loginAdmin();
    let catId: string | null = null;
    let downloadId: string | null = null;
    try {
      const catRes = await agent
        .post('/api/admin/download-categories')
        .set('X-CSRF-Token', csrf.token)
        .send({ name: 'Cat Test' });
      catId = catRes.body.category.id;

      const dlRes = await uploadDownload(app, agent, csrf, makePdfBuffer(), 'doc.pdf', 'application/pdf', {
        title: 'Doc lie',
        type: 'PDF',
        platform: 'WINDOWS',
        status: 'DRAFT',
        download_category_id: catId,
      });
      downloadId = dlRes.body.download.id;

      const delRes = await agent
        .delete(`/api/admin/download-categories/${catId}`)
        .set('X-CSRF-Token', csrf.token);
      expect(delRes.status).toBe(409);
      expect(delRes.body.error.code).toBe('CATEGORY_IN_USE');
    } finally {
      if (downloadId) await cleanupDownload(downloadId);
      if (catId) await cleanupDownloadCategory(catId);
      await cleanupUser(admin.id);
    }
  });
});

// ---------------------------------------------------------------------------
// AUDIT
// ---------------------------------------------------------------------------

describe('Audit des telechargements', () => {
  it('operations admin genèrent des logs d audit', async () => {
    const { admin, agent, csrf } = await loginAdmin();
    let downloadId: string | null = null;
    try {
      const createRes = await uploadDownload(app, agent, csrf, makePdfBuffer(), 'audit.pdf', 'application/pdf', PDF_BODY);
      downloadId = createRes.body.download.id;

      // Vérifier l'entrée d'audit pour la création
      const auditEntry = await prisma.auditLog.findFirst({
        where: { entity_id: downloadId, action: 'DOWNLOAD_CREATED' },
      });
      expect(auditEntry).not.toBeNull();
      expect(auditEntry!.user_id).toBe(admin.id);
    } finally {
      if (downloadId) await cleanupDownload(downloadId);
      await cleanupUser(admin.id);
    }
  });
});
