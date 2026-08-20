import { Router } from 'express';
import type { ContactController } from '../controllers/contact.controller.ts';
import { csrfProtect } from '../middleware/csrf.ts';
import { noStore } from '../middleware/noStore.ts';
import { requireAuth } from '../middleware/requireAuth.ts';
import { requireRole } from '../middleware/requireRole.ts';

export interface ContactRouterDeps {
  controller: ContactController;
  contactRateLimiter?: ReturnType<typeof import('../middleware/rateLimit.ts').createContactRateLimiter>;
}

export function createContactPublicRouter(deps: ContactRouterDeps): Router {
  const router = Router();

  router.use(noStore);

  if (deps.contactRateLimiter) {
    router.post('/contact', requireAuth, csrfProtect, deps.contactRateLimiter, deps.controller.sendMessage);
  } else {
    router.post('/contact', requireAuth, csrfProtect, deps.controller.sendMessage);
  }

  return router;
}

export function createContactAdminRouter(deps: ContactRouterDeps): Router {
  const router = Router();

  router.use(noStore);
  router.use(requireAuth, requireRole('ADMIN'));

  router.get('/contact-messages', deps.controller.listMessages);
  router.get('/contact-messages/:id', deps.controller.getMessage);
  router.patch('/contact-messages/:id/status', csrfProtect, deps.controller.setStatus);
  router.delete('/contact-messages/:id', csrfProtect, deps.controller.deleteMessage);

  return router;
}
