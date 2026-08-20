import { Prisma } from '../generated/prisma/client.ts';
import { prisma } from '../db/client.ts';

export interface CreateAuditLogInput {
  user_id: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  ip?: string | null;
  user_agent?: string | null;
}

export type AuditTx = Prisma.TransactionClient;

export const auditLogRepository = {
  create(input: CreateAuditLogInput, tx: AuditTx = prisma) {
    return tx.auditLog.create({
      data: {
        user_id: input.user_id,
        action: input.action,
        entity_type: input.entity_type ?? null,
        entity_id: input.entity_id ?? null,
        metadata: input.metadata === null || input.metadata === undefined ? Prisma.DbNull : input.metadata,
        ip: input.ip ?? null,
        user_agent: input.user_agent ?? null,
      },
    });
  },
};
