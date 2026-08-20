import { Router } from 'express';
import type { AdminController } from '../controllers/admin.controller.ts';
import { csrfProtect } from '../middleware/csrf.ts';
import { noStore } from '../middleware/noStore.ts';
import { requireAuth } from '../middleware/requireAuth.ts';
import { requireRole } from '../middleware/requireRole.ts';

export interface AdminRouterDeps {
  controller: AdminController;
}

/**
 * Routes d'administration : session valide + rôle ADMIN obligatoires.
 * La protection CSRF (double-soumission signée) s'applique à toutes les
 * mutations ; les lectures ne sont jamais mises en cache partagé.
 */
export function createAdminRouter(deps: AdminRouterDeps): Router {
  const router = Router();

  router.use(noStore);
  router.use(requireAuth, requireRole('ADMIN'));

  router.get('/users', deps.controller.listUsers);
  router.post('/users', csrfProtect, deps.controller.createUser);
  router.put('/users/:id', csrfProtect, deps.controller.updateUser);
  router.patch('/users/:id/status', csrfProtect, deps.controller.setStatus);
  router.post('/users/:id/reset-password', csrfProtect, deps.controller.resetPassword);
  router.get('/users/:id/login-history', deps.controller.getUserLoginHistory);
  router.get('/login-history', deps.controller.getGlobalLoginHistory);

  return router;
}
