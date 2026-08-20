import { Router } from 'express';
import type { AuthController } from '../controllers/auth.controller.ts';
import { csrfProtect } from '../middleware/csrf.ts';
import { noStore } from '../middleware/noStore.ts';
import { optionalAuth } from '../middleware/optionalAuth.ts';
import type { LoginRateLimiter } from '../middleware/rateLimit.ts';
import { requireAuth } from '../middleware/requireAuth.ts';

export interface AuthRouterDeps {
  controller: AuthController;
  loginRateLimiter: LoginRateLimiter;
}

export function createAuthRouter(deps: AuthRouterDeps): Router {
  const router = Router();

  // Aucune réponse authentifiée ne doit être mise en cache partagé.
  router.use(noStore);

  router.get('/csrf', deps.controller.csrfTokenHandler);
  router.post('/login', deps.loginRateLimiter, csrfProtect, deps.controller.loginHandler);
  // Logout idempotent : révoque la session si elle existe, supprime toujours
  // les cookies, renvoie toujours 204. Protégé CSRF.
  router.post('/logout', optionalAuth, csrfProtect, deps.controller.logoutHandler);
  router.get('/me', requireAuth, deps.controller.meHandler);

  return router;
}
