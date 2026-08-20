import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client.ts';
import { sessionService } from '../src/services/session.service.ts';
import { cleanupUser, createUser } from './helpers.ts';

const TTL_MS = 24 * 3600 * 1000;

function hashHex(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

describe('Session (session.service)', () => {
  it('cree une session et ne stocke jamais le token en clair', async () => {
    const { user } = await createUser();
    try {
      const token = sessionService.generateToken();
      const session = await sessionService.createSession(
        user.id,
        token,
        { ip: '127.0.0.1', userAgent: 'test-agent' },
        TTL_MS,
      );

      const row = await prisma.session.findUnique({ where: { id: session.id } });
      expect(row).not.toBeNull();
      expect(row!.token_hash).not.toBe(token);
      expect(row!.token_hash).toBe(hashHex(token));
      expect(row!.expires_at.getTime()).toBeGreaterThan(Date.now());
    } finally {
      await prisma.session.deleteMany({ where: { user_id: user.id } });
      await cleanupUser(user.id);
    }
  });

  it('reconnait un token valide et charge le user', async () => {
    const { user } = await createUser();
    try {
      const token = sessionService.generateToken();
      const session = await sessionService.createSession(user.id, token, { ip: null, userAgent: null }, TTL_MS);

      const valid = await sessionService.findValidSession(token, TTL_MS);
      expect(valid).not.toBeNull();
      expect(valid!.session.id).toBe(session.id);
      expect(valid!.user.id).toBe(user.id);
      expect(valid!.user.username).toBe(user.username);
    } finally {
      await prisma.session.deleteMany({ where: { user_id: user.id } });
      await cleanupUser(user.id);
    }
  });

  it('rejette un token invalide', async () => {
    const valid = await sessionService.findValidSession('token-inconnu', TTL_MS);
    expect(valid).toBeNull();
  });

  it('rejette une session expiree', async () => {
    const { user } = await createUser();
    try {
      const token = sessionService.generateToken();
      await sessionService.createSession(user.id, token, { ip: null, userAgent: null }, -1000);
      expect(await sessionService.findValidSession(token, TTL_MS)).toBeNull();
    } finally {
      await prisma.session.deleteMany({ where: { user_id: user.id } });
      await cleanupUser(user.id);
    }
  });

  it('rejette une session revoquee', async () => {
    const { user } = await createUser();
    try {
      const token = sessionService.generateToken();
      const session = await sessionService.createSession(user.id, token, { ip: null, userAgent: null }, TTL_MS);
      await sessionService.revokeSession(session.id);
      expect(await sessionService.findValidSession(token, TTL_MS)).toBeNull();
    } finally {
      await prisma.session.deleteMany({ where: { user_id: user.id } });
      await cleanupUser(user.id);
    }
  });

  it('rejette un utilisateur desactive', async () => {
    const { user } = await createUser();
    try {
      await prisma.user.update({ where: { id: user.id }, data: { status: 'DISABLED' } });
      const token = sessionService.generateToken();
      await sessionService.createSession(user.id, token, { ip: null, userAgent: null }, TTL_MS);
      expect(await sessionService.findValidSession(token, TTL_MS)).toBeNull();
    } finally {
      await prisma.session.deleteMany({ where: { user_id: user.id } });
      await cleanupUser(user.id);
    }
  });

  it('revoque globalement toutes les sessions d un utilisateur', async () => {
    const { user } = await createUser();
    try {
      const tokenA = sessionService.generateToken();
      const tokenB = sessionService.generateToken();
      await sessionService.createSession(user.id, tokenA, { ip: null, userAgent: null }, TTL_MS);
      await sessionService.createSession(user.id, tokenB, { ip: null, userAgent: null }, TTL_MS);

      const count = await sessionService.revokeAllUserSessions(user.id);
      expect(count).toBe(2);
      expect(await sessionService.findValidSession(tokenA, TTL_MS)).toBeNull();
      expect(await sessionService.findValidSession(tokenB, TTL_MS)).toBeNull();
    } finally {
      await prisma.session.deleteMany({ where: { user_id: user.id } });
      await cleanupUser(user.id);
    }
  });
});
