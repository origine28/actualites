import { describe, expect, it, vi } from 'vitest';
import { getDummyHash, hashPassword, verifyPassword } from '../src/services/password.service.ts';

describe('Argon2id (password.service)', () => {
  it('produit un hash different du mot de passe', async () => {
    const hashValue = await hashPassword('mon-super-mot-de-passe');
    expect(hashValue).not.toContain('mon-super-mot-de-passe');
    expect(hashValue).toMatch(/^\$argon2id\$/);
  });

  it('verifie un hash valide', async () => {
    const hashValue = await hashPassword('mon-super-mot-de-passe');
    expect(await verifyPassword('mon-super-mot-de-passe', hashValue)).toBe(true);
  });

  it('rejette un mauvais mot de passe', async () => {
    const hashValue = await hashPassword('mon-super-mot-de-passe');
    expect(await verifyPassword('mauvais-mot-de-passe', hashValue)).toBe(false);
  });

  it('produit deux hash differents pour un meme mot de passe (sel par hash)', async () => {
    const a = await hashPassword('mon-super-mot-de-passe');
    const b = await hashPassword('mon-super-mot-de-passe');
    expect(a).not.toBe(b);
    expect(await verifyPassword('mon-super-mot-de-passe', a)).toBe(true);
    expect(await verifyPassword('mon-super-mot-de-passe', b)).toBe(true);
  });

  it('rejette une valeur non Argon2id (pas de crash, retour false)', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
  });

  it('n ecrit aucun mot de passe dans les logs', async () => {
    const spyLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const spyError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const password = 'P@ssLogSecrete2026';
      const hashValue = await hashPassword(password);
      expect(await verifyPassword(password, hashValue)).toBe(true);
    } finally {
      spyLog.mockRestore();
      spyError.mockRestore();
    }
    const calls = [...spyLog.mock.calls, ...spyError.mock.calls]
      .map((c) => c.join(' '))
      .join('\n');
    expect(calls).not.toContain('P@ssLogSecrete2026');
  });

  it('fournit un hash de reference (dummy) pour l egalisation temporelle', async () => {
    const dummy = await getDummyHash();
    expect(dummy).toMatch(/^\$argon2id\$/);
    const again = await getDummyHash();
    expect(again).toBe(dummy);
  });
});
