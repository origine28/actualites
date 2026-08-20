import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Générateur cryptographiquement sûr de token (entropie suffisante). */
export function generateSecureToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url');
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hmacSha256(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
