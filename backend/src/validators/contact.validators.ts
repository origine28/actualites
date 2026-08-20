import { z } from 'zod';

// ---------------------------------------------------------------------------
// Contact Messages
// ---------------------------------------------------------------------------

export const contactMessageStatusSchema = z.enum(['NEW', 'READ', 'REPLIED', 'ARCHIVED']);
export type ContactMessageStatusValue = z.infer<typeof contactMessageStatusSchema>;

export const createContactMessageSchema = z.object({
  name: z.string().trim().min(1, 'nom requis').max(100),
  email: z.string().trim().email('adresse email invalide').max(255),
  subject: z.string().trim().min(1, 'sujet requis').max(200),
  message: z.string().trim().min(10, 'message trop court (10 caracteres minimum)').max(5000),
});
export type CreateContactMessageInput = z.infer<typeof createContactMessageSchema>;

export const contactStatusTransitionSchema = z.object({
  status: contactMessageStatusSchema,
});
export type ContactStatusTransitionInput = z.infer<typeof contactStatusTransitionSchema>;

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

export const CONTACT_SORT_FIELDS = ['created_at', 'updated_at', 'name', 'email', 'subject'] as const;
export type ContactSortField = (typeof CONTACT_SORT_FIELDS)[number];

export const contactMessageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  status: contactMessageStatusSchema.optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  sort: z.enum(CONTACT_SORT_FIELDS).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type ContactMessageQuery = z.infer<typeof contactMessageQuerySchema>;
