import { prisma } from '../db/client.ts';
import type { Role, UserStatus } from '../generated/prisma/enums.ts';
import type { UserSortField } from '../validators/user.validators.ts';

export interface CreateUserInput {
  username: string;
  email: string;
  password_hash: string;
  role: Role;
  first_name?: string | null;
  last_name?: string | null;
}

export interface UpdateUserInput {
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: Role;
}

export interface ListUsersQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: UserStatus;
  role?: Role;
  sort: UserSortField;
  order: 'asc' | 'desc';
}

const SORT_COLUMN: Record<UserSortField, string> = {
  username: 'username',
  email: 'email',
  role: 'role',
  status: 'status',
  created_at: 'created_at',
  last_login_at: 'last_login_at',
};

export const userRepository = {
  findByUsername(username: string) {
    return prisma.user.findUnique({ where: { username } });
  },

  findActiveByUsername(username: string) {
    return prisma.user.findFirst({ where: { username, deleted_at: null } });
  },

  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  findFirstAdmin() {
    return prisma.user.findFirst({ where: { role: 'ADMIN', deleted_at: null } });
  },

  /** Nombre d'administrateurs ACTIVE (optionnellement hors d'un utilisateur donné). */
  countActiveAdmins(excludeId?: string) {
    return prisma.user.count({
      where: {
        role: 'ADMIN',
        status: 'ACTIVE',
        deleted_at: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  },

  create(input: CreateUserInput) {
    return prisma.user.create({
      data: {
        username: input.username,
        email: input.email,
        password_hash: input.password_hash,
        role: input.role,
        first_name: input.first_name ?? null,
        last_name: input.last_name ?? null,
      },
    });
  },

  update(id: string, input: UpdateUserInput) {
    return prisma.user.update({
      where: { id },
      data: {
        username: input.username,
        email: input.email,
        first_name: input.first_name,
        last_name: input.last_name,
        role: input.role,
      },
    });
  },

  updatePasswordHash(id: string, password_hash: string) {
    return prisma.user.update({ where: { id }, data: { password_hash } });
  },

  async list(query: ListUsersQuery) {
    const { page, pageSize, search, status, role, sort, order } = query;
    const where = {
      deleted_at: null,
      ...(status ? { status } : {}),
      ...(role ? { role } : {}),
      ...(search
        ? {
            OR: [
              { username: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { first_name: { contains: search, mode: 'insensitive' as const } },
              { last_name: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { [SORT_COLUMN[sort]]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);
    return { data, total };
  },

  async incrementFailedAttempts(id: string): Promise<number> {
    await prisma.user.update({
      where: { id },
      data: { failed_login_attempts: { increment: 1 } },
    });
    const updated = await prisma.user.findUnique({
      where: { id },
      select: { failed_login_attempts: true },
    });
    return updated?.failed_login_attempts ?? 0;
  },

  lock(id: string, until: Date) {
    return prisma.user.update({ where: { id }, data: { locked_until: until } });
  },

  resetLoginFailures(id: string) {
    return prisma.user.update({
      where: { id },
      data: { failed_login_attempts: 0, locked_until: null },
    });
  },

  touchLastLogin(id: string) {
    return prisma.user.update({ where: { id }, data: { last_login_at: new Date() } });
  },

  setStatus(id: string, status: UserStatus) {
    return prisma.user.update({ where: { id }, data: { status } });
  },
};
