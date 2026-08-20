import { prisma } from '../db/client.ts';
import { tagRepository } from '../repositories/tag.repository.ts';
import type { ActorContext } from '../types/content.ts';
import type { Tag } from '../types/prisma.ts';
import { ApiError } from '../utils/errors.ts';
import { pagination } from '../utils/pagination.ts';
import { normalizeSlug, uniqueSlug } from '../utils/slug.ts';
import type { CreateTagInput, TagQuery } from '../validators/content.validators.ts';
import { auditService } from './audit.service.ts';

export interface TagView {
  id: string;
  name: string;
  slug: string;
  articles_count: number;
  created_at: Date;
  updated_at: Date;
}

type TagRow = Pick<Tag, 'id' | 'name' | 'slug' | 'created_at' | 'updated_at'> & {
  articles_count?: number;
};

function toTagView(tag: TagRow): TagView {
  return {
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    articles_count: tag.articles_count ?? 0,
    created_at: tag.created_at,
    updated_at: tag.updated_at,
  };
}

/**
 * Règles de gestion des tags :
 * - unicité du nom (insensible à la casse) et du slug,
 * - slug généré automatiquement si absent, normalisé s'il est fourni,
 * - les tags ne sont JAMAIS créés silencieusement à l'association d'un article,
 * - suppression refusée si le tag est encore utilisé par un article.
 */
export const tagService = {
  async list(query: TagQuery) {
    const { data, total } = await tagRepository.list(query);
    return {
      data: data.map(toTagView),
      pagination: pagination(query.page, query.pageSize, total),
    };
  },

  async create(ctx: ActorContext, input: CreateTagInput) {
    if (await tagRepository.findByNameInsensitive(input.name)) {
      throw new ApiError(409, 'DUPLICATE_TAG', 'Tag deja existant');
    }

    const slug = input.slug
      ? await this.resolveExplicitSlug(input.slug)
      : await uniqueSlug(input.name, async (s) => !!(await tagRepository.findBySlug(s)));

    const created = await tagRepository.create({ name: input.name, slug });

    await auditService.record(
      {
        userId: ctx.admin.id,
        action: 'TAG_CREATED',
        entityType: 'tag',
        entityId: created.id,
        metadata: { name: created.name, slug: created.slug },
        ip: ctx.clientInfo.ip,
        userAgent: ctx.clientInfo.userAgent,
      },
      prisma,
    );

    return toTagView(created);
  },

  async remove(ctx: ActorContext, id: string): Promise<void> {
    const target = await tagRepository.findById(id);
    if (!target) {
      throw new ApiError(404, 'TAG_NOT_FOUND', 'Tag introuvable');
    }
    if ((await tagRepository.countArticles(id)) > 0) {
      throw new ApiError(409, 'TAG_IN_USE', 'Tag utilise par des articles');
    }

    await tagRepository.delete(id);
    await auditService.record(
      {
        userId: ctx.admin.id,
        action: 'TAG_DELETED',
        entityType: 'tag',
        entityId: id,
        metadata: { name: target.name, slug: target.slug },
        ip: ctx.clientInfo.ip,
        userAgent: ctx.clientInfo.userAgent,
      },
      prisma,
    );
  },

  async resolveExplicitSlug(slug: string) {
    const normalized = normalizeSlug(slug);
    if (await tagRepository.findBySlug(normalized)) {
      throw new ApiError(409, 'DUPLICATE_SLUG', 'Slug deja utilise');
    }
    return normalized;
  },
};

export type TagService = typeof tagService;
