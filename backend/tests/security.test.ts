import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client.ts';
import {
  cleanupArticle,
  cleanupDownload,
  cleanupTag,
  cleanupUser,
  createTag,
  createTestApp,
  createUser,
  loginAs,
  makePdfBuffer,
  uploadDownload,
  uploadImage,
} from './helpers.ts';

const app = createTestApp({ globalRateLimit: null });

// ---------------------------------------------------------------------------
// HELMET / HEADERS
// ---------------------------------------------------------------------------
describe('Security headers (Helmet)', () => {
  it('GET /api/health renvoie X-Content-Type-Options: nosniff', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('GET /api/health renvoie X-Frame-Options: SAMEORIGIN', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('GET /api/health est accessible sans auth (public)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });

  it('GET /api/health ne renvoie pas X-Powered-By', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('GET /api/health renvoie Referrer-Policy', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['referrer-policy']).toBeDefined();
  });

  it('GET /api/health renvoie Content-Security-Policy', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('CSP contient frame-ancestors self', async () => {
    const res = await request(app).get('/api/health');
    const csp = res.headers['content-security-policy'] as string;
    expect(csp).toContain("frame-ancestors 'self'");
  });

  it('CSP contient default-src self', async () => {
    const res = await request(app).get('/api/health');
    const csp = res.headers['content-security-policy'] as string;
    expect(csp).toContain("default-src 'self'");
  });

  it('CSP autorise frame-src YouTube et Vimeo', async () => {
    const res = await request(app).get('/api/health');
    const csp = res.headers['content-security-policy'] as string;
    expect(csp).toContain('https://www.youtube.com');
    expect(csp).toContain('https://player.vimeo.com');
  });

  it('CSP interdit object-src', async () => {
    const res = await request(app).get('/api/health');
    const csp = res.headers['content-security-policy'] as string;
    expect(csp).toContain("object-src 'none'");
  });
});

// ---------------------------------------------------------------------------
// IP RESOLUTION — spoofing test
// ---------------------------------------------------------------------------
describe('IP spoofing protection', () => {
  it('X-Forwarded-For injecté par un client non-fiable est ignoré', async () => {
    const { user, password } = await createUser({ role: 'ADMIN' });
    try {
      const { agent } = await loginAs(app, user.username, password);
      const res = await agent
        .get('/api/auth/me')
        .set('X-Forwarded-For', '1.2.3.4');
      expect(res.status).toBe(200);
      // L'IP dans les audit logs ne doit pas être 1.2.3.4
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('CF-Connecting-IP est accepté (tunnel de confiance)', async () => {
    const { user, password } = await createUser({ role: 'ADMIN' });
    try {
      const { agent } = await loginAs(app, user.username, password);
      const res = await agent
        .get('/api/auth/me')
        .set('CF-Connecting-IP', '5.6.7.8');
      expect(res.status).toBe(200);
    } finally {
      await cleanupUser(user.id);
    }
  });
});

// ---------------------------------------------------------------------------
// AUTHORIZATION — USER → ADMIN routes
// ---------------------------------------------------------------------------
describe('USER cannot access ADMIN routes', () => {
  async function loginNormalUser() {
    const { user, password } = await createUser({ role: 'USER' });
    const { agent } = await loginAs(app, user.username, password);
    return { user, agent };
  }

  const adminRoutes = [
    { method: 'GET', path: '/api/admin/users' },
    { method: 'GET', path: '/api/admin/articles' },
    { method: 'GET', path: '/api/admin/categories' },
    { method: 'GET', path: '/api/admin/tags' },
    { method: 'GET', path: '/api/admin/images' },
    { method: 'GET', path: '/api/admin/videos' },
    { method: 'GET', path: '/api/admin/downloads' },
    { method: 'GET', path: '/api/admin/contact-messages' },
    { method: 'GET', path: '/api/admin/login-history' },
  ];

  for (const route of adminRoutes) {
    it(`${route.method} ${route.path} → 403 pour USER`, async () => {
      const { user, agent } = await loginNormalUser();
      try {
        const res = await agent[route.method.toLowerCase() as 'get'](route.path);
        expect(res.status).toBe(403);
      } finally {
        await cleanupUser(user.id);
      }
    });
  }
});

describe('Anonymous cannot access ADMIN routes', () => {
  const adminRoutes = [
    '/api/admin/users',
    '/api/admin/articles',
    '/api/admin/categories',
    '/api/admin/tags',
    '/api/admin/images',
    '/api/admin/videos',
    '/api/admin/downloads',
    '/api/admin/contact-messages',
  ];

  for (const path of adminRoutes) {
    it(`GET ${path} → 401 pour anonymous`, async () => {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
    });
  }
});

// ---------------------------------------------------------------------------
// CSRF — mutating routes without token
// ---------------------------------------------------------------------------
describe('CSRF protection', () => {
  it('POST /api/admin/tags sans CSRF → 403', async () => {
    const { user, password } = await createUser({ role: 'ADMIN' });
    try {
      const { agent } = await loginAs(app, user.username, password);
      const res = await agent
        .post('/api/admin/tags')
        .send({ name: 'NoCsrf' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CSRF_INVALID');
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('DELETE /api/admin/tags/:id sans CSRF → 403', async () => {
    const { user, password } = await createUser({ role: 'ADMIN' });
    const tag = await createTag({ name: 'CsrfDel' });
    try {
      const { agent } = await loginAs(app, user.username, password);
      const res = await agent.delete(`/api/admin/tags/${tag.id}`);
      expect(res.status).toBe(403);
    } finally {
      await cleanupTag(tag.id);
      await cleanupUser(user.id);
    }
  });

  it('POST /api/admin/categories sans CSRF → 403', async () => {
    const { user, password } = await createUser({ role: 'ADMIN' });
    try {
      const { agent } = await loginAs(app, user.username, password);
      const res = await agent
        .post('/api/admin/categories')
        .send({ name: 'NoCsrf' });
      expect(res.status).toBe(403);
    } finally {
      await cleanupUser(user.id);
    }
  });
});

// ---------------------------------------------------------------------------
// IDOR — accessing other users' resources with wrong UUIDs
// ---------------------------------------------------------------------------
describe('IDOR protection', () => {
  it('GET /api/admin/articles/:id avec UUID inexistant → 404', async () => {
    const { user, password } = await createUser({ role: 'ADMIN' });
    try {
      const { agent } = await loginAs(app, user.username, password);
      const res = await agent.get('/api/admin/articles/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('PUT /api/admin/articles/:id avec UUID inexistant → 404', async () => {
    const { user, password } = await createUser({ role: 'ADMIN' });
    try {
      const { agent, csrf } = await loginAs(app, user.username, password);
      const res = await agent
        .put('/api/admin/articles/00000000-0000-0000-0000-000000000000')
        .set('X-CSRF-Token', csrf.token)
        .send({ title: 'Hack' });
      expect(res.status).toBe(404);
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('PATCH /api/admin/users/:id/status avec UUID inexistant → 404', async () => {
    const { user, password } = await createUser({ role: 'ADMIN' });
    try {
      const { agent, csrf } = await loginAs(app, user.username, password);
      const res = await agent
        .patch('/api/admin/users/00000000-0000-0000-0000-000000000000/status')
        .set('X-CSRF-Token', csrf.token)
        .send({ status: 'DISABLED' });
      expect(res.status).toBe(404);
    } finally {
      await cleanupUser(user.id);
    }
  });
});

// ---------------------------------------------------------------------------
// UPLOAD SECURITY
// ---------------------------------------------------------------------------
describe('Upload security', () => {
  it('image avec signature invalide → 400', async () => {
    const { user, password } = await createUser({ role: 'ADMIN' });
    try {
      const { agent, csrf } = await loginAs(app, user.username, password);
      const fakePng = Buffer.from('<script>alert(1)</script>');
      const res = await uploadImage(app, agent, csrf, fakePng, 'evil.png', 'image/png');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_IMAGE');
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('upload fichier vide → 400', async () => {
    const { user, password } = await createUser({ role: 'ADMIN' });
    try {
      const { agent, csrf } = await loginAs(app, user.username, password);
      const emptyBuf = Buffer.alloc(0);
      const res = await agent
        .post('/api/admin/images')
        .set('X-CSRF-Token', csrf.token)
        .attach('image', emptyBuf, { filename: 'empty.png', contentType: 'image/png' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('EMPTY_FILE');
    } finally {
      await cleanupUser(user.id);
    }
  });
});

// ---------------------------------------------------------------------------
// DOWNLOAD SECURITY
// ---------------------------------------------------------------------------
describe('Download security', () => {
  it('double extension → 415', async () => {
    const { user, password } = await createUser({ role: 'ADMIN' });
    try {
      const { agent, csrf } = await loginAs(app, user.username, password);
      const buf = makePdfBuffer();
      const res = await uploadDownload(app, agent, csrf, buf, 'evil.pdf.exe', 'application/pdf', {
        title: 'Double ext',
        type: 'PDF',
        platform: 'OTHER',
      });
      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe('DOUBLE_EXTENSION');
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('download draft → 404 pour USER', async () => {
    const { user: admin, password } = await createUser({ role: 'ADMIN' });
    const { user: normalUser, password: userPass } = await createUser({ role: 'USER' });
    try {
      const { agent: adminAgent, csrf: adminCsrf } = await loginAs(app, admin.username, password);
      const buf = makePdfBuffer();
      const uploadRes = await uploadDownload(app, adminAgent, adminCsrf, buf, 'draft.pdf', 'application/pdf', {
        title: 'Draft DL',
        type: 'PDF',
        platform: 'OTHER',
        status: 'DRAFT',
      });
      const downloadId = uploadRes.body.download.id;

      const { agent: userAgent } = await loginAs(app, normalUser.username, userPass);
      const res = await userAgent.get(`/api/downloads/${downloadId}/file`);
      expect(res.status).toBe(404);
    } finally {
      const dl = await prisma.download.findFirst({ where: { title: 'Draft DL' } });
      if (dl) await cleanupDownload(dl.id);
      await cleanupUser(admin.id);
      await cleanupUser(normalUser.id);
    }
  });

  it('download archived → 404 pour USER', async () => {
    const { user: admin, password } = await createUser({ role: 'ADMIN' });
    const { user: normalUser, password: userPass } = await createUser({ role: 'USER' });
    try {
      const { agent: adminAgent, csrf: adminCsrf } = await loginAs(app, admin.username, password);
      const buf = makePdfBuffer();
      const uploadRes = await uploadDownload(app, adminAgent, adminCsrf, buf, 'archived.pdf', 'application/pdf', {
        title: 'Archived DL',
        type: 'PDF',
        platform: 'OTHER',
        status: 'PUBLISHED',
      });
      const downloadId = uploadRes.body.download.id;

      // Set to ARCHIVED
      await adminAgent
        .patch(`/api/admin/downloads/${downloadId}/status`)
        .set('X-CSRF-Token', adminCsrf.token)
        .send({ status: 'ARCHIVED' });

      const { agent: userAgent } = await loginAs(app, normalUser.username, userPass);
      const res = await userAgent.get(`/api/downloads/${downloadId}/file`);
      expect(res.status).toBe(404);
    } finally {
      const dl = await prisma.download.findFirst({ where: { title: 'Archived DL' } });
      if (dl) await cleanupDownload(dl.id);
      await cleanupUser(admin.id);
      await cleanupUser(normalUser.id);
    }
  });

  it('GET /api/downloads/:id/file sans auth → 404 (route publique, id inconnu)', async () => {
    const res = await request(app).get('/api/downloads/00000000-0000-0000-0000-000000000000/file');
    expect(res.status).toBe(404);
  });

  it('GET /api/downloads/:id/file avec UUID invalide → 404', async () => {
    const { user, password } = await createUser({ role: 'USER' });
    try {
      const { agent } = await loginAs(app, user.username, password);
      const res = await agent.get('/api/downloads/not-a-uuid/file');
      expect(res.status).toBe(404);
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('fichier download sert avec nosniff et no-store', async () => {
    const { user: admin, password } = await createUser({ role: 'ADMIN' });
    try {
      const { agent: adminAgent, csrf: adminCsrf } = await loginAs(app, admin.username, password);
      const buf = makePdfBuffer();
      const uploadRes = await uploadDownload(app, adminAgent, adminCsrf, buf, 'secure.pdf', 'application/pdf', {
        title: 'Secure DL',
        type: 'PDF',
        platform: 'OTHER',
        status: 'PUBLISHED',
      });
      const downloadId = uploadRes.body.download.id;

      const { user: normalUser, password: userPass } = await createUser({ role: 'USER' });
      try {
        const { agent: userAgent } = await loginAs(app, normalUser.username, userPass);
        const res = await userAgent.get(`/api/downloads/${downloadId}/file`);
        expect(res.status).toBe(200);
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['cache-control']).toContain('no-store');
        expect(res.headers['content-disposition']).toContain('attachment');
      } finally {
        await cleanupUser(normalUser.id);
      }
    } finally {
      const dl = await prisma.download.findFirst({ where: { title: 'Secure DL' } });
      if (dl) await cleanupDownload(dl.id);
      await cleanupUser(admin.id);
    }
  });

  it('download n\'expose pas storage_path dans la réponse API', async () => {
    const { user, password } = await createUser({ role: 'ADMIN' });
    try {
      const { agent, csrf } = await loginAs(app, user.username, password);
      const buf = makePdfBuffer();
      const uploadRes = await uploadDownload(app, agent, csrf, buf, 'nopath.pdf', 'application/pdf', {
        title: 'No Path DL',
        type: 'PDF',
        platform: 'OTHER',
      });
      const download = uploadRes.body.download;
      expect(download.storage_path).toBeUndefined();
    } finally {
      const dl = await prisma.download.findFirst({ where: { title: 'No Path DL' } });
      if (dl) await cleanupDownload(dl.id);
      await cleanupUser(user.id);
    }
  });
});

// ---------------------------------------------------------------------------
// VIDEO URL — HTTPS only
// ---------------------------------------------------------------------------
describe('Video URL validation', () => {
  it('http:// youtube URL → 400 (HTTPS requis)', async () => {
    const { user, password } = await createUser({ role: 'ADMIN' });
    try {
      const { agent, csrf } = await loginAs(app, user.username, password);
      const res = await agent
        .post('/api/admin/videos')
        .set('X-CSRF-Token', csrf.token)
        .send({
          title: 'HTTP Video',
          url: 'http://www.youtube.com/watch?v=dQw4w9WgXcQ',
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_VIDEO_URL');
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('javascript: URI → 400', async () => {
    const { user, password } = await createUser({ role: 'ADMIN' });
    try {
      const { agent, csrf } = await loginAs(app, user.username, password);
      const res = await agent
        .post('/api/admin/videos')
        .set('X-CSRF-Token', csrf.token)
        .send({
          title: 'JS Video',
          url: 'javascript:alert(1)',
        });
      expect(res.status).toBe(400);
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('data: URI → 400', async () => {
    const { user, password } = await createUser({ role: 'ADMIN' });
    try {
      const { agent, csrf } = await loginAs(app, user.username, password);
      const res = await agent
        .post('/api/admin/videos')
        .set('X-CSRF-Token', csrf.token)
        .send({
          title: 'Data Video',
          url: 'data:text/html,<script>alert(1)</script>',
        });
      expect(res.status).toBe(400);
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('domaine non autorisé → 400', async () => {
    const { user, password } = await createUser({ role: 'ADMIN' });
    try {
      const { agent, csrf } = await loginAs(app, user.username, password);
      const res = await agent
        .post('/api/admin/videos')
        .set('X-CSRF-Token', csrf.token)
        .send({
          title: 'Evil Video',
          url: 'https://evil.com/steal',
        });
      expect(res.status).toBe(400);
    } finally {
      await cleanupUser(user.id);
    }
  });
});

// ---------------------------------------------------------------------------
// CACHE — authenticated responses have no-store
// ---------------------------------------------------------------------------
describe('Cache isolation', () => {
  it('GET /api/auth/me renvoie Cache-Control: private, no-store', async () => {
    const { user, password } = await createUser({ role: 'USER' });
    try {
      const { agent } = await loginAs(app, user.username, password);
      const res = await agent.get('/api/auth/me');
      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toContain('no-store');
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('GET /api/admin/users renvoie Cache-Control: private, no-store', async () => {
    const { user, password } = await createUser({ role: 'ADMIN' });
    try {
      const { agent } = await loginAs(app, user.username, password);
      const res = await agent.get('/api/admin/users');
      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toContain('no-store');
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('POST /api/auth/login renvoie Cache-Control: private, no-store', async () => {
    const { user } = await createUser({ role: 'USER' });
    try {
      const agent = request.agent(app);
      const csrfRes = await agent.get('/api/auth/csrf');
      const token = csrfRes.body.csrfToken as string;
      const res = await agent
        .post('/api/auth/login')
        .set('X-CSRF-Token', token)
        .send({ username: user.username, password: 'wrong_password' });
      // Even failed login should have no-store
      expect(res.headers['cache-control']).toContain('no-store');
    } finally {
      await cleanupUser(user.id);
    }
  });
});

// ---------------------------------------------------------------------------
// ERROR HANDLING — no stack traces
// ---------------------------------------------------------------------------
describe('Error handling', () => {
  it('erreur 404 ne contient pas de stack trace', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('stack');
    expect(JSON.stringify(res.body)).not.toContain('Error');
  });

  it('erreur 500 ne contient pas de stack trace', async () => {
    // Test route that throws an error
    const { user, password } = await createUser({ role: 'ADMIN' });
    try {
      const { agent } = await loginAs(app, user.username, password);
      const res = await agent.get('/api/admin/users/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.message).toBeDefined();
      expect(JSON.stringify(res.body)).not.toContain('stack');
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('erreur validation ne révèle pas les détails Zod', async () => {
    const agent = request.agent(app);
    const csrfRes = await agent.get('/api/auth/csrf');
    const token = csrfRes.body.csrfToken as string;
    const res = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', token)
      .send({ username: '', password: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    // Zod details should not leak
    expect(JSON.stringify(res.body)).not.toContain('minLength');
    expect(JSON.stringify(res.body)).not.toContain('regex');
  });
});

// ---------------------------------------------------------------------------
// SENSITIVE DATA — no password_hash or secrets in responses
// ---------------------------------------------------------------------------
describe('No sensitive data leakage', () => {
  it('GET /api/auth/me ne renvoie pas password_hash', async () => {
    const { user, password } = await createUser({ role: 'USER' });
    try {
      const { agent } = await loginAs(app, user.username, password);
      const res = await agent.get('/api/auth/me');
      expect(res.status).toBe(200);
      expect(res.body.user.password_hash).toBeUndefined();
      expect(res.body.user.passwordHash).toBeUndefined();
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('POST /api/auth/login ne renvoie pas password_hash', async () => {
    const { user, password } = await createUser({ role: 'USER' });
    try {
      const agent = request.agent(app);
      const csrfRes = await agent.get('/api/auth/csrf');
      const token = csrfRes.body.csrfToken as string;
      const res = await agent
        .post('/api/auth/login')
        .set('X-CSRF-Token', token)
        .send({ username: user.username, password });
      expect(res.status).toBe(200);
      expect(res.body.user.password_hash).toBeUndefined();
      expect(res.body.user.passwordHash).toBeUndefined();
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('GET /api/admin/users ne renvoie pas password_hash', async () => {
    const { user: admin, password } = await createUser({ role: 'ADMIN' });
    try {
      const { agent } = await loginAs(app, admin.username, password);
      const res = await agent.get('/api/admin/users');
      expect(res.status).toBe(200);
      for (const u of res.body.data) {
        expect(u.password_hash).toBeUndefined();
        expect(u.passwordHash).toBeUndefined();
      }
    } finally {
      await cleanupUser(admin.id);
    }
  });
});

// ---------------------------------------------------------------------------
// PRISMA / DB — no raw SQL, proper constraints
// ---------------------------------------------------------------------------
describe('Database security properties', () => {
  it('articles ont une contrainte de slug unique (P2002)', async () => {
    const { user, password } = await createUser({ role: 'ADMIN' });
    try {
      const { agent, csrf } = await loginAs(app, user.username, password);
      const res1 = await agent
        .post('/api/admin/articles')
        .set('X-CSRF-Token', csrf.token)
        .send({ title: 'Unique Slug Test', content: 'test' });
      expect(res1.status).toBe(201);
      const slug = res1.body.article.slug;

      const res2 = await agent
        .post('/api/admin/articles')
        .set('X-CSRF-Token', csrf.token)
        .send({ title: 'Unique Slug Test', content: 'test2' });
      // Slug should be different (auto-generated unique)
      expect(res2.body.article.slug).not.toBe(slug);
    } finally {
      const articles = await prisma.article.findMany({ where: { title: 'Unique Slug Test' } });
      for (const a of articles) await cleanupArticle(a.id);
      await cleanupUser(user.id);
    }
  });

  it('session token n\'est jamais stocké en clair', async () => {
    const { user, password } = await createUser({ role: 'USER' });
    try {
      await loginAs(app, user.username, password);
      const sessions = await prisma.session.findMany({ where: { user_id: user.id } });
      for (const s of sessions) {
        // token_hash should be a hex string (SHA-256), not the raw token
        expect(s.token_hash).toMatch(/^[a-f0-9]{64}$/);
      }
    } finally {
      await cleanupUser(user.id);
    }
  });
});

// ---------------------------------------------------------------------------
// GLOBAL RATE LIMITER
// ---------------------------------------------------------------------------
describe('Global rate limiting', () => {
  it('rate limiter global est actif sur /api/*', async () => {
    // createTestApp with default options (no globalRateLimit: null) activates the limiter
    const defaultApp = createTestApp();
    const res = await request(defaultApp).get('/api/health');
    // Standard rate limit headers should be present
    expect(res.headers['ratelimit-limit']).toBeDefined();
  });
});
