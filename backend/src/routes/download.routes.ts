import { Router } from 'express';
import type { DownloadController } from '../controllers/download.controller.ts';
import { csrfProtect } from '../middleware/csrf.ts';
import { noStore } from '../middleware/noStore.ts';
import { requireAuth } from '../middleware/requireAuth.ts';
import { requireRole } from '../middleware/requireRole.ts';
import { handleUploadError, uploadSingleDownload } from '../middleware/upload.ts';

export interface DownloadRouterDeps {
  controller: DownloadController;
}

/**
 * Routes téléchargements :
 * - `/api/admin/downloads/*` : session valide + rôle ADMIN, mutations protégées CSRF ;
 * - `/api/admin/download-categories/*` : session valide + rôle ADMIN ;
 * - `/api/downloads` : liste des téléchargements publiés (utilisateur connecté) ;
 * - `/api/downloads/:id/file` : téléchargement du fichier (utilisateur connecté).
 */
export function createDownloadAdminRouter(deps: DownloadRouterDeps): Router {
  const router = Router();
  router.use(noStore);
  router.use(requireAuth, requireRole('ADMIN'));

  // Categories
  router.get('/download-categories', deps.controller.listDownloadCategories);
  router.post('/download-categories', csrfProtect, deps.controller.createDownloadCategory);
  router.put('/download-categories/:id', csrfProtect, deps.controller.updateDownloadCategory);
  router.delete('/download-categories/:id', csrfProtect, deps.controller.deleteDownloadCategory);

  // Downloads
  router.get('/downloads', deps.controller.listDownloads);
  router.post('/downloads', csrfProtect, uploadSingleDownload, handleUploadError, deps.controller.uploadDownload);
  router.get('/downloads/:id', deps.controller.getDownload);
  router.put('/downloads/:id', csrfProtect, deps.controller.updateDownload);
  router.patch('/downloads/:id/status', csrfProtect, deps.controller.setDownloadStatus);
  router.delete('/downloads/:id', csrfProtect, deps.controller.deleteDownload);
  router.post('/downloads/:id/file', csrfProtect, uploadSingleDownload, handleUploadError, deps.controller.replaceFile);

  return router;
}

export function createDownloadPublicRouter(deps: DownloadRouterDeps): Router {
  const router = Router();

  // Liste et fichiers de téléchargements : utilisateurs connectés uniquement.
  router.get('/downloads', requireAuth, deps.controller.listPublicDownloads);
  router.get('/downloads/:id/file', requireAuth, deps.controller.downloadFile);

  return router;
}
