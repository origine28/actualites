import { z } from 'zod';

/** Politique de mot de passe : 8+ caractères, minuscule, majuscule, chiffre. */
export const passwordSchema = z
  .string()
  .min(8, 'au moins 8 caracteres')
  .max(128)
  .regex(/[a-z]/, 'une minuscule requise')
  .regex(/[A-Z]/, 'une majuscule requise')
  .regex(/[0-9]/, 'un chiffre requis');

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'au moins 3 caracteres')
  .max(32, 'au maximum 32 caracteres')
  .toLowerCase()
  .regex(/^[a-z0-9_]+$/, 'caracteres autorises : a-z, 0-9, _');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('adresse email invalide')
  .max(255);

export const roleSchema = z.enum(['USER', 'ADMIN']);

export const firstNameSchema = z.string().trim().min(1).max(64).nullable().optional();
export const lastNameSchema = z.string().trim().min(1).max(64).nullable().optional();

/** POST /api/admin/users */
export const createUserSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  password: passwordSchema,
  role: roleSchema.default('USER'),
});

/** PUT /api/admin/users/:id — le mot de passe n'est JAMAIS modifié ici (action séparée). */
export const updateUserSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  role: roleSchema,
});

/** PATCH /api/admin/users/:id/status */
export const statusSchema = z.object({
  status: z.enum(['ACTIVE', 'DISABLED']),
});

/** POST /api/admin/users/:id/reset-password */
export const resetPasswordSchema = z.object({
  password: passwordSchema,
});

/** Tri contrôlé côté serveur : jamais un champ arbitraire. */
export const USER_SORT_FIELDS = [
  'username',
  'email',
  'role',
  'status',
  'created_at',
  'last_login_at',
] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];

/** GET /api/admin/users */
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  sort: z.enum(USER_SORT_FIELDS).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

/** GET /api/admin/users/:id/login-history et /api/admin/login-history */
export const loginHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  result: z.enum(['SUCCESS', 'FAILURE', 'LOGOUT']).optional(),
  accessType: z.enum(['USER', 'ADMIN']).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});
export type LoginHistoryQuery = z.infer<typeof loginHistoryQuerySchema>;

/** Un identifiant :id de route doit être un UUID valide. */
export const idParamSchema = z.string().uuid();
