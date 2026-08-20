import { prisma } from '../db/client.ts';

export interface CreateSessionInput {
  user_id: string;
  token_hash: string;
  ip: string | null;
  user_agent: string | null;
  expires_at: Date;
}

export const sessionRepository = {
  create(input: CreateSessionInput) {
    return prisma.session.create({ data: input });
  },

  findByTokenHash(token_hash: string) {
    return prisma.session.findUnique({
      where: { token_hash },
      include: { user: true },
    });
  },

  findById(id: string) {
    return prisma.session.findUnique({ where: { id } });
  },

  revoke(id: string) {
    return prisma.session.update({ where: { id }, data: { revoked_at: new Date() } });
  },

  revokeAllForUser(user_id: string) {
    return prisma.session.updateMany({
      where: { user_id, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  },

  extend(id: string, expires_at: Date) {
    return prisma.session.update({ where: { id }, data: { expires_at } });
  },
};
