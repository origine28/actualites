import { Router } from 'express';
import type { ContentController } from '../controllers/content.controller.ts';
import { csrfProtect } from '../middleware/csrf.ts';
import { noStore } from '../middleware/noStore.ts';
import { requireAuth } from '../middleware/requireAuth.ts';
import { requireRole } from '../middleware/requireRole.ts';

export interface ContentRouterDeps {
  controller: ContentController;
}

/**
 * Routes de contenu :
 * - `/api/admin/*` : session valide + rôle ADMIN, mutations protégées CSRF ;
 * - `/api/categories/tree`, `/api/articles` : lecture publique (aucune session).
 */
export function createContentRouter(deps: ContentRouterDeps): Router {
  const router = Router();

  // --- Back-office (ADMIN) -------------------------------------------------
  const adminRouter = Router();
  adminRouter.use(noStore);
  adminRouter.use(requireAuth, requireRole('ADMIN'));

  adminRouter.get('/categories', deps.controller.listCategories);
  adminRouter.post('/categories', csrfProtect, deps.controller.createCategory);
  adminRouter.put('/categories/:id', csrfProtect, deps.controller.updateCategory);
  adminRouter.delete('/categories/:id', csrfProtect, deps.controller.deleteCategory);

  adminRouter.get('/tags', deps.controller.listTags);
  adminRouter.post('/tags', csrfProtect, deps.controller.createTag);
  adminRouter.delete('/tags/:id', csrfProtect, deps.controller.deleteTag);

  adminRouter.get('/articles', deps.controller.listAdminArticles);
  adminRouter.get('/articles/:id', deps.controller.getAdminArticle);
  adminRouter.post('/articles', csrfProtect, deps.controller.createArticle);
  adminRouter.put('/articles/:id', csrfProtect, deps.controller.updateArticle);
  adminRouter.patch('/articles/:id/status', csrfProtect, deps.controller.setArticleStatus);
  adminRouter.delete('/articles/:id', csrfProtect, deps.controller.deleteArticle);

  router.use('/admin', adminRouter);

  // --- Site public ---------------------------------------------------------
  router.get('/categories/tree', deps.controller.listCategoryTree);
  router.get('/articles', deps.controller.listPublicArticles);
  router.get('/articles/:slug', deps.controller.getPublicArticle);

  return router;
}
