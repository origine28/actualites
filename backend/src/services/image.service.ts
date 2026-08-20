import { randomUUID } from 'node:crypto';
import { statSync } from 'node:fs';
import { prisma } from '../db/client.ts';
import { imageRepository } from '../repositories/image.repository.ts';
import { articleRepository } from '../repositories/article.repository.ts';
import { storageService } from '../storage/index.ts';
import type { ActorContext } from '../types/content.ts';
import { env } from '../config/env.ts';
import { ApiError } from '../utils/errors.ts';
import {
  assertSafeClientName,
  buildImageVariants,
  IMAGE_EXTENSIONS,
  IMAGE_MIME_TYPES,
  sha256Buffer,
  sniffImageType,
  type VariantName,
} from '../utils/image.ts';
import { toGalleryItemView, toImageView, type GalleryItemView, type ImageView } from '../utils/mediaView.ts';
import { pagination } from '../utils/pagination.ts';
import type {
  AttachImagesInput,
  ImageQuery,
  ReorderImagesInput,
  UpdateImageAltInput,
} from '../validators/media.validators.ts';
import { auditService } from './audit.service.ts';

function isImageMime(value: string): value is (typeof IMAGE_MIME_TYPES)[number] {
  return (IMAGE_MIME_TYPES as readonly string[]).includes(value);
}

