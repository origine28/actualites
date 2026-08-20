import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../generated/prisma/enums.ts';
import { ApiError } from '../utils/errors.ts';

/**
 * Restriction par rôle. Doit être utilisé APRÈS requireAuth (le contexte
 * d'authentification provient de la session serveur, jamais du frontend).
 * Un USER appelant une route ADMIN reçoit 403 Forbidden.
 */
export function requireRole(role: Role) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      throw new ApiError(500, 'AUTH_CONTEXT_MISSING', 'requireRole doit etre utilise apres requireAuth');
    }
    if (req.auth.user.role !== role) {
      throw new ApiError(403, 'FORBIDDEN', 'Acces refuse');
    }
    next();
  };
}
