import type { NextFunction, Request, Response } from 'express';
import { sessionService } from '../services/session.service.ts';
import { SESSION_COOKIE_NAME } from '../utils/cookies.ts';

/**
 * Authentification optionnelle : positionne req.auth si un cookie de session
 * valide est présent, sans jamais échouer. Utilisé par logout pour rester
 * idempotent (204 même si la session est déjà invalide), la protection CSRF
 * restant active.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const rawToken = req.cookies?.[SESSION_COOKIE_NAME];
  if (typeof rawToken === 'string' && rawToken.length > 0) {
    const ttlMs = (req.app.get('sessionTtlMs') as number | undefined) ?? 24 * 3600 * 1000;
    const found = await sessionService.findValidSession(rawToken, ttlMs);
    if (found) {
      req.auth = { user: found.user, session: found.session };
    }
  }
  next();
}
