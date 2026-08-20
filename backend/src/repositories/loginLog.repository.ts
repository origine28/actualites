import { prisma } from '../db/client.ts';
import type { AccessType, LoginResult } from '../generated/prisma/enums.ts';

export interface CreateLoginLogInput {
  user_id: string | null;
  username: string;
  ip: string | null;
  source_port: number | null;
  result: LoginResult;
  access_type: AccessType;
  user_agent: string | null;
  session_id: string | null;
}

export interface ListLoginLogsQuery {
  page: number;
  pageSize: number;
  /** Filtre sur le user_id (historique d'un utilisateur). */
  userId?: string;
  /** Recherche insensible à la casse sur le username journalisé. */
  search?: string;
  result?: LoginResult;
  accessType?: AccessType;
  from?: Date;
  to?: Date;
}

export const loginLogRepository = {
  create(input: CreateLoginLogInput) {
    return prisma.loginLog.create({ data: input });
  },

  async list(query: ListLoginLogsQuery) {
    const { page, pageSize, userId, search, result, accessType, from, to } = query;

    const where = {
      ...(userId ? { user_id: userId } : {}),
      ...(search ? { username: { contains: search, mode: 'insensitive' as const } } : {}),
      ...(result ? { result } : {}),
      ...(accessType ? { access_type: accessType } : {}),
      ...(from || to
        ? {
            created_at: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.loginLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.loginLog.count({ where }),
    ]);
    return { data, total };
  },
};
