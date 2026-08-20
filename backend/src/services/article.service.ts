import { Prisma } from '../generated/prisma/client.ts';
import { prisma } from '../db/client.ts';
import type { ArticleStatus } from '../generated/prisma/enums.ts';
import { articleRepository } from '../repositories/article.repository.ts';
import { categoryRepository } from '../repositories/category.repository.ts';
import { tagRepository } from '../repositories/tag.repository.ts';
import type { ActorContext } from '../types/content.ts';
import { toArticleSummaryView, toArticleView, type ArticleRow } from '../utils/contentView.ts';
import { ApiError } from '../utils/errors.ts';
import { pagination } from '../utils/pagination.ts';
import { uniqueSlug } from '../utils/slug.ts';
import type {
  AdminArticleQuery,
  CreateArticleInput,
  PublicArticleQuery,
  UpdateArticleInput,
} from '../validators/content.validators.ts';
import { auditService } from './audit.service.ts';

/** Transitions autorisées entre statuts. */
const ALLOWED_TRANSITIONS: Record<ArticleStatus, ArticleStatus[]> = {
  DRAFT: ['PUBLISHED'],
  PUBLISHED: ['ARCHIVED'],
  ARCHIVED: ['DRAFT', 'PUBLISHED'],
};

function assertTransition(from: ArticleStatus, to: ArticleStatus): void {
  if (from === to) return;
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new ApiError(409, 'INVALID_STATUS_TRANSITION', `Transition ${from} → ${to} interdite`);
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  );
}

async function assertValidCategory(categoryId: string | null): Promise<void> {
  if (categoryId && !(await categoryRepository.findById(categoryId))) {
    throw new ApiError(400, 'INVALID_CATEGORY', 'Categorie introuvable');
  }
}

async function assertValidTags(tagIds: string[]): Promise<void> {
  const unique = [...new Set(tagIds)];
  if (unique.length === 0) return;
  const count = await tagRepository.countExistingIds(unique);
  if (count !== unique.length) {
    throw new ApiError(400, 'INVALID_TAG', 'Un ou plusieurs tags sont inexistants');
  }
}

/**
 * Règles de gestion des articles :
 * - l'auteur est TOUJOURS l'utilisateur authentifié de la session (jamais du body),
 * - le slug est généré depuis le titre et reste STABLE lors des modifications,
 * - les statuts ne peuvent changer que selon une machine à états validée,
 * - PUBLISHED sans date de publication → maintenant (la date future = programmation),
 * - la catégorie et les tags sont validés strictement (aucune création implicite),
 * - la suppression est un soft-delete : l'article disparaît des listes,
 * - chaque mutation et chaque transition produit un audit log atomique.
 */
