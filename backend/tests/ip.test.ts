import type { Request } from 'express';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/db/client.ts';
import { resolveClientIp, resolveSourcePort, resolveUserAgent } from '../src/utils/ip.ts';
import { cleanupUser, createTestApp, createUser, fetchCsrf } from './helpers.ts';

function fakeRequest(partial: Partial<Request>): Request {
  return partial as unknown as Request;
}

describe('Resolution IP (resolveClientIp)', () => {
  it('utilise CF-Connecting-IP en priorite', () => {
    const req = fakeRequest({
      headers: { 'cf-connecting-ip': '203.0.113.42' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    });
    expect(resolveClientIp(req)).toBe('203.0.113.42');
  });

  it('ne lit jamais une IP depuis le body', () => {
    const req = fakeRequest({
      headers: {},
      body: { ip: '9.9.9.9' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    });
    expect(resolveClientIp(req)).toBe('127.0.0.1');
  });

  it('n honore X-Forwarded-For que via req.ip (chaîne de confiance Express)', () => {
    const req = fakeRequest({
      headers: { 'x-forwarded-for': '9.9.9.9' },
      ip: '127.0.0.1', // Express n attribue req.ip depuis XFF que si trust proxy
      socket: { remoteAddress: '127.0.0.1' },
    });
    expect(resolveClientIp(req)).toBe('127.0.0.1');
  });

  it('retombe sur le socket en acces direct', () => {
    const req = fakeRequest({
      headers: {},
      ip: undefined,
      socket: { remoteAddress: '::ffff:192.168.1.50' },
    });
    expect(resolveClientIp(req)).toBe('192.168.1.50');
  });

  it('ignore un CF-Connecting-IP invalide', () => {
    const req = fakeRequest({
      headers: { 'cf-connecting-ip': 'pas-une-ip' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    });
    expect(resolveClientIp(req)).toBe('127.0.0.1');
  });
});

describe('Port source (resolveSourcePort)', () => {
  it('capture le port du socket même derrière un tunnel (CF-Connecting-IP présent)', () => {
    const req = fakeRequest({
      headers: { 'cf-connecting-ip': '203.0.113.42' },
      socket: { remoteAddress: '127.0.0.1', remotePort: 12345 },
    });
    expect(resolveSourcePort(req)).toBe(12345);
  });

  it('capture le port du socket quand X-Forwarded-For est présent', () => {
    const req = fakeRequest({
      headers: { 'x-forwarded-for': '203.0.113.42' },
      socket: { remoteAddress: '127.0.0.1', remotePort: 12345 },
    });
    expect(resolveSourcePort(req)).toBe(12345);
  });

  it('source_port = port TCP réel en accès direct local', () => {
    const req = fakeRequest({
      headers: {},
      socket: { remoteAddress: '127.0.0.1', remotePort: 54321 },
    });
    expect(resolveSourcePort(req)).toBe(54321);
  });

  it('jamais de port inventé : NULL si aucun port réel disponible', () => {
    const req = fakeRequest({ headers: {} });
    expect(resolveSourcePort(req)).toBeNull();
  });
});

describe('User-Agent', () => {
  it('est tronque a une longueur raisonnable', () => {
    const req = fakeRequest({ headers: { 'user-agent': 'a'.repeat(5000) } });
    expect(resolveUserAgent(req).length).toBeLessThanOrEqual(500);
  });
});

describe('Intégration : IP et port enregistrés dans login_logs', () => {
  it('CF-Connecting-IP est enregistre (le port capte est celui du socket vu par l app)', async () => {
    const app = createTestApp();
    const { user } = await createUser();
    try {
      const agent = request.agent(app);
      const csrf = await fetchCsrf(app, agent);
      await agent
        .post('/api/auth/login')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.token)
        .set('CF-Connecting-IP', '203.0.113.99')
        .send({ username: user.username, password: 'mauvais-mdp' });

      const log = await prisma.loginLog.findFirst({
        where: { user_id: user.id, result: 'FAILURE' },
        orderBy: { created_at: 'desc' },
      });
      expect(log).not.toBeNull();
      expect(log!.ip).toBe('203.0.113.99');
      expect(typeof log!.source_port).toBe('number');
    } finally {
      await cleanupUser(user.id);
    }
  });

  it('une IP fournie dans le body est ignoree', async () => {
    const app = createTestApp();
    const { user } = await createUser();
    try {
      const agent = request.agent(app);
      const csrf = await fetchCsrf(app, agent);
      await agent
        .post('/api/auth/login')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.token)
        .send({ username: user.username, password: 'mauvais-mdp', ip: '6.6.6.6' });

      const log = await prisma.loginLog.findFirst({
        where: { user_id: user.id, result: 'FAILURE' },
        orderBy: { created_at: 'desc' },
      });
      expect(log).not.toBeNull();
      expect(log!.ip).not.toBe('6.6.6.6');
    } finally {
      await cleanupUser(user.id);
    }
  });
});
