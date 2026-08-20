import { prisma } from '../db/client.ts';
import type { ArticleStatus } from '../generated/prisma/enums.ts';
import type { ContentTx } from './category.repository.ts';
import { IMAGE_REF_SELECT } from './image.repository.ts';
import type {
  AdminArticleQuery,
  AdminArticleSortField,
  PublicArticleQuery,
  PublicArticleSortField,
} from '../validators/content.validators.ts';

export const ARTICLE_INCLUDE = {
  category: { select: { id: true, name: true, slug: true } },
  author: { select: { id: true, username: true, first_name: true, last_name: true } },
  tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
  featuredImage: { select: IMAGE_REF_SELECT },
  gallery: {
    select: { position: true, image: { select: IMAGE_REF_SELECT } },
    orderBy: { position: 'asc' as const },
  },
} as const;

export const ADMIN_SORT_COLUMN: Record<AdminArticleSortField, string> = {
  created_at: 'created_at',
  updated_at: 'updated_at',
  published_at: 'published_at',
  title: 'title',
};

export const PUBLIC_SORT_COLUMN: Record<PublicArticleSortField, string> = {
  published_at: 'published_at',
  created_at: 'created_at',
  title: 'title',
};

const PUBLIC_ARTICLE_SELECT = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  category_id: true,
  featured_image_id: true,
  status: true,
  source: true,
  language: true,
  published_at: true,
  created_at: true,
  updated_at: true,
  category: { select: { id: true, name: true, slug: true } },
  author: { select: { id: true, username: true, first_name: true, last_name: true } },
  featuredImage: { select: IMAGE_REF_SELECT },
  tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
} as const;

export interface CreateArticleInput {
  title: string;
  slug: string;
  summary: string | null;
  content: string;
  category_id: string | null;
  author_id: string;
  status: ArticleStatus;
  source: string | null;
  language: string;
  published_at: Date | null;
  tagIds: string[];
}

export const articleRepository = {
  existsSlug(slug: string, excludeId?: string, tx: ContentTx = prisma) {
    return tx.article.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
  },

  findById(id: string, tx: ContentTx = prisma) {
    return tx.article.findUnique({
      where: { id },
      include: ARTICLE_INCLUDE,
    });
  },

  findBySlug(slug: string, tx: ContentTx = prisma) {
    return tx.article.findUnique({
      where: { slug },
      include: ARTICLE_INCLUDE,
    });
  },

  async create(input: CreateArticleInput, tx: ContentTx = prisma) {
    const article = await tx.article.create({
      data: {
        title: input.title,
        slug: input.slug,
        summary: input.summary,
        content: input.content,
        category_id: input.category_id,
        author_id: input.author_id,
        status: input.status,
        source: input.source,
        language: input.language,
        published_at: input.published_at,
      },
      include: ARTICLE_INCLUDE,
    });
    if (input.tagIds.length > 0) {
      await tx.articleTag.createMany({
        data: input.tagIds.map((tag_id) => ({ article_id: article.id, tag_id })),
        skipDuplicates: true,
      });
    }
    return this.findById(article.id, tx);
  },

  async update(
    id: string,
    input: {
      title?: string;
      slug?: string;
      summary?: string | null;
      content?: string;
      category_id?: string | null;
      status?: ArticleStatus;
      source?: string | null;
      language?: string;
      published_at?: Date | null;
      tagIds?: string[];
    },
    tx: ContentTx = prisma,
  ) {
    const data = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.category_id !== undefined ? { category_id: input.category_id } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.source !== undefined ? { source: input.source } : {}),
      ...(input.language !== undefined ? { language: input.language } : {}),
      ...(input.published_at !== undefined ? { published_at: input.published_at } : {}),
    };
    const article = await tx.article.update({ where: { id }, data, include: ARTICLE_INCLUDE });

    if (input.tagIds !== undefined) {
      await tx.articleTag.deleteMany({ where: { article_id: id } });
      if (input.tagIds.length > 0) {
        await tx.articleTag.createMany({
          data: input.tagIds.map((tag_id) => ({ article_id: id, tag_id })),
          skipDuplicates: true,
        });
      }
    }
    return this.findById(article.id, tx);
  },

  setStatus(id: string, status: ArticleStatus, publishedAt: Date | null, tx: ContentTx = prisma) {
    return tx.article.update({
      where: { id },
      data: { status, published_at: publishedAt },
      include: ARTICLE_INCLUDE,
    });
  },

  softDelete(id: string, tx: ContentTx = prisma) {
    return tx.article.update({
      where: { id },
      data: { deleted_at: new Date() },
      include: ARTICLE_INCLUDE,
    });
  },

  /** Liste ADMIN : inclut tous les statuts, exclut les articles soft-deleted. */
  async listAdmin(query: AdminArticleQuery) {
    const { page, pageSize, search, status, category_id, author_id, from, to, sort, order } = query;
    const where = {
      deleted_at: null,
      ...(status ? { status } : {}),
      ...(category_id ? { category_id } : {}),
      ...(author_id ? { author_id } : {}),
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
              { summary: { contains: search, mode: 'insensitive' as const } },
              { content: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.article.findMany({
        where,
        select: PUBLIC_ARTICLE_SELECT,
        orderBy: { [ADMIN_SORT_COLUMN[sort]]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.article.count({ where }),
    ]);
    return { data, total };
  },

  /** Liste USER : uniquement PUBLISHED, non supprimé, publication effective (<= now). */
  async listPublic(query: PublicArticleQuery) {
    const { page, pageSize, search, category, tag, sort, order } = query;
    const where = {
      status: 'PUBLISHED' as const,
      deleted_at: null,
      published_at: { lte: new Date() },
      ...(category ? { category: { slug: category } } : {}),
      ...(tag ? { tags: { some: { tag: { slug: tag } } } } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              { summary: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.article.findMany({
        where,
        select: PUBLIC_ARTICLE_SELECT,
        orderBy: [
          { [PUBLIC_SORT_COLUMN[sort]]: order },
          { created_at: 'desc' as const },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.article.count({ where }),
    ]);
    return { data, total };
  },
};
