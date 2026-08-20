import { z } from 'zod';

const dateStringSchema = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'date invalide')
  .transform((v) => new Date(v));

const uuidSchema = z.string().uuid('uuid invalide');

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const downloadTypeSchema = z.enum(['PDF', 'MOBILE', 'DESKTOP']);
export type DownloadTypeValue = z.infer<typeof downloadTypeSchema>;

export const downloadPlatformSchema = z.enum(['ANDROID', 'IOS', 'WINDOWS', 'LINUX', 'MACOS', 'OTHER']);
export type DownloadPlatformValue = z.infer<typeof downloadPlatformSchema>;

export const downloadStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
export type DownloadStatusValue = z.infer<typeof downloadStatusSchema>;

// ---------------------------------------------------------------------------
// Download Categories
// ---------------------------------------------------------------------------

export const createDownloadCategorySchema = z.object({
  name: z.string().trim().min(2, 'nom requis').max(100),
  sort_order: z.number().int().min(0).default(0),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});
export type CreateDownloadCategoryInput = z.infer<typeof createDownloadCategorySchema>;

export const updateDownloadCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    sort_order: z.number().int().min(0).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'au moins un champ requis');
export type UpdateDownloadCategoryInput = z.infer<typeof updateDownloadCategorySchema>;

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------

export const createDownloadSchema = z.object({
  title: z.string().trim().min(3, 'titre requis (3 caracteres minimum)').max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  type: downloadTypeSchema,
  platform: downloadPlatformSchema,
  version: z.string().trim().max(50).nullable().optional(),
  download_category_id: uuidSchema.nullable().optional(),
  status: downloadStatusSchema.default('DRAFT'),
  published_at: dateStringSchema.nullable().optional(),
});
export type CreateDownloadInput = z.infer<typeof createDownloadSchema>;

export const updateDownloadSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    type: downloadTypeSchema.optional(),
    platform: downloadPlatformSchema.optional(),
    version: z.string().trim().max(50).nullable().optional(),
    download_category_id: uuidSchema.nullable().optional(),
    published_at: dateStringSchema.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'au moins un champ requis');
export type UpdateDownloadInput = z.infer<typeof updateDownloadSchema>;

export const downloadStatusTransitionSchema = z.object({
  status: downloadStatusSchema,
});
export type DownloadStatusTransitionInput = z.infer<typeof downloadStatusTransitionSchema>;

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

export const DOWNLOAD_SORT_FIELDS = ['created_at', 'updated_at', 'published_at', 'title'] as const;
export type DownloadSortField = (typeof DOWNLOAD_SORT_FIELDS)[number];

export const downloadQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  status: downloadStatusSchema.optional(),
  type: downloadTypeSchema.optional(),
  platform: downloadPlatformSchema.optional(),
  download_category_id: uuidSchema.optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  sort: z.enum(DOWNLOAD_SORT_FIELDS).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type DownloadQuery = z.infer<typeof downloadQuerySchema>;

export const publicDownloadQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  type: downloadTypeSchema.optional(),
  platform: downloadPlatformSchema.optional(),
  download_category_id: uuidSchema.optional(),
  sort: z.enum(DOWNLOAD_SORT_FIELDS).default('published_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type PublicDownloadQuery = z.infer<typeof publicDownloadQuerySchema>;

// ---------------------------------------------------------------------------
// Download Categories Query
// ---------------------------------------------------------------------------

export const downloadCategoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(200).optional(),
});
export type DownloadCategoryQuery = z.infer<typeof downloadCategoryQuerySchema>;