/** Extrait la clé de variante stockée dans le JSON `variants` (clés vérifiées). */
function variantKey(image: { variants: unknown }, name: VariantName): string | null {
  if (!image.variants || typeof image.variants !== 'object') return null;
  const value = (image.variants as Record<string, unknown>)[name];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Règles de gestion des images :
 * - le type réel est détecté par signature binaire (magic bytes), jamais par l'extension ;
 * - le fichier est ré-encodé via sharp (orientation EXIF appliquée, payloads neutralisés) ;
 * - des variantes thumb/medium/large (webp) sont générées et servies par URL contrôlée ;
 * - les chemins disque ne sont JAMAIS exposés : le client ne reçoit que /api/images/:id ;
 * - la suppression est refusée tant que l'image est référencée (featured, galerie, miniature) ;
 * - chaque upload/mutation/suppression produit un audit log.
 */
export const imageService = {
  async upload(ctx: ActorContext, file: Express.Multer.File | undefined): Promise<ImageView> {
    if (!file) {
      throw new ApiError(400, 'NO_FILE', 'Aucun fichier joint');
    }
    if (!file.buffer || file.buffer.length === 0) {
      throw new ApiError(400, 'EMPTY_FILE', 'Fichier vide');
    }
    if (file.size > env.MAX_IMAGE_SIZE) {
      throw new ApiError(413, 'IMAGE_TOO_LARGE', 'Fichier trop volumineux');
    }

    const detected = sniffImageType(file.buffer);
    if (!detected || !isImageMime(detected)) {
      throw new ApiError(400, 'INVALID_IMAGE', 'Type de fichier non pris en charge');
    }

    const built = await buildImageVariants(file.buffer, detected);
    const originalName = assertSafeClientName(file.originalname);
    const sha256 = sha256Buffer(built.original);

    const filename = `${randomUUID()}.${IMAGE_EXTENSIONS[detected]}`;
    const variantKeys: Record<VariantName, string> = {
      thumb: `${randomUUID()}.webp`,
      medium: `${randomUUID()}.webp`,
      large: `${randomUUID()}.webp`,
    };

    // Écriture disque : originale + variantes (clés uniques générées côté serveur).
    await storageService.writeFile(filename, built.original);
    const variantsJson: Record<string, string> = {};
    for (const v of built.variants) {
      const key = variantKeys[v.name];
      await storageService.writeFile(key, v.buffer);
      variantsJson[v.name] = key;
    }

    try {
      const image = await prisma.$transaction(async (tx) => {
        const created = await imageRepository.create(
          {
            filename,
            original_name: originalName,
            mime_type: detected,
            size_bytes: built.original.length,
            width: built.width,
            height: built.height,
            sha256,
            path: filename,
            variants: variantsJson,
            alt: '',
            uploaded_by: ctx.admin.id,
          },
          tx,
        );
        await auditService.record(
          {
            userId: ctx.admin.id,
            action: 'IMAGE_UPLOADED',
            entityType: 'image',
            entityId: created.id,
            metadata: {
              filename,
              original_name: originalName,
              mime_type: detected,
              width: built.width,
              height: built.height,
              size_bytes: built.original.length,
              sha256,
            },
            ip: ctx.clientInfo.ip,
            userAgent: ctx.clientInfo.userAgent,
          },
          tx,
        );
        return created;
      });
      return toImageView(image);
    } catch (err) {
      // Rollback disque si l'écriture en base échoue (pas de fichier orphelin).
      await storageService.deleteFile(filename);
      for (const key of Object.values(variantKeys)) {
        await storageService.deleteFile(key);
      }
      throw err;
    }
  },

  async list(query: ImageQuery) {
    const { data, total } = await imageRepository.list(query);
    return {
      data: data.map((row) => toImageView(row as unknown as Parameters<typeof toImageView>[0])),
      pagination: pagination(query.page, query.pageSize, total),
    };
  },

  async get(id: string): Promise<ImageView> {
    const image = await imageRepository.findById(id);
    if (!image) {
      throw new ApiError(404, 'IMAGE_NOT_FOUND', 'Image introuvable');
    }
    return toImageView(image as unknown as Parameters<typeof toImageView>[0]);
  },

  async updateAlt(ctx: ActorContext, id: string, input: UpdateImageAltInput): Promise<ImageView> {
    const existing = await imageRepository.findById(id);
    if (!existing) {
      throw new ApiError(404, 'IMAGE_NOT_FOUND', 'Image introuvable');
    }
    const updated = await prisma.$transaction(async (tx) => {
      const result = await imageRepository.update(id, { alt: input.alt }, tx);
      await auditService.record(
        {
          userId: ctx.admin.id,
          action: 'IMAGE_UPDATED',
          entityType: 'image',
          entityId: id,
          metadata: { alt: input.alt, original_name: existing.original_name },
          ip: ctx.clientInfo.ip,
          userAgent: ctx.clientInfo.userAgent,
        },
        tx,
      );
      return result;
    });
    return toImageView(updated as unknown as Parameters<typeof toImageView>[0]);
  },

  /**
   * Suppression protégée : refusée si l'image est référencée (featured,
   * galerie d'articles, miniature de vidéo). Les fichiers sont supprimés
   * du disque via le StorageService (jamais un chemin client).
   */
  async remove(ctx: ActorContext, id: string): Promise<void> {
    const existing = await imageRepository.findById(id);
    if (!existing) {
      throw new ApiError(404, 'IMAGE_NOT_FOUND', 'Image introuvable');
    }
    const usage = await imageRepository.countUsage(id);
    if (usage.featuredArticles + usage.galleryArticles + usage.videoThumbnails > 0) {
      throw new ApiError(409, 'IMAGE_IN_USE', 'Image utilisee par du contenu');
    }

    const fileKeys = [existing.path, variantKey(existing, 'thumb'), variantKey(existing, 'medium'), variantKey(existing, 'large')]
      .filter((key): key is string => typeof key === 'string' && key.length > 0);

    await prisma.$transaction(async (tx) => {
      await imageRepository.delete(id, tx);
      await auditService.record(
        {
          userId: ctx.admin.id,
          action: 'IMAGE_DELETED',
          entityType: 'image',
          entityId: id,
          metadata: { original_name: existing.original_name, mime_type: existing.mime_type },
          ip: ctx.clientInfo.ip,
          userAgent: ctx.clientInfo.userAgent,
        },
        tx,
      );
    });

    for (const key of fileKeys) {
      try {
        await storageService.deleteFile(key);
      } catch {
        // nettoyage best-effort : une orpheline disque n'est jamais exposée
      }
    }
  },

  /** Lecture du fichier image (original ou variante) pour un streaming sécurisé. */
  async readStream(id: string, variant?: VariantName) {
    const image = await imageRepository.findById(id);
    if (!image) return null;

    if (variant) {
      const key = variantKey(image, variant);
      if (!key) return null;
      const stream = storageService.createReadStream(key);
      if (!stream) return null;
      return { stream, mimeType: 'image/webp', sizeBytes: statSize(key) };
    }

    const stream = storageService.createReadStream(image.path);
    if (!stream) return null;
    return { stream, mimeType: image.mime_type, sizeBytes: statSize(image.path) };
  },

  // -------------------------------------------------------------------------
  // Galerie des articles
  // -------------------------------------------------------------------------
  async articleGallery(articleId: string): Promise<GalleryItemView[]> {
    await this.assertArticle(articleId);
    const rows = await imageRepository.gallery(articleId);
    return rows.map((row) => toGalleryItemView(row as unknown as { position: number; image: Parameters<typeof toGalleryItemView>[0]['image'] }));
  },

  async attachToArticle(ctx: ActorContext, articleId: string, input: AttachImagesInput): Promise<GalleryItemView[]> {
    await this.assertArticle(articleId);
    const uniqueIds = [...new Set(input.image_ids)];
    await this.assertImagesExist(uniqueIds);

    await prisma.$transaction(async (tx) => {
      await imageRepository.appendToGallery(articleId, uniqueIds, tx);
      await auditService.record(
        {
          userId: ctx.admin.id,
          action: 'ARTICLE_IMAGES_ADDED',
          entityType: 'article',
          entityId: articleId,
          metadata: { added: uniqueIds.length, image_ids: uniqueIds },
          ip: ctx.clientInfo.ip,
          userAgent: ctx.clientInfo.userAgent,
        },
        tx,
      );
    });
    return this.articleGallery(articleId);
  },

  async detachFromArticle(ctx: ActorContext, articleId: string, imageId: string): Promise<GalleryItemView[]> {
    await this.assertArticle(articleId);
    const inGallery = await imageRepository.galleryIds(articleId);
    if (!inGallery.some((row) => row.image_id === imageId)) {
      throw new ApiError(404, 'IMAGE_NOT_IN_GALLERY', 'Image absente de la galerie');
    }
    await prisma.$transaction(async (tx) => {
      await imageRepository.detachFromGallery(articleId, imageId, tx);
      await auditService.record(
        {
          userId: ctx.admin.id,
          action: 'ARTICLE_IMAGES_REMOVED',
          entityType: 'article',
          entityId: articleId,
          metadata: { image_id: imageId },
          ip: ctx.clientInfo.ip,
          userAgent: ctx.clientInfo.userAgent,
        },
        tx,
      );
    });
    return this.articleGallery(articleId);
  },

  async reorderArticleImages(ctx: ActorContext, articleId: string, input: ReorderImagesInput): Promise<GalleryItemView[]> {
    await this.assertArticle(articleId);
    const uniqueIds = [...new Set(input.image_ids)];
    await prisma.$transaction(async (tx) => {
      await imageRepository.reorderGallery(articleId, uniqueIds, tx);
      await auditService.record(
        {
          userId: ctx.admin.id,
          action: 'ARTICLE_IMAGES_REORDERED',
          entityType: 'article',
          entityId: articleId,
          metadata: { image_ids: uniqueIds },
          ip: ctx.clientInfo.ip,
          userAgent: ctx.clientInfo.userAgent,
        },
        tx,
      );
    });
    return this.articleGallery(articleId);
  },

  async setArticleFeatured(ctx: ActorContext, articleId: string, imageId: string | null): Promise<{ featured_image: ImageView | null }> {
    const article = await this.assertArticle(articleId);
    if (imageId) {
      await this.assertImagesExist([imageId]);
    }
    await prisma.$transaction(async (tx) => {
      await imageRepository.setFeatured(articleId, imageId, tx);
      await auditService.record(
        {
          userId: ctx.admin.id,
          action: 'ARTICLE_FEATURED_IMAGE_UPDATED',
          entityType: 'article',
          entityId: articleId,
          metadata: { image_id: imageId, title: article.title },
          ip: ctx.clientInfo.ip,
          userAgent: ctx.clientInfo.userAgent,
        },
        tx,
      );
    });
    if (!imageId) return { featured_image: null };
    return { featured_image: await this.get(imageId) };
  },

  // -------------------------------------------------------------------------
  // Primitives internes
  // -------------------------------------------------------------------------
  async assertArticle(articleId: string) {
    const article = await articleRepository.findById(articleId);
    if (!article || article.deleted_at !== null) {
      throw new ApiError(404, 'ARTICLE_NOT_FOUND', 'Article introuvable');
    }
    return article;
  },

  async assertImagesExist(imageIds: string[]): Promise<void> {
    const count = await imageRepository.findByIdsCount(imageIds);
    if (count !== imageIds.length) {
      throw new ApiError(400, 'INVALID_IMAGE', 'Une ou plusieurs images sont introuvables');
    }
  },
};

function statSize(key: string): number {
  try {
    return statSync(storageService.resolve(key)).size;
  } catch {
    return 0;
  }
}

export type ImageService = typeof imageService;
