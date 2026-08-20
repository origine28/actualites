import type { Request, Response } from 'express';
import type { z } from 'zod';
import type { ImageService } from '../services/image.service.ts';
import type { VideoService } from '../services/video.service.ts';
import { ApiError } from '../utils/errors.ts';
import { idParamSchema } from '../validators/user.validators.ts';
import {
  attachImagesSchema,
  createVideoSchema,
  featuredImageSchema,
  imageIdParamSchema,
  imageQuerySchema,
  imageVariantQuerySchema,
  publicVideoQuerySchema,
  reorderImagesSchema,
  updateImageAltSchema,
  updateVideoSchema,
  videoQuerySchema,
  videoStatusTransitionSchema,
} from '../validators/media.validators.ts';

export interface MediaControllerConfig {
  imageService: ImageService;
  videoService: VideoService;
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Requete invalide');
  }
  return parsed.data;
}

function requireActor(req: Request) {
  if (!req.auth) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Authentification requise');
  }
  return req.auth.user;
}

function requireId(req: Request): string {
  const parsed = idParamSchema.safeParse(req.params.id);
  if (!parsed.success) {
    throw new ApiError(404, 'NOT_FOUND', 'Ressource introuvable');
  }
  return parsed.data;
}

function clientInfo(req: Request) {
  return req.clientInfo ?? { ip: 'unknown', sourcePort: null, userAgent: '' };
}

