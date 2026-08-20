import { env } from '../config/env.ts';
import { constantTimeEqual, generateSecureToken, hmacSha256 } from './crypto.ts';

export interface SignedCsrf {
  /** Jeton brut destiné à l'en-tête X-CSRF-Token. */
  token: string;
  /** Valeur du cookie news.csrf (jeton signé par HMAC avec CSRF_SECRET). */
  cookieValue: string;
}

/** Génère un jeton CSRF cryptographiquement aléatoire et le signe. */
export function createSignedCsrf(): SignedCsrf {
  const token = generateSecureToken(32);
  const signature = hmacSha256(env.CSRF_SECRET, token);
  return { token, cookieValue: `${token}.${signature}` };
}

/**
 * Vérifie la valeur signée du cookie news.csrf et retourne le jeton brut
 * attendu, ou null si la signature est invalide.
 */
export function parseSignedCsrf(cookieValue: string): string | null {
  const lastDot = cookieValue.lastIndexOf('.');
  if (lastDot <= 0) return null;
  const token = cookieValue.slice(0, lastDot);
  const signature = cookieValue.slice(lastDot + 1);
  const expected = hmacSha256(env.CSRF_SECRET, token);
  if (!constantTimeEqual(signature, expected)) return null;
  return token;
}
