import { prisma } from '../db/client.ts';
import type { VideoPlatform, VideoStatus } from '../generated/prisma/enums.ts';
import type { MediaTx } from './image.repository.ts';
import type { VideoQuery } from '../validators/media.validators.ts';

export const VIDEO_INCLUDE = {
  thumbnail: {
    select: {
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
    },
  },
  category: { select: { id: true, name: true, slug: true } },
  author: { select: { id: true, username: true, first_name: true, last_name: true } },
} as const;

const VIDEO_SORT_COLUMN: Record<VideoQuery['sort'], string> = {
  created_at: 'created_at',
  updated_at: 'updated_at',
  published_at: 'published_at',
  title: 'title',
};

export interface CreateVideoInput {
  title: string;
  description: string | null;
  platform: VideoPlatform;
  external_id: string;
  url: string;
  thumbnail_image_id: string | null;
  category_id: string | null;
  author_id: string;
  status: VideoStatus;
  published_at: Date | null;
}

export const videoRepository = {
  findById(id: string, tx: MediaTx = prisma) {
    return tx.video.findUnique({ where: { id }, include: VIDEO_INCLUDE });
  },

  existsByExternalId(
    platform: VideoPlatform,
    externalId: string,
    excludeId?: string,
    tx: MediaTx = prisma,
  ) {
    return tx.video.findFirst({
      where: { platform, external_id: externalId, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
  },

  create(input: CreateVideoInput, tx: MediaTx = prisma) {
    return tx.video.create({ data: input, include: VIDEO_INCLUDE });
  },

  update(
    id: string,
    input: Partial<{
      title: string;
      description: string | null;
      platform: VideoPlatform;
      external_id: string;
      url: string;
      thumbnail_image_id: string | null;
      category_id: string | null;
      status: VideoStatus;
      published_at: Date | null;
    }>,
    tx: MediaTx = prisma,
  ) {
    return tx.video.update({ where: { id }, data: input, include: VIDEO_INCLUDE });
  },

  setStatus(id: string, status: VideoStatus, publishedAt: Date | null, tx: MediaTx = prisma) {
    return tx.video.update({
      where: { id },
      data: { status, published_at: publishedAt },
      include: VIDEO_INCLUDE,
    });
  },

  softDelete(id: string, tx: MediaTx = prisma) {
    return tx.video.update({ where: { id }, data: { deleted_at: new Date() } });
  },

  /** Liste ADMIN : tous statuts, hors soft-deleted. */
  async listAdmin(query: VideoQuery) {
    const { page, pageSize, search, status, category_id, from, to, sort, order } = query;
    const where = {
      deleted_at: null,
      ...(status ? { status } : {}),
      ...(category_id ? { category_id } : {}),
      ...(from || to
        ? {
            created_at: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              { description: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      prisma.video.findMany({
        where,
        include: VIDEO_INCLUDE,
        orderBy: { [VIDEO_SORT_COLUMN[sort]]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.video.count({ where }),
    ]);
    return { data, total };
  },

  /** Liste USER : uniquement PUBLISHED, non supprimé, publication effective. */
  async listPublic(query: { page: number; pageSize: number; search?: string; category?: string; sort: VideoQuery['sort']; order: 'asc' | 'desc' }) {
    const { page, pageSize, search, category, sort, order } = query;
    const where = {
      status: 'PUBLISHED' as const,
      deleted_at: null,
      published_at: { lte: new Date() },
      ...(category ? { category: { slug: category } } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              { description: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      prisma.video.findMany({
        where,
        include: VIDEO_INCLUDE,
        orderBy: [{ [VIDEO_SORT_COLUMN[sort]]: order }, { created_at: 'desc' as const }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.video.count({ where }),
    ]);
    return { data, total };
  },
};
