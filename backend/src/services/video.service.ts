import { prisma } from '../db/client.ts';
import { categoryRepository } from '../repositories/category.repository.ts';
import { imageRepository } from '../repositories/image.repository.ts';
import { videoRepository } from '../repositories/video.repository.ts';
import type { ActorContext } from '../types/content.ts';
import { ApiError } from '../utils/errors.ts';
import { toVideoView, type VideoRow, type VideoView } from '../utils/mediaView.ts';
import { pagination } from '../utils/pagination.ts';
import { parseVideoUrl } from '../utils/video.ts';
import type {
  CreateVideoInput,
  PublicVideoQuery,
  UpdateVideoInput,
  VideoQuery,
  VideoStatusValue,
} from '../validators/media.validators.ts';
import { auditService } from './audit.service.ts';

/** Transitions autorisées entre statuts (machine à états identique aux articles). */
const ALLOWED_TRANSITIONS: Record<VideoStatusValue, VideoStatusValue[]> = {
  DRAFT: ['PUBLISHED'],
  PUBLISHED: ['ARCHIVED'],
  ARCHIVED: ['DRAFT', 'PUBLISHED'],
};

function assertTransition(from: VideoStatusValue, to: VideoStatusValue): void {
  if (from === to) return;
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new ApiError(409, 'INVALID_STATUS_TRANSITION', `Transition ${from} → ${to} interdite`);
  }
}

async function assertValidCategory(categoryId: string | null): Promise<void> {
  if (categoryId && !(await categoryRepository.findById(categoryId))) {
    throw new ApiError(400, 'INVALID_CATEGORY', 'Categorie introuvable');
  }
}

async function assertValidThumbnail(thumbnailId: string | null): Promise<void> {
  if (thumbnailId && !(await imageRepository.findById(thumbnailId))) {
    throw new ApiError(400, 'INVALID_IMAGE', 'Image miniature introuvable');
  }
}

async function assertUniqueExternal(
  platform: 'YOUTUBE' | 'VIMEO',
  externalId: string,
  excludeId?: string,
): Promise<void> {
  if (await videoRepository.existsByExternalId(platform, externalId, excludeId)) {
    throw new ApiError(409, 'DUPLICATE_VIDEO', 'Cette video est deja referencee');
  }
}

/**
 * Règles de gestion des vidéos :
 * - seules YouTube et Vimeo sont acceptées, via hôtes autorisés et identifiants
 *   validés par expression stricte ;
 * - l'URL stockée/servie est TOUJOURS l'URL d'embed normalisée (jamais l'URL brute),
 * - l'auteur est l'utilisateur authentifié de la session (jamais du body),
 * - la machine à états DRAFT→PUBLISHED→ARCHIVED est strictement validée,
 * - la suppression est un soft-delete,
 * - chaque mutation produit un audit log atomique.
 */
