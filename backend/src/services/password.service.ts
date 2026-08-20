import { hash, verify } from '@node-rs/argon2';
import { env } from '../config/env.ts';

const ARGON2_OPTIONS = {
  memoryCost: env.ARGON2_MEMORY_COST,
  timeCost: env.ARGON2_TIME_COST,
  parallelism: env.ARGON2_PARALLELISM,
};

/** Hash Argon2id d'un mot de passe (jamais stocké en clair). */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(password: string, hashValue: string): Promise<boolean> {
  try {
    return await verify(hashValue, password);
  } catch {
    return false;
  }
}

let dummyHashPromise: Promise<string> | null = null;

/**
 * Hash de référence utilisé pour égaliser le temps de réponse entre un compte
 * inexistant, un mauvais mot de passe et un compte désactivé (anti-énumération
 * par timing). Aucune information n'est tirée du résultat.
 */
export function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword('dummy-timing-equalizer');
  return dummyHashPromise;
}
