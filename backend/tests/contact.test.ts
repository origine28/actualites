import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, type CreatedUser, createUser, cleanupUser, fetchCsrf, loginAs } from './helpers.ts';
import { prisma } from '../src/db/client.ts';

let app: ReturnType<typeof createTestApp>;
let admin: CreatedUser;
let user: CreatedUser;
let adminAgent: ReturnType<typeof import('supertest').agent>;
let adminCsrf: ReturnType<typeof fetchCsrf> extends Promise<infer R> ? R : never;
let userAgent: ReturnType<typeof import('supertest').agent>;
let userCsrf: ReturnType<typeof fetchCsrf> extends Promise<infer R> ? R : never;

beforeAll(async () => {
  app = createTestApp({ loginRateLimit: null });
  admin = await createUser({ role: 'ADMIN', username: `admin_contact_${Date.now()}` });
  user = await createUser({ role: 'USER', username: `user_contact_${Date.now()}` });

  const adminLogin = await loginAs(app, admin.user.username, admin.password);
  adminAgent = adminLogin.agent;
  adminCsrf = adminLogin.csrf;

  const userLogin = await loginAs(app, user.user.username, user.password);
  userAgent = userLogin.agent;
  userCsrf = userLogin.csrf;
});

afterAll(async () => {
  await cleanupUser(admin.user.id);
  await cleanupUser(user.user.id);
});

beforeEach(async () => {
  await prisma.contactMessage.deleteMany();
});

// ---------------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------------