export const articleService = {
  async listAdmin(query: AdminArticleQuery) {
    const { data, total } = await articleRepository.listAdmin(query);
    return {
      data: data.map((a) => toArticleSummaryView(a as unknown as ArticleRow)),
      pagination: pagination(query.page, query.pageSize, total),
    };
  },

  async getAdminArticle(id: string) {
    const article = await articleRepository.findById(id);
    if (!article || article.deleted_at !== null) {
      throw new ApiError(404, 'ARTICLE_NOT_FOUND', 'Article introuvable');
    }
    return toArticleView(article as unknown as ArticleRow);
  },

  async createArticle(ctx: ActorContext, input: CreateArticleInput) {
    const authorId = ctx.admin.id;
    const categoryId = input.category_id ?? null;
    const tagIds = [...new Set(input.tags ?? [])];

    await assertValidCategory(categoryId);
    await assertValidTags(tagIds);

    const status = input.status;
    let publishedAt: Date | null = input.published_at ?? null;
    if (status === 'PUBLISHED' && !publishedAt) publishedAt = new Date();

    // Retry borné sur collision de slug (course d'écriture entre deux créations).
    for (let attempt = 0; attempt < 3; attempt++) {
      const slug = await uniqueSlug(input.title, async (s) => !!(await articleRepository.existsSlug(s)));
      try {
        const created = await prisma.$transaction(async (tx) => {
          const article = await articleRepository.create(
            {
              title: input.title,
              slug,
              summary: input.summary ?? null,
              content: input.content,
              category_id: categoryId,
              author_id: authorId,
              status,
              source: input.source ?? null,
              language: input.language,
              published_at: publishedAt,
              tagIds,
            },
            tx,
          );
          if (!article) {
            throw new Error('Article creation failed');
          }
          await auditService.record(
            {
              userId: authorId,
              action: 'ARTICLE_CREATED',
              entityType: 'article',
              entityId: article.id,
              metadata: { title: article.title, slug: article.slug, status },
              ip: ctx.clientInfo.ip,
              userAgent: ctx.clientInfo.userAgent,
            },
            tx,
          );
          return article;
        });
        return toArticleView(created as unknown as ArticleRow);
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
      }
    }
    throw new ApiError(409, 'DUPLICATE_SLUG', 'Impossible de generer un slug unique');
  },

  async updateArticle(ctx: ActorContext, id: string, input: UpdateArticleInput) {
    const current = await articleRepository.findById(id);
    if (!current || current.deleted_at !== null) {
      throw new ApiError(404, 'ARTICLE_NOT_FOUND', 'Article introuvable');
    }

    if (input.category_id !== undefined) {
      await assertValidCategory(input.category_id);
    }
    let tagIds: string[] | undefined;
    if (input.tags !== undefined) {
      tagIds = [...new Set(input.tags)];
      await assertValidTags(tagIds);
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

    const updated = await prisma.$transaction(async (tx) => {
      const article = await articleRepository.update(
        id,
        {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.summary !== undefined ? { summary: input.summary } : {}),
          ...(input.content !== undefined ? { content: input.content } : {}),
          ...(input.category_id !== undefined ? { category_id: input.category_id } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.source !== undefined ? { source: input.source } : {}),
          ...(input.language !== undefined ? { language: input.language } : {}),
          ...(publishedAt !== undefined ? { published_at: publishedAt } : {}),
          ...(tagIds !== undefined ? { tagIds } : {}),
        },
        tx,
      );
      if (!article) {
        throw new Error('Article update failed');
      }
      await auditService.record(
        {
          userId: ctx.admin.id,
          action: 'ARTICLE_UPDATED',
          entityType: 'article',
          entityId: id,
          metadata: {
            title: article.title,
            slug: article.slug,
            status: nextStatus,
            changedFields: Object.keys(input),
          },
          ip: ctx.clientInfo.ip,
          userAgent: ctx.clientInfo.userAgent,
        },
        tx,
      );
      return article;
    });

    return toArticleView(updated as unknown as ArticleRow);
  },

  async setArticleStatus(ctx: ActorContext, id: string, status: ArticleStatus) {
    const current = await articleRepository.findById(id);
    if (!current || current.deleted_at !== null) {
      throw new ApiError(404, 'ARTICLE_NOT_FOUND', 'Article introuvable');
    }
    if (current.status === status) {
      throw new ApiError(409, 'ALREADY_IN_STATUS', 'L article est deja dans cet etat');
    }
    assertTransition(current.status, status);

    let publishedAt = current.published_at;
    if (status === 'PUBLISHED' && !current.published_at) publishedAt = new Date();

    const action =
      status === 'PUBLISHED'
        ? 'ARTICLE_PUBLISHED'
        : status === 'ARCHIVED'
          ? 'ARTICLE_ARCHIVED'
          : 'ARTICLE_RESTORED';

    const updated = await prisma.$transaction(async (tx) => {
      const article = await articleRepository.setStatus(id, status, publishedAt, tx);
      if (!article) {
        throw new Error('Article status update failed');
      }
      await auditService.record(
        {
          userId: ctx.admin.id,
          action,
          entityType: 'article',
          entityId: id,
          metadata: { from: current.status, to: status, title: article.title, slug: article.slug },
          ip: ctx.clientInfo.ip,
          userAgent: ctx.clientInfo.userAgent,
        },
        tx,
      );
      return article;
    });

    return toArticleView(updated as unknown as ArticleRow);
  },

  async deleteArticle(ctx: ActorContext, id: string): Promise<void> {
    const current = await articleRepository.findById(id);
    if (!current || current.deleted_at !== null) {
      throw new ApiError(404, 'ARTICLE_NOT_FOUND', 'Article introuvable');
    }

    await prisma.$transaction(async (tx) => {
      await articleRepository.softDelete(id, tx);
      await auditService.record(
        {
          userId: ctx.admin.id,
          action: 'ARTICLE_DELETED',
          entityType: 'article',
          entityId: id,
          metadata: { title: current.title, slug: current.slug, status: current.status },
          ip: ctx.clientInfo.ip,
          userAgent: ctx.clientInfo.userAgent,
        },
        tx,
      );
    });
  },

  /** Flux public : uniquement PUBLISHED, non supprimé, publication effective. */
  async listPublicArticles(query: PublicArticleQuery) {
    const { data, total } = await articleRepository.listPublic(query);
    return {
      data: data.map((a) => toArticleSummaryView(a as unknown as ArticleRow)),
      pagination: pagination(query.page, query.pageSize, total),
    };
  },

  async getPublicArticleBySlug(slug: string) {
    const article = await articleRepository.findBySlug(slug);
    const isVisible =
      article &&
      article.status === 'PUBLISHED' &&
      article.deleted_at === null &&
      (!article.published_at || article.published_at <= new Date());
    if (!isVisible) {
      throw new ApiError(404, 'ARTICLE_NOT_FOUND', 'Article introuvable');
    }
    return toArticleView(article as unknown as ArticleRow);
  },
};

export type ArticleService = typeof articleService;
