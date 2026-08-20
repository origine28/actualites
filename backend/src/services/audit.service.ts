import { Prisma } from '../generated/prisma/client.ts';
import { auditLogRepository, type AuditTx } from '../repositories/auditLog.repository.ts';

export interface AuditBaseInput {
  userId: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuditRecordInput extends AuditBaseInput {
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Prisma.InputJsonObject | null;
}

/** Journal d'audit. Jamais de mot de passe ni de token dans metadata. */
export const auditService = {
  /**
   * Enregistre un événement d'audit. `tx` optionnel : permet d'inscrire
   * l'audit dans la même transaction Prisma que l'opération métier.
   */
  async record(input: AuditRecordInput, tx?: AuditTx): Promise<void> {
    await auditLogRepository.create(
      {
        user_id: input.userId,
        action: input.action,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        metadata: input.metadata === undefined ? null : input.metadata,
        ip: input.ip ?? null,
        user_agent: input.userAgent ?? null,
      },
      tx,
    );
  },

  loginSuccess(userId: string, metadata: Prisma.InputJsonObject, input: AuditBaseInput) {
    return this.record({
      userId,
      action: 'LOGIN_SUCCESS',
      metadata,
      ip: input.ip,
      userAgent: input.userAgent,
    });
  },

  loginFailure(input: AuditBaseInput & { metadata?: Prisma.InputJsonObject | null }) {
    return this.record({
      userId: input.userId,
      action: 'LOGIN_FAILURE',
      metadata: input.metadata ?? null,
      ip: input.ip,
      userAgent: input.userAgent,
    });
  },

  logout(userId: string, sessionId: string, input: AuditBaseInput) {
    return this.record({
      userId,
      action: 'LOGOUT',
      entityType: 'session',
      entityId: sessionId,
      ip: input.ip,
      userAgent: input.userAgent,
    });
  },

  sessionRevoked(adminId: string, userId: string, count: number, input: AuditBaseInput) {
    return this.record({
      userId: adminId,
      action: 'SESSION_REVOKED',
      entityType: 'user',
      entityId: userId,
      metadata: { count },
      ip: input.ip,
      userAgent: input.userAgent,
    });
  },

  userDisabled(adminId: string, userId: string, metadata: Prisma.InputJsonObject, input: AuditBaseInput) {
    return this.record({
      userId: adminId,
      action: 'USER_DISABLED',
      entityType: 'user',
      entityId: userId,
      metadata,
      ip: input.ip,
      userAgent: input.userAgent,
    });
  },

  userEnabled(adminId: string, userId: string, metadata: Prisma.InputJsonObject, input: AuditBaseInput) {
    return this.record({
      userId: adminId,
      action: 'USER_ENABLED',
      entityType: 'user',
      entityId: userId,
      metadata,
      ip: input.ip,
      userAgent: input.userAgent,
    });
  },

  userCreated(adminId: string, userId: string, metadata: Prisma.InputJsonObject, input: AuditBaseInput) {
    return this.record({
      userId: adminId,
      action: 'USER_CREATED',
      entityType: 'user',
      entityId: userId,
      metadata,
      ip: input.ip,
      userAgent: input.userAgent,
    });
  },

  userUpdated(adminId: string, userId: string, metadata: Prisma.InputJsonObject, input: AuditBaseInput) {
    return this.record({
      userId: adminId,
      action: 'USER_UPDATED',
      entityType: 'user',
      entityId: userId,
      metadata,
      ip: input.ip,
      userAgent: input.userAgent,
    });
  },

  /** Jamais de mot de passe dans metadata. */
  userPasswordReset(adminId: string, userId: string, metadata: Prisma.InputJsonObject, input: AuditBaseInput) {
    return this.record({
      userId: adminId,
      action: 'USER_PASSWORD_RESET',
      entityType: 'user',
      entityId: userId,
      metadata,
      ip: input.ip,
      userAgent: input.userAgent,
    });
  },
};
