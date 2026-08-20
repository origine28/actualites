import { Router } from 'express';
import type { MediaController } from '../controllers/media.controller.ts';
import { csrfProtect } from '../middleware/csrf.ts';
import { noStore } from '../middleware/noStore.ts';
import { requireAuth } from '../middleware/requireAuth.ts';
import { requireRole } from '../middleware/requireRole.ts';
import { handleUploadError, uploadSingleImage } from '../middleware/upload.ts';

export interface MediaRouterDeps {
  controller: MediaController;
}

/**
 * Routes média :
 * - `/api/admin/*` : session valide + rôle ADMIN, mutations protégées CSRF ;
 * - `/api/images/:id` : lecture du fichier image, toute session valide
 *   (l'URL de l'image n'est jamais le chemin disque) ;
 * - `/api/videos` : lecture publique des vidéos publiées.
 */
export function createMediaAdminRouter(deps: MediaRouterDeps): Router {
  const router = Router();
  router.use(noStore);
  router.use(requireAuth, requireRole('ADMIN'));

  // Images
  router.get('/images', deps.controller.listImages);
  router.post('/images', csrfProtect, uploadSingleImage, handleUploadError, deps.controller.uploadImage);
  router.get('/images/:id', deps.controller.getImage);
  router.patch('/images/:id', csrfProtect, deps.controller.updateImageAlt);
  router.delete('/images/:id', csrfProtect, deps.controller.deleteImage);

  // Galerie d'articles
  router.get('/articles/:id/images', deps.controller.getArticleGallery);
  router.post('/articles/:id/images', csrfProtect, deps.controller.attachArticleImages);
  router.put('/articles/:id/images/order', csrfProtect, deps.controller.reorderArticleImages);
  router.delete('/articles/:id/images/:imageId', csrfProtect, deps.controller.detachArticleImage);
  router.put('/articles/:id/featured-image', csrfProtect, deps.controller.setArticleFeatured);

  // Vidéos
  router.get('/videos', deps.controller.listVideos);
  router.post('/videos', csrfProtect, deps.controller.createVideo);
  router.get('/videos/:id', deps.controller.getVideo);
  router.put('/videos/:id', csrfProtect, deps.controller.updateVideo);
  router.patch('/videos/:id/status', csrfProtect, deps.controller.setVideoStatus);
  router.delete('/videos/:id', csrfProtect, deps.controller.deleteVideo);

  return router;
}

export function createMediaPublicRouter(deps: MediaRouterDeps): Router {
  const router = Router();

  // Lecture image : toute session valide (USER comme ADMIN).
  router.get('/images/:id', requireAuth, deps.controller.readImageFile);

  // Vidéos publiques : lecture seule, aucun cookie requis.
  router.get('/videos', deps.controller.listPublicVideos);
  router.get('/videos/:id', deps.controller.getPublicVideo);

  return router;
}
