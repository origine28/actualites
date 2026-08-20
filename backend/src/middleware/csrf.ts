import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/errors.ts';
import { constantTimeEqual } from '../utils/crypto.ts';
import { parseSignedCsrf } from '../utils/csrf.ts';
import { CSRF_COOKIE_NAME } from '../utils/cookies.ts';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Protection CSRF (double-soumission signée) pour les mutations
 * (POST/PUT/PATCH/DELETE). Le token doit être envoyé dans l'en-tête
 * X-CSRF-Token et correspondre au jeton signé du cookie news.csrf.
 * Le token n'est JAMAIS accepté dans le body ni en paramètre d'URL.
 */
export function csrfProtect(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const cookieValue = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers['x-csrf-token'];

  if (typeof cookieValue !== 'string' || cookieValue.length === 0) {
    throw new ApiError(403, 'CSRF_INVALID', 'Jeton CSRF invalide');
  }
  if (typeof headerToken !== 'string' || headerToken.length === 0) {
    throw new ApiError(403, 'CSRF_INVALID', 'Jeton CSRF manquant');
  }

  const expectedToken = parseSignedCsrf(cookieValue);
  if (!expectedToken || !constantTimeEqual(expectedToken, headerToken)) {
    throw new ApiError(403, 'CSRF_INVALID', 'Jeton CSRF invalide');
  }

  next();
}