export function createMediaController(cfg: MediaControllerConfig) {
  // -------------------------------------------------------------------------
  // Images (ADMIN)
  // -------------------------------------------------------------------------
  async function uploadImage(req: Request, res: Response): Promise<void> {
    const image = await cfg.imageService.upload(
      { admin: requireActor(req), clientInfo: clientInfo(req) },
      req.file,
    );
    res.status(201).json({ image });
  }

  async function listImages(req: Request, res: Response): Promise<void> {
    const query = parse(imageQuerySchema, req.query);
    res.json(await cfg.imageService.list(query));
  }

  async function getImage(req: Request, res: Response): Promise<void> {
    const id = requireId(req);
    const image = await cfg.imageService.get(id);
    res.json({ image });
  }

  async function updateImageAlt(req: Request, res: Response): Promise<void> {
    const id = requireId(req);
    const data = parse(updateImageAltSchema, req.body);
    const image = await cfg.imageService.updateAlt(
      { admin: requireActor(req), clientInfo: clientInfo(req) },
      id,
      data,
    );
    res.json({ image });
  }

  async function deleteImage(req: Request, res: Response): Promise<void> {
    const id = requireId(req);
    await cfg.imageService.remove(
      { admin: requireActor(req), clientInfo: clientInfo(req) },
      id,
    );
    res.status(204).end();
  }

  /** Lecture du fichier image (original ou variante), streaming contrôlé. */
  async function readImageFile(req: Request, res: Response): Promise<void> {
    const id = requireId(req);
    const { variant } = parse(imageVariantQuerySchema, req.query);
    const result = await cfg.imageService.readStream(id, variant);
    if (!result) {
      throw new ApiError(404, 'IMAGE_NOT_FOUND', 'Image introuvable');
    }
    res.set({
      'Content-Type': result.mimeType,
      'Content-Length': String(Math.max(result.sizeBytes, 0)),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
    result.stream.on('error', () => res.destroy());
    result.stream.pipe(res);
  }

  // -------------------------------------------------------------------------
  // Galerie des articles (ADMIN)
  // -------------------------------------------------------------------------
  async function getArticleGallery(req: Request, res: Response): Promise<void> {
    const articleId = requireId(req);
    const images = await cfg.imageService.articleGallery(articleId);
    res.json({ images });
  }

  async function attachArticleImages(req: Request, res: Response): Promise<void> {
    const articleId = requireId(req);
    const data = parse(attachImagesSchema, req.body);
    const images = await cfg.imageService.attachToArticle(
      { admin: requireActor(req), clientInfo: clientInfo(req) },
      articleId,
      data,
    );
    res.status(201).json({ images });
  }

  async function detachArticleImage(req: Request, res: Response): Promise<void> {
    const articleId = requireId(req);
    const imageId = parse(imageIdParamSchema, req.params.imageId);
    const images = await cfg.imageService.detachFromArticle(
      { admin: requireActor(req), clientInfo: clientInfo(req) },
      articleId,
      imageId,
    );
    res.json({ images });
  }

  async function reorderArticleImages(req: Request, res: Response): Promise<void> {
    const articleId = requireId(req);
    const data = parse(reorderImagesSchema, req.body);
    const images = await cfg.imageService.reorderArticleImages(
      { admin: requireActor(req), clientInfo: clientInfo(req) },
      articleId,
      data,
    );
    res.json({ images });
  }

  async function setArticleFeatured(req: Request, res: Response): Promise<void> {
    const articleId = requireId(req);
    const { image_id } = parse(featuredImageSchema, req.body);
    const result = await cfg.imageService.setArticleFeatured(
      { admin: requireActor(req), clientInfo: clientInfo(req) },
      articleId,
      image_id,
    );
    res.json(result);
  }

  // -------------------------------------------------------------------------
  // Vidéos (ADMIN)
  // -------------------------------------------------------------------------
  async function createVideo(req: Request, res: Response): Promise<void> {
    const data = parse(createVideoSchema, req.body);
    const video = await cfg.videoService.create(
      { admin: requireActor(req), clientInfo: clientInfo(req) },
      data,
    );
    res.status(201).json({ video });
  }

  async function listVideos(req: Request, res: Response): Promise<void> {
    const query = parse(videoQuerySchema, req.query);
    res.json(await cfg.videoService.listAdmin(query));
  }

  async function getVideo(req: Request, res: Response): Promise<void> {
    const id = requireId(req);
    const video = await cfg.videoService.getAdminVideo(id);
    res.json({ video });
  }

  async function updateVideo(req: Request, res: Response): Promise<void> {
    const id = requireId(req);
    const data = parse(updateVideoSchema, req.body);
    const video = await cfg.videoService.update(
      { admin: requireActor(req), clientInfo: clientInfo(req) },
      id,
      data,
    );
    res.json({ video });
  }

  async function setVideoStatus(req: Request, res: Response): Promise<void> {
    const id = requireId(req);
    const { status } = parse(videoStatusTransitionSchema, req.body);
    const video = await cfg.videoService.setStatus(
      { admin: requireActor(req), clientInfo: clientInfo(req) },
      id,
      status,
    );
    res.json({ video });
  }

  async function deleteVideo(req: Request, res: Response): Promise<void> {
    const id = requireId(req);
    await cfg.videoService.remove(
      { admin: requireActor(req), clientInfo: clientInfo(req) },
      id,
    );
    res.status(204).end();
  }

  // -------------------------------------------------------------------------
  // Vidéos (public)
  // -------------------------------------------------------------------------
  async function listPublicVideos(req: Request, res: Response): Promise<void> {
    const query = parse(publicVideoQuerySchema, req.query);
    res.json(await cfg.videoService.listPublic(query));
  }

  async function getPublicVideo(req: Request, res: Response): Promise<void> {
    const id = requireId(req);
    const video = await cfg.videoService.getPublicVideo(id);
    res.json({ video });
  }

  return {
    uploadImage,
    listImages,
    getImage,
    updateImageAlt,
    deleteImage,
    readImageFile,
    getArticleGallery,
    attachArticleImages,
    detachArticleImage,
    reorderArticleImages,
    setArticleFeatured,
    createVideo,
    listVideos,
    getVideo,
    updateVideo,
    setVideoStatus,
    deleteVideo,
    listPublicVideos,
    getPublicVideo,
  };
}

export type MediaController = ReturnType<typeof createMediaController>;
