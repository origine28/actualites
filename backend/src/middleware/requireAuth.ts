import type { NextFunction, Request, Response } from 'express';
import { sessionService } from '../services/session.service.ts';
import { ApiError } from '../utils/errors.ts';
import { SESSION_COOKIE_NAME } from '../utils/cookies.ts';

/**
 * Authentification obligatoire. L'identité provient UNIQUEMENT de la session
 * serveur (cookie news.sid) : jamais d'un champ body/query/header arbitraire.
 *
 * Cookie → SHA-256 → recherche session → revoked ? → expirée ? → user ACTIVE ?
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const rawToken = req.cookies?.[SESSION_COOKIE_NAME];
  if (typeof rawToken !== 'string' || rawToken.length === 0) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Authentification requise');
  }

  const ttlMs = (req.app.get('sessionTtlMs') as number | undefined) ?? 24 * 3600 * 1000;
  const found = await sessionService.findValidSession(rawToken, ttlMs);
  if (!found) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Session invalide ou expiree');
  }

  req.auth = { user: found.user, session: found.session };
  next();
}
