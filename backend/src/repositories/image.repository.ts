import { Prisma } from '../generated/prisma/client.ts';
import { prisma } from '../db/client.ts';
import type { ImageSortField, ImageQuery } from '../validators/media.validators.ts';

export type MediaTx = Prisma.TransactionClient;

export const IMAGE_SELECT = {
  id: true,
  filename: true,
  original_name: true,
  mime_type: true,
  size_bytes: true,
  width: true,
  height: true,
  sha256: true,
  path: true,
  variants: true,
  alt: true,
  uploaded_by: true,
  created_at: true,
  updated_at: true,
} as const;

/** Sélection allégée pour les relations (featured, galerie, thumbnail) : */
export const IMAGE_REF_SELECT = {
  id: true,
  original_name: true,
  mime_type: true,
  size_bytes: true,
  width: true,
  height: true,
  sha256: true,
  alt: true,
  created_at: true,
  updated_at: true,
} as const;

const IMAGE_SORT_COLUMN: Record<ImageSortField, string> = {
  created_at: 'created_at',
  filename: 'filename',
  size_bytes: 'size_bytes',
};

export interface ImageUsage {
  featuredArticles: number;
  galleryArticles: number;
  videoThumbnails: number;
}

export const imageRepository = {
  findById(id: string, tx: MediaTx = prisma) {
    return tx.image.findUnique({ where: { id } });
  },

  /** Nombre d'images existantes parmi une liste d'ids (validation d'intégrité). */
  async findByIdsCount(ids: string[], tx: MediaTx = prisma): Promise<number> {
    const rows = await tx.image.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    return rows.length;
  },

  create(
    input: {
      filename: string;
      original_name: string;
      mime_type: string;
      size_bytes: number;
      width: number;
      height: number;
      sha256: string;
      path: string;
      variants: Prisma.InputJsonValue;
      alt: string;
      uploaded_by: string | null;
    },
    tx: MediaTx = prisma,
  ) {
    return tx.image.create({ data: input });
  },

  update(
    id: string,
    data: Partial<{ alt: string; original_name: string }>,
    tx: MediaTx = prisma,
  ) {
    return tx.image.update({ where: { id }, data });
  },

  delete(id: string, tx: MediaTx = prisma) {
    return tx.image.delete({ where: { id } });
  },

  async list(query: ImageQuery) {
    const { page, pageSize, search, sort, order } = query;
    const where = {
      ...(search
        ? {
            OR: [
              { original_name: { contains: search, mode: 'insensitive' as const } },
              { filename: { contains: search, mode: 'insensitive' as const } },
              { alt: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      prisma.image.findMany({
        where,
        select: IMAGE_SELECT,
        orderBy: { [IMAGE_SORT_COLUMN[sort]]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.image.count({ where }),
    ]);
    return { data, total };
  },

  /** Nombre d'usages de l'image : l'interdit de suppression tant que référencée. */
  async countUsage(id: string): Promise<ImageUsage> {
    const [featuredArticles, galleryArticles, videoThumbnails] = await Promise.all([
      prisma.article.count({ where: { featured_image_id: id, deleted_at: null } }),
      prisma.articleImage.count({ where: { image_id: id } }),
      prisma.video.count({ where: { thumbnail_image_id: id } }),
    ]);
    return { featuredArticles, galleryArticles, videoThumbnails };
  },

  // -------------------------------------------------------------------------
  // Galerie d'articles
  // -------------------------------------------------------------------------
  async gallery(articleId: string) {
    return prisma.articleImage.findMany({
      where: { article_id: articleId },
      select: { image_id: true, position: true, image: { select: IMAGE_SELECT } },
      orderBy: [{ position: 'asc' }, { image_id: 'asc' }],
    });
  },

  galleryIds(articleId: string) {
    return prisma.articleImage.findMany({
      where: { article_id: articleId },
      select: { image_id: true, position: true },
      orderBy: { position: 'asc' },
    });
  },

  /** Ajoute des images en fin de galerie (aucune image n'est jamais créée ici). */
  async appendToGallery(articleId: string, imageIds: string[], tx: MediaTx = prisma) {
    const existing = await tx.articleImage.findMany({ where: { article_id: articleId } });
    const present = new Set(existing.map((row) => row.image_id));
    const nextIds = imageIds.filter((id) => !present.has(id));
    if (nextIds.length === 0) return;
    const maxPosition = existing.reduce((max, row) => Math.max(max, row.position), -1);
    await tx.articleImage.createMany({
      data: nextIds.map((image_id, index) => ({
        article_id: articleId,
        image_id,
        position: maxPosition + 1 + index,
      })),
    });
  },

  detachFromGallery(articleId: string, imageId: string, tx: MediaTx = prisma) {
    return tx.articleImage.delete({
      where: { article_id_image_id: { article_id: articleId, image_id: imageId } },
    });
  },

  /**
   * Réordonne la galerie : les ids fournis prennent les positions 0..n-1,
   * les images restantes conservent leur ordre relatif à la suite.
   */
  async reorderGallery(articleId: string, imageIds: string[], tx: MediaTx = prisma) {
    const existing = await tx.articleImage.findMany({ where: { article_id: articleId } });
    if (existing.length === 0) return;
    const ordered = new Set(imageIds);
    const tail = existing
      .filter((row) => !ordered.has(row.image_id))
      .sort((a, b) => a.position - b.position)
      .map((row) => row.image_id);
    const all = [...imageIds, ...tail];
    for (let i = 0; i < all.length; i++) {
      await tx.articleImage.update({
        where: { article_id_image_id: { article_id: articleId, image_id: all[i] } },
        data: { position: i },
      });
    }
  },

  setFeatured(articleId: string, imageId: string | null, tx: MediaTx = prisma) {
    return tx.article.update({
      where: { id: articleId },
      data: { featured_image_id: imageId },
      select: { id: true, featured_image_id: true },
    });
  },
};
