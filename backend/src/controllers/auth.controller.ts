import type { Request, Response } from 'express';
import { z } from 'zod';
import type { AuthService } from '../services/auth.service.ts';
import { clearSessionCookie, setCsrfCookie, setSessionCookie } from '../utils/cookies.ts';
import { createSignedCsrf } from '../utils/csrf.ts';
import { ApiError } from '../utils/errors.ts';
import { toPublicUser } from '../utils/userView.ts';

const loginSchema = z.object({
  username: z.string().trim().min(1, 'username requis').max(64),
  password: z.string().min(1, 'mot de passe requis').max(128),
});

export interface AuthControllerConfig {
  authService: AuthService;
  sessionTtlMs: number;
  cookieSecure: boolean;
}

export function createAuthController(cfg: AuthControllerConfig) {
  function clientInfo(req: Request) {
    return req.clientInfo ?? { ip: 'unknown', sourcePort: null, userAgent: '' };
  }

  /** Émet/jette le cookie CSRF (token signé) que le frontend lira pour les mutations. */
  function csrfTokenHandler(_req: Request, res: Response): void {
    const { token, cookieValue } = createSignedCsrf();
    setCsrfCookie(res, cookieValue, cfg.cookieSecure, cfg.sessionTtlMs);
    res.json({ csrfToken: token });
  }

  async function loginHandler(req: Request, res: Response): Promise<void> {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Requete invalide' } });
      return;
    }

    const outcome = await cfg.authService.login({
      username: parsed.data.username,
      password: parsed.data.password,
      clientInfo: clientInfo(req),
    });

    if (!outcome.ok) {
      const message =
        outcome.code === 'ACCOUNT_LOCKED'
          ? 'Trop de tentatives echouees. Reessayez plus tard.'
          : outcome.code === 'ACCOUNT_DISABLED'
            ? 'Authentification impossible'
            : 'Identifiants invalides';
      res.status(401).json({ error: { code: outcome.code, message } });
      return;
    }

    setSessionCookie(res, outcome.sessionToken, cfg.cookieSecure, cfg.sessionTtlMs);
    res.status(200).json({ user: toPublicUser(outcome.user) });
  }

  async function logoutHandler(req: Request, res: Response): Promise<void> {
    if (req.auth) {
      await cfg.authService.logout({
        sessionId: req.auth.session.id,
        user: req.auth.user,
        clientInfo: clientInfo(req),
      });
    }
    clearSessionCookie(res, cfg.cookieSecure);
    // Le cookie CSRF (jeton signé, non lié à la session) est conservé pour
    // permettre un logout idempotent et le prochain login sans re-fetch.
    res.status(204).end();
  }

  function meHandler(req: Request, res: Response): void {
    if (!req.auth) {
      throw new ApiError(401, 'AUTH_REQUIRED', 'Authentification requise');
    }
    res.json({ user: toPublicUser(req.auth.user) });
  }

  return { csrfTokenHandler, loginHandler, logoutHandler, meHandler };
}

export type AuthController = ReturnType<typeof createAuthController>;