export const videoService = {
  async create(ctx: ActorContext, input: CreateVideoInput): Promise<VideoView> {
    const parsed = parseVideoUrl(input.url);
    if (!parsed) {
      throw new ApiError(400, 'INVALID_VIDEO_URL', 'URL video non prise en charge');
    }
    const categoryId = input.category_id ?? null;
    const thumbnailId = input.thumbnail_image_id ?? null;
    await assertValidCategory(categoryId);
    await assertValidThumbnail(thumbnailId);
    await assertUniqueExternal(parsed.platform, parsed.externalId);

    const status = input.status;
    let publishedAt: Date | null = input.published_at ?? null;
    if (status === 'PUBLISHED' && !publishedAt) publishedAt = new Date();

    const video = await prisma.$transaction(async (tx) => {
      const created = await videoRepository.create(
        {
          title: input.title,
          description: input.description ?? null,
          platform: parsed.platform,
          external_id: parsed.externalId,
          url: parsed.url,
          thumbnail_image_id: thumbnailId,
          category_id: categoryId,
          author_id: ctx.admin.id,
          status,
          published_at: publishedAt,
        },
        tx,
      );
      await auditService.record(
        {
          userId: ctx.admin.id,
          action: 'VIDEO_CREATED',
          entityType: 'video',
          entityId: created.id,
          metadata: { title: created.title, platform: created.platform, status: created.status },
          ip: ctx.clientInfo.ip,
          userAgent: ctx.clientInfo.userAgent,
        },
        tx,
      );
      return created;
    });
    return toVideoView(video as unknown as VideoRow);
  },

  async listAdmin(query: VideoQuery) {
    const { data, total } = await videoRepository.listAdmin(query);
    return {
      data: data.map((row) => toVideoView(row as unknown as VideoRow)),
      pagination: pagination(query.page, query.pageSize, total),
    };
  },

  async getAdminVideo(id: string): Promise<VideoView> {
    const video = await videoRepository.findById(id);
    if (!video || video.deleted_at !== null) {
      throw new ApiError(404, 'VIDEO_NOT_FOUND', 'Video introuvable');
    }
    return toVideoView(video as unknown as VideoRow);
  },

  async update(ctx: ActorContext, id: string, input: UpdateVideoInput): Promise<VideoView> {
    const current = await videoRepository.findById(id);
    if (!current || current.deleted_at !== null) {
      throw new ApiError(404, 'VIDEO_NOT_FOUND', 'Video introuvable');
    }

    let platform = current.platform;
    let externalId = current.external_id;
    let url = current.url;
    if (input.url !== undefined) {
      const parsed = parseVideoUrl(input.url);
      if (!parsed) {
        throw new ApiError(400, 'INVALID_VIDEO_URL', 'URL video non prise en charge');
      }
      platform = parsed.platform;
      externalId = parsed.externalId;
      url = parsed.url;
      await assertUniqueExternal(platform, externalId, id);
    }
    if (input.category_id !== undefined) {
      await assertValidCategory(input.category_id);
    }
    if (input.thumbnail_image_id !== undefined) {
      await assertValidThumbnail(input.thumbnail_image_id);
    }

    const nextStatus = input.status ?? current.status;
    if (input.status !== undefined && input.status !== current.status) {
      assertTransition(current.status, nextStatus);
    }
    let publishedAt: Date | null | undefined;
    if (input.published_at !== undefined) {
      publishedAt = input.published_at;
    } else if (nextStatus === 'PUBLISHED' && current.status !== 'PUBLISHED' && !current.published_at) {
      publishedAt = new Date();
    }

    const video = await prisma.$transaction(async (tx) => {
      const updated = await videoRepository.update(
        id,
        {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.url !== undefined ? { platform, external_id: externalId, url } : {}),
          ...(input.thumbnail_image_id !== undefined ? { thumbnail_image_id: input.thumbnail_image_id } : {}),
          ...(input.category_id !== undefined ? { category_id: input.category_id } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(publishedAt !== undefined ? { published_at: publishedAt } : {}),
        },
        tx,
      );
      await auditService.record(
        {
          userId: ctx.admin.id,
          action: 'VIDEO_UPDATED',
          entityType: 'video',
          entityId: id,
          metadata: { title: updated.title, platform, changedFields: Object.keys(input) },
          ip: ctx.clientInfo.ip,
          userAgent: ctx.clientInfo.userAgent,
        },
        tx,
      );
      return updated;
    });
    return toVideoView(video as unknown as VideoRow);
  },

  async setStatus(ctx: ActorContext, id: string, status: VideoStatusValue): Promise<VideoView> {
    const current = await videoRepository.findById(id);
    if (!current || current.deleted_at !== null) {
      throw new ApiError(404, 'VIDEO_NOT_FOUND', 'Video introuvable');
    }
    if (current.status === status) {
      throw new ApiError(409, 'ALREADY_IN_STATUS', 'La video est deja dans cet etat');
    }
    assertTransition(current.status, status);

    let publishedAt = current.published_at;
    if (status === 'PUBLISHED' && !current.published_at) publishedAt = new Date();

    const action =
      status === 'PUBLISHED'
        ? 'VIDEO_PUBLISHED'
        : status === 'ARCHIVED'
          ? 'VIDEO_ARCHIVED'
          : 'VIDEO_RESTORED';

    const video = await prisma.$transaction(async (tx) => {
      const updated = await videoRepository.setStatus(id, status, publishedAt, tx);
      await auditService.record(
        {
          userId: ctx.admin.id,
          action,
          entityType: 'video',
          entityId: id,
          metadata: { from: current.status, to: status, title: updated.title },
          ip: ctx.clientInfo.ip,
          userAgent: ctx.clientInfo.userAgent,
        },
        tx,
      );
      return updated;
    });
    return toVideoView(video as unknown as VideoRow);
  },

  async remove(ctx: ActorContext, id: string): Promise<void> {
    const current = await videoRepository.findById(id);
    if (!current || current.deleted_at !== null) {
      throw new ApiError(404, 'VIDEO_NOT_FOUND', 'Video introuvable');
    }
    await prisma.$transaction(async (tx) => {
      await videoRepository.softDelete(id, tx);
      await auditService.record(
        {
          userId: ctx.admin.id,
          action: 'VIDEO_DELETED',
          entityType: 'video',
          entityId: id,
          metadata: { title: current.title, status: current.status },
          ip: ctx.clientInfo.ip,
          userAgent: ctx.clientInfo.userAgent,
        },
        tx,
      );
    });
  },

  /** Flux public : uniquement PUBLISHED, non supprimé, publication effective. */
  async listPublic(query: PublicVideoQuery) {
    const { data, total } = await videoRepository.listPublic(query);
    return {
      data: data.map((row) => toVideoView(row as unknown as VideoRow)),
      pagination: pagination(query.page, query.pageSize, total),
    };
  },

  async getPublicVideo(id: string): Promise<VideoView> {
    const video = await videoRepository.findById(id);
    const isVisible =
      video &&
      video.status === 'PUBLISHED' &&
      video.deleted_at === null &&
      (!video.published_at || video.published_at <= new Date());
    if (!isVisible) {
      throw new ApiError(404, 'VIDEO_NOT_FOUND', 'Video introuvable');
    }
    return toVideoView(video as unknown as VideoRow);
  },
};

export type VideoService = typeof videoService;
