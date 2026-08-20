import { z } from 'zod';
import { VARIANT_NAMES } from '../utils/image.ts';

const dateStringSchema = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'date invalide')
  .transform((v) => new Date(v));

const uuidSchema = z.string().uuid('uuid invalide');

// ---------------------------------------------------------------------------
// Vidéos
// ---------------------------------------------------------------------------

export const videoStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
export type VideoStatusValue = z.infer<typeof videoStatusSchema>;

export const videoPlatformSchema = z.enum(['YOUTUBE', 'VIMEO']);

export const createVideoSchema = z.object({
  title: z.string().trim().min(3, 'titre requis (3 caracteres minimum)').max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  url: z.string().url('url invalide').max(2048),
  thumbnail_image_id: uuidSchema.nullable().optional(),
  category_id: uuidSchema.nullable().optional(),
  status: videoStatusSchema.default('DRAFT'),
  published_at: dateStringSchema.nullable().optional(),
});
export type CreateVideoInput = z.infer<typeof createVideoSchema>;

export const updateVideoSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    url: z.string().url('url invalide').max(2048).optional(),
    thumbnail_image_id: uuidSchema.nullable().optional(),
    category_id: uuidSchema.nullable().optional(),
    status: videoStatusSchema.optional(),
    published_at: dateStringSchema.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'au moins un champ requis');
export type UpdateVideoInput = z.infer<typeof updateVideoSchema>;

export const videoStatusTransitionSchema = z.object({
  status: videoStatusSchema,
});
export type VideoStatusTransitionInput = z.infer<typeof videoStatusTransitionSchema>;

export const VIDEO_SORT_FIELDS = ['created_at', 'updated_at', 'published_at', 'title'] as const;
export type VideoSortField = (typeof VIDEO_SORT_FIELDS)[number];

export const videoQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  status: videoStatusSchema.optional(),
  category_id: uuidSchema.optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  sort: z.enum(VIDEO_SORT_FIELDS).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type VideoQuery = z.infer<typeof videoQuerySchema>;

/** GET /api/videos — filtre `category` par slug (URL-friendly). */
export const publicVideoQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  category: z.string().trim().max(80).optional(),
  sort: z.enum(VIDEO_SORT_FIELDS).default('published_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type PublicVideoQuery = z.infer<typeof publicVideoQuerySchema>;

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

export const IMAGE_SORT_FIELDS = ['created_at', 'filename', 'size_bytes'] as const;
export type ImageSortField = (typeof IMAGE_SORT_FIELDS)[number];

export const imageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  sort: z.enum(IMAGE_SORT_FIELDS).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type ImageQuery = z.infer<typeof imageQuerySchema>;

export const updateImageAltSchema = z.object({
  alt: z.string().trim().max(200).default(''),
});
export type UpdateImageAltInput = z.infer<typeof updateImageAltSchema>;

/** Lecture d'un fichier : variante facultative, sinon l'original. */
export const imageVariantQuerySchema = z.object({
  variant: z.enum(VARIANT_NAMES).optional(),
});
export type ImageVariantQuery = z.infer<typeof imageVariantQuerySchema>;

// ---------------------------------------------------------------------------
// Galerie d'articles
// ---------------------------------------------------------------------------

export const attachImagesSchema = z.object({
  image_ids: z.array(uuidSchema).min(1, 'au moins une image').max(50),
});
export type AttachImagesInput = z.infer<typeof attachImagesSchema>;

export const reorderImagesSchema = z.object({
  image_ids: z.array(uuidSchema).max(50),
});
export type ReorderImagesInput = z.infer<typeof reorderImagesSchema>;

export const featuredImageSchema = z.object({
  image_id: uuidSchema.nullable(),
});
export type FeaturedImageInput = z.infer<typeof featuredImageSchema>;

export const imageIdParamSchema = uuidSchema;
