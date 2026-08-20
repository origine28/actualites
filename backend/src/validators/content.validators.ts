import { z } from 'zod';

// ---------------------------------------------------------------------------
// Utilitaires communs
// ---------------------------------------------------------------------------

/** Chaîne de date ISO parseable (transformée en Date dans le corps). */
const dateStringSchema = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'date invalide')
  .transform((v) => new Date(v));

const uuidSchema = z.string().uuid('uuid invalide');

/** Slug fourni par le client : normalisé, URL-safe, jamais confié aveuglément. */
const clientSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug invalide');

// ---------------------------------------------------------------------------
// Catégories
// ---------------------------------------------------------------------------

export const categoryNameSchema = z.string().trim().min(1, 'nom requis').max(64);

export const createCategorySchema = z.object({
  name: categoryNameSchema,
  slug: clientSlugSchema.optional(),
  parent_id: uuidSchema.nullable().optional(),
  sort_order: z.coerce.number().int().min(0).max(9999).default(0),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z
  .object({
    name: categoryNameSchema.optional(),
    slug: clientSlugSchema.optional(),
    parent_id: uuidSchema.nullable().optional(),
    sort_order: z.coerce.number().int().min(0).max(9999).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'au moins un champ requis');
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const CATEGORY_SORT_FIELDS = ['name', 'sort_order', 'created_at'] as const;
export type CategorySortField = (typeof CATEGORY_SORT_FIELDS)[number];

export const categoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  parent_id: uuidSchema.nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  sort: z.enum(CATEGORY_SORT_FIELDS).default('sort_order'),
  order: z.enum(['asc', 'desc']).default('asc'),
});
export type CategoryQuery = z.infer<typeof categoryQuerySchema>;

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export const tagNameSchema = z.string().trim().min(1, 'nom requis').max(64);

export const createTagSchema = z.object({
  name: tagNameSchema,
  slug: clientSlugSchema.optional(),
});
export type CreateTagInput = z.infer<typeof createTagSchema>;

export const TAG_SORT_FIELDS = ['name', 'created_at'] as const;
export type TagSortField = (typeof TAG_SORT_FIELDS)[number];

export const tagQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(TAG_SORT_FIELDS).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});
export type TagQuery = z.infer<typeof tagQuerySchema>;

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

export const articleStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
export type ArticleStatusValue = z.infer<typeof articleStatusSchema>;

export const createArticleSchema = z.object({
  title: z.string().trim().min(3, 'titre requis (3 caracteres minimum)').max(200),
  summary: z.string().trim().max(500).nullable().optional(),
  content: z.string().min(1, 'contenu requis').max(1_000_000),
  category_id: uuidSchema.nullable().optional(),
  /** Liste de tag IDs : les tags doivent exister (jamais créés silencieusement). */
  tags: z.array(uuidSchema).max(20).optional(),
  source: z.string().trim().max(255).nullable().optional(),
  language: z.string().trim().min(2).max(10).default('fr'),
  status: articleStatusSchema.default('DRAFT'),
  published_at: dateStringSchema.nullable().optional(),
});
export type CreateArticleInput = z.infer<typeof createArticleSchema>;

export const updateArticleSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    summary: z.string().trim().max(500).nullable().optional(),
    content: z.string().min(1).max(1_000_000).optional(),
    category_id: uuidSchema.nullable().optional(),
    tags: z.array(uuidSchema).max(20).optional(),
    source: z.string().trim().max(255).nullable().optional(),
    language: z.string().trim().min(2).max(10).optional(),
    status: articleStatusSchema.optional(),
    published_at: dateStringSchema.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'au moins un champ requis');
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;

export const articleStatusTransitionSchema = z.object({
  status: articleStatusSchema,
});
export type ArticleStatusTransitionInput = z.infer<typeof articleStatusTransitionSchema>;

export const ADMIN_ARTICLE_SORT_FIELDS = ['created_at', 'updated_at', 'published_at', 'title'] as const;
export type AdminArticleSortField = (typeof ADMIN_ARTICLE_SORT_FIELDS)[number];

export const adminArticleQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  status: articleStatusSchema.optional(),
  category_id: uuidSchema.optional(),
  author_id: uuidSchema.optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  sort: z.enum(ADMIN_ARTICLE_SORT_FIELDS).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type AdminArticleQuery = z.infer<typeof adminArticleQuerySchema>;

export const PUBLIC_ARTICLE_SORT_FIELDS = ['published_at', 'created_at', 'title'] as const;
export type PublicArticleSortField = (typeof PUBLIC_ARTICLE_SORT_FIELDS)[number];

/** GET /api/articles — filtre `category`/`tag` par slug (URL-friendly). */
export const publicArticleQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  category: z.string().trim().max(80).optional(),
  tag: z.string().trim().max(80).optional(),
  sort: z.enum(PUBLIC_ARTICLE_SORT_FIELDS).default('published_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type PublicArticleQuery = z.infer<typeof publicArticleQuerySchema>;

export const slugParamSchema = z.string().trim().min(1).max(80);