describe('Contact — Authentification', () => {
  it('non connecte -> 401 sur POST /api/contact', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ name: 'Test', email: 'test@example.fr', subject: 'Sujet', message: 'Message de test long enough' });
    expect(res.status).toBe(401);
  });

  it('USER connecte -> 201 sur POST /api/contact', async () => {
    const res = await userAgent
      .post('/api/contact')
      .set('X-CSRF-Token', userCsrf.token)
      .send({ name: 'Jean', email: 'jean@example.fr', subject: 'Question', message: 'Bonjour, j\'ai une question sur le service.' });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Message envoye');
  });

  it('ADMIN connecte -> 201 sur POST /api/contact', async () => {
    const res = await adminAgent
      .post('/api/contact')
      .set('X-CSRF-Token', adminCsrf.token)
      .send({ name: 'Admin', email: 'admin@example.fr', subject: 'Test', message: 'Test envoi message depuis admin.' });
    expect(res.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// CSRF
// ---------------------------------------------------------------------------

describe('Contact — CSRF', () => {
  it('token absent -> 403', async () => {
    const res = await userAgent
      .post('/api/contact')
      .send({ name: 'Jean', email: 'jean@example.fr', subject: 'Sujet', message: 'Message de test suffisamment long.' });
    expect(res.status).toBe(403);
  });

  it('token invalide -> 403', async () => {
    const res = await userAgent
      .post('/api/contact')
      .set('X-CSRF-Token', 'invalid-token')
      .send({ name: 'Jean', email: 'jean@example.fr', subject: 'Sujet', message: 'Message de test suffisamment long.' });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// VALIDATION
// ---------------------------------------------------------------------------

describe('Contact — Validation', () => {
  it('name absent -> 400', async () => {
    const res = await userAgent
      .post('/api/contact')
      .set('X-CSRF-Token', userCsrf.token)
      .send({ email: 'jean@example.fr', subject: 'Sujet', message: 'Message suffisamment long pour etre accepte.' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('email absent -> 400', async () => {
    const res = await userAgent
      .post('/api/contact')
      .set('X-CSRF-Token', userCsrf.token)
      .send({ name: 'Jean', subject: 'Sujet', message: 'Message suffisamment long pour etre accepte.' });
    expect(res.status).toBe(400);
  });

  it('email invalide -> 400', async () => {
    const res = await userAgent
      .post('/api/contact')
      .set('X-CSRF-Token', userCsrf.token)
      .send({ name: 'Jean', email: 'pas-un-email', subject: 'Sujet', message: 'Message suffisamment long pour etre accepte.' });
    expect(res.status).toBe(400);
  });

  it('subject absent -> 400', async () => {
    const res = await userAgent
      .post('/api/contact')
      .set('X-CSRF-Token', userCsrf.token)
      .send({ name: 'Jean', email: 'jean@example.fr', message: 'Message suffisamment long pour etre accepte.' });
    expect(res.status).toBe(400);
  });

  it('message absent -> 400', async () => {
    const res = await userAgent
      .post('/api/contact')
      .set('X-CSRF-Token', userCsrf.token)
      .send({ name: 'Jean', email: 'jean@example.fr', subject: 'Sujet' });
    expect(res.status).toBe(400);
  });

  it('message trop court (< 10 chars) -> 400', async () => {
    const res = await userAgent
      .post('/api/contact')
      .set('X-CSRF-Token', userCsrf.token)
      .send({ name: 'Jean', email: 'jean@example.fr', subject: 'Sujet', message: 'Court' });
    expect(res.status).toBe(400);
  });

  it('payload incorrect -> 400', async () => {
    const res = await userAgent
      .post('/api/contact')
      .set('X-CSRF-Token', userCsrf.token)
      .send({ champ: 'inconnu' });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// DONNEES
// ---------------------------------------------------------------------------

describe('Contact — Donnees', () => {
  it('user_id recupere depuis la session, status = NEW, ip enregistree', async () => {
    const res = await userAgent
      .post('/api/contact')
      .set('X-CSRF-Token', userCsrf.token)
      .send({ name: 'Jean', email: 'jean@example.fr', subject: 'Question importante', message: 'Voici mon message detaille pour le support.' });
    expect(res.status).toBe(201);

    const msg = await prisma.contactMessage.findFirst({ where: { user_id: user.user.id } });
    expect(msg).toBeTruthy();
    expect(msg!.name).toBe('Jean');
    expect(msg!.email).toBe('jean@example.fr');
    expect(msg!.subject).toBe('Question importante');
    expect(msg!.status).toBe('NEW');
    expect(msg!.user_id).toBe(user.user.id);
    expect(msg!.ip).toBeTruthy();
    expect(msg!.created_at).toBeTruthy();
  });

  it('IP fournie dans body est ignoree', async () => {
    const res = await userAgent
      .post('/api/contact')
      .set('X-CSRF-Token', userCsrf.token)
      .send({ name: 'Jean', email: 'jean@example.fr', subject: 'Test', message: 'Test avec IP fournie dans le body.', ip: '1.2.3.4' });
    expect(res.status).toBe(201);

    const msg = await prisma.contactMessage.findFirst({ where: { user_id: user.user.id } });
    expect(msg).toBeTruthy();
    expect(msg!.ip).not.toBe('1.2.3.4');
  });

  it('user_id fourni dans body est ignore', async () => {
    const res = await userAgent
      .post('/api/contact')
      .set('X-CSRF-Token', userCsrf.token)
      .send({ name: 'Jean', email: 'jean@example.fr', subject: 'Test', message: 'Test avec user_id fourni dans le body.', user_id: admin.user.id });
    expect(res.status).toBe(201);

    const msg = await prisma.contactMessage.findFirst({ where: { user_id: user.user.id } });
    expect(msg).toBeTruthy();
    expect(msg!.user_id).toBe(user.user.id);
  });
});

// ---------------------------------------------------------------------------
// ADMIN
// ---------------------------------------------------------------------------

describe('Contact — Admin', () => {
  let messageId: string;

  beforeEach(async () => {
    const res = await userAgent
      .post('/api/contact')
      .set('X-CSRF-Token', userCsrf.token)
      .send({ name: 'Test User', email: 'test@example.fr', subject: 'Sujet test', message: 'Contenu du message de test pour admin.' });
    expect(res.status).toBe(201);
    const msg = await prisma.contactMessage.findFirst({ where: { user_id: user.user.id } });
    messageId = msg!.id;
  });

  it('USER -> GET /api/admin/contact-messages -> 403', async () => {
    const res = await userAgent.get('/api/admin/contact-messages');
    expect(res.status).toBe(403);
  });

  it('USER -> PATCH status -> 403', async () => {
    const res = await userAgent
      .patch(`/api/admin/contact-messages/${messageId}/status`)
      .set('X-CSRF-Token', userCsrf.token)
      .send({ status: 'READ' });
    expect(res.status).toBe(403);
  });

  it('ADMIN -> liste OK', async () => {
    const res = await adminAgent.get('/api/admin/contact-messages');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.pagination).toBeDefined();
  });

  it('ADMIN -> detail OK', async () => {
    const res = await adminAgent.get(`/api/admin/contact-messages/${messageId}`);
    expect(res.status).toBe(200);
    expect(res.body.message.subject).toBe('Sujet test');
    expect(res.body.message.user.username).toBe(user.user.username);
  });

  it('ADMIN -> changement de statut OK', async () => {
    const res = await adminAgent
      .patch(`/api/admin/contact-messages/${messageId}/status`)
      .set('X-CSRF-Token', adminCsrf.token)
      .send({ status: 'READ' });
    expect(res.status).toBe(200);
    expect(res.body.message.status).toBe('READ');
  });

  it('ID inconnu -> 404', async () => {
    const res = await adminAgent.get('/api/admin/contact-messages/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('ID malforme -> 404', async () => {
    const res = await adminAgent.get('/api/admin/contact-messages/invalid-id');
    expect(res.status).toBe(404);
  });

  it('suppression OK', async () => {
    const res = await adminAgent
      .delete(`/api/admin/contact-messages/${messageId}`)
      .set('X-CSRF-Token', adminCsrf.token);
    expect(res.status).toBe(204);

    const check = await adminAgent.get(`/api/admin/contact-messages/${messageId}`);
    expect(check.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PAGINATION / FILTRES
// ---------------------------------------------------------------------------

describe('Contact — Pagination et filtres', () => {
  beforeEach(async () => {
    for (let i = 0; i < 5; i++) {
      await userAgent
        .post('/api/contact')
        .set('X-CSRF-Token', userCsrf.token)
        .send({ name: `User ${i}`, email: `user${i}@example.fr`, subject: `Sujet ${i}`, message: `Message numero ${i} pour le test de pagination.` });
    }
  });

  it('pagination fonctionne', async () => {
    const res = await adminAgent.get('/api/admin/contact-messages?page=1&pageSize=2');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination.total).toBe(5);
    expect(res.body.pagination.totalPages).toBe(3);
  });

  it('filtre par statut fonctionne', async () => {
    const res = await adminAgent.get('/api/admin/contact-messages?status=NEW');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(5);
  });

  it('recherche fonctionne', async () => {
    const res = await adminAgent.get('/api/admin/contact-messages?search=User+2');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].name).toBe('User 2');
  });
});

// ---------------------------------------------------------------------------
// AUDIT
// ---------------------------------------------------------------------------

describe('Contact — Audit', () => {
  it('changement de statut enregistre un audit', async () => {
    const createRes = await userAgent
      .post('/api/contact')
      .set('X-CSRF-Token', userCsrf.token)
      .send({ name: 'Audit Test', email: 'audit@example.fr', subject: 'Audit', message: 'Test audit pour changement de statut.' });
    expect(createRes.status).toBe(201);

    const msg = await prisma.contactMessage.findFirst({ where: { user_id: user.user.id } });
    expect(msg).toBeTruthy();

    const statusRes = await adminAgent
      .patch(`/api/admin/contact-messages/${msg!.id}/status`)
      .set('X-CSRF-Token', adminCsrf.token)
      .send({ status: 'READ' });
    expect(statusRes.status).toBe(200);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'CONTACT_MESSAGE_READ', entity_id: msg!.id },
    });
    expect(audit).toBeTruthy();
    expect(audit!.user_id).toBe(admin.user.id);
  });
});

// ---------------------------------------------------------------------------
// CACHE
// ---------------------------------------------------------------------------

describe('Contact — Cache', () => {
  it('POST /api/contact -> no-store', async () => {
    const res = await userAgent
      .post('/api/contact')
      .set('X-CSRF-Token', userCsrf.token)
      .send({ name: 'Cache Test', email: 'cache@example.fr', subject: 'Cache', message: 'Test headers cache-control.' });
    expect(res.status).toBe(201);
    expect(res.headers['cache-control']).toContain('no-store');
  });

  it('GET /api/admin/contact-messages -> no-store', async () => {
    const res = await adminAgent.get('/api/admin/contact-messages');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('no-store');
  });
});
