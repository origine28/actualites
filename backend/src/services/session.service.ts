import { sessionRepository } from '../repositories/session.repository.ts';
import type { AuthSession, AuthUser } from '../types/auth.ts';
import { generateSecureToken, sha256Hex } from '../utils/crypto.ts';

export interface SessionCreationInfo {
  ip: string | null;
  userAgent: string | null;
}

export interface ValidSession {
  session: AuthSession;
  user: AuthUser;
}

/**
 * Sessions serveur : le token brut n'est JAMAIS stocké en base, seul son
 * hash SHA-256 l'est. L'expiration est glissante : chaque utilisation
 * prolonge la session tant que la moitié restante est écoulée.
 */
export const sessionService = {
  /** Générateur cryptographiquement sûr, 32 octets d'entropie. */
  generateToken(): string {
    return generateSecureToken(32);
  },

  async createSession(
    userId: string,
    token: string,
    info: SessionCreationInfo,
    ttlMs: number,
  ): Promise<AuthSession> {
    const created = await sessionRepository.create({
      user_id: userId,
      token_hash: sha256Hex(token),
      ip: info.ip,
      user_agent: info.userAgent,
      expires_at: new Date(Date.now() + ttlMs),
    });
    return {
      id: created.id,
      user_id: created.user_id,
      ip: created.ip,
      user_agent: created.user_agent,
      created_at: created.created_at,
      expires_at: created.expires_at,
      revoked_at: created.revoked_at,
    };
  },

  async findValidSession(token: string, ttlMs: number): Promise<ValidSession | null> {
    const found = await sessionRepository.findByTokenHash(sha256Hex(token));
    if (!found) return null;
    if (found.revoked_at !== null) return null;
    if (found.expires_at.getTime() <= Date.now()) return null;
    if (found.user.status !== 'ACTIVE' || found.user.deleted_at !== null) return null;

    const now = Date.now();
    const remaining = found.expires_at.getTime() - now;
    if (remaining < ttlMs / 2) {
      const newExpiry = new Date(now + ttlMs);
      await sessionRepository.extend(found.id, newExpiry);
      found.expires_at = newExpiry;
    }

    return {
      session: found,
      user: {
        id: found.user.id,
        username: found.user.username,
        email: found.user.email,
        role: found.user.role,
        status: found.user.status,
        first_name: found.user.first_name,
        last_name: found.user.last_name,
        last_login_at: found.user.last_login_at,
        created_at: found.user.created_at,
      },
    };
  },

  async revokeSession(sessionId: string): Promise<void> {
    await sessionRepository.revoke(sessionId);
  },

  async revokeAllUserSessions(userId: string): Promise<number> {
    const result = await sessionRepository.revokeAllForUser(userId);
    return result.count;
  },
};
