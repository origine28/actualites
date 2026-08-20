import { Prisma } from '../generated/prisma/client.ts';
import { loginLogRepository } from '../repositories/loginLog.repository.ts';
import { userRepository } from '../repositories/user.repository.ts';
import type { AuthUser, ClientInfo } from '../types/auth.ts';
import type { LoginLog } from '../types/prisma.ts';
import { ApiError } from '../utils/errors.ts';
import { toPublicUser } from '../utils/userView.ts';
import type {
  ListUsersQuery,
  LoginHistoryQuery,
} from '../validators/user.validators.ts';
import { auditService } from './audit.service.ts';
import { hashPassword } from './password.service.ts';
import { sessionService } from './session.service.ts';
import { userService } from './user.service.ts';

export interface ActorContext {
  admin: AuthUser;
  clientInfo: ClientInfo;
}

export interface CreateUserData {
  username: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  password: string;
  role: 'USER' | 'ADMIN';
}

export interface UpdateUserData {
  username: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: 'USER' | 'ADMIN';
}

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  );
}

function pagination(page: number, pageSize: number, total: number) {
  return {
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

function toLoginLogView(log: LoginLog) {
  return {
    id: log.id,
    username: log.username,
    created_at: log.created_at,
    ip: log.ip,
    source_port: log.source_port,
    result: log.result,
    access_type: log.access_type,
    user_agent: log.user_agent,
    // Jamais le session_id complet : version tronquée uniquement si utile.
    session_id_masked: log.session_id ? `${log.session_id.slice(0, 8)}...` : null,
  };
}

/**
 * Gestion des utilisateurs par l'ADMIN. Toutes les opérations sensibles
 * produisent un audit log. Aucun mot de passe n'est jamais journalisé ni
 * retourné. L'IP provient exclusivement de la chaîne de confiance
 * (req.clientInfo), jamais d'un champ fourni par le client.
 */
export const adminService = {
  async listUsers(query: ListUsersQuery) {
    const { data, total } = await userRepository.list(query);
    return {
      data: data.map((u) => toPublicUser(u)),
      pagination: pagination(query.page, query.pageSize, total),
    };
  },

  async createUser(ctx: ActorContext, data: CreateUserData) {
    const username = data.username.trim().toLowerCase();
    const email = data.email.trim().toLowerCase();

    if (await userRepository.findByUsername(username)) {
      throw new ApiError(409, 'USERNAME_TAKEN', 'Nom d utilisateur deja utilise');
    }
    if (await userRepository.findByEmail(email)) {
      throw new ApiError(409, 'EMAIL_TAKEN', 'Adresse email deja utilisee');
    }

    const passwordHash = await hashPassword(data.password);
    try {
      const created = await userRepository.create({
        username,
        email,
        password_hash: passwordHash,
        role: data.role,
        first_name: data.firstName ?? null,
        last_name: data.lastName ?? null,
      });

      await auditService.userCreated(
        ctx.admin.id,
        created.id,
        { username: created.username, email: created.email, role: created.role },
        { userId: ctx.admin.id, ip: ctx.clientInfo.ip, userAgent: ctx.clientInfo.userAgent },
      );

      return toPublicUser(created);
    } catch (err) {
      // Course d'insertion : contrainte unique gérée par la base.
      if (isUniqueViolation(err)) {
        throw new ApiError(409, 'CONFLICT', 'Nom d utilisateur ou email deja utilise');
      }
      throw err;
    }
  },

  async updateUser(ctx: ActorContext, targetId: string, data: UpdateUserData) {
    const target = await userRepository.findById(targetId);
    if (!target || target.deleted_at !== null) {
      throw new ApiError(404, 'NOT_FOUND', 'Utilisateur introuvable');
    }

    const username = data.username.trim().toLowerCase();
    const email = data.email.trim().toLowerCase();

    if (username !== target.username && (await userRepository.findByUsername(username))) {
      throw new ApiError(409, 'USERNAME_TAKEN', 'Nom d utilisateur deja utilise');
    }
    if (email !== target.email && (await userRepository.findByEmail(email))) {
      throw new ApiError(409, 'EMAIL_TAKEN', 'Adresse email deja utilisee');
    }

    // Auto-élévation impossible : un ADMIN ne peut pas modifier son propre rôle.
    if (target.id === ctx.admin.id && data.role !== target.role) {
      throw new ApiError(409, 'SELF_ROLE_CHANGE', 'Un administrateur ne peut pas modifier son propre role');
    }

    // Dernier ADMIN protégé : rétrograder le dernier ADMIN actif est refusé.
    if (target.role === 'ADMIN' && target.status === 'ACTIVE' && data.role !== 'ADMIN') {
      const others = await userRepository.countActiveAdmins(target.id);
      if (others === 0) {
        throw new ApiError(409, 'LAST_ADMIN', 'Il doit rester au moins un administrateur actif');
      }
    }

    const changedFields: string[] = [];
    if (username !== target.username) changedFields.push('username');
    if (email !== target.email) changedFields.push('email');
    if (data.firstName !== target.first_name) changedFields.push('firstName');
    if (data.lastName !== target.last_name) changedFields.push('lastName');
    if (data.role !== target.role) changedFields.push('role');

    const updated = await userRepository.update(targetId, {
      username,
      email,
      first_name: data.firstName ?? null,
      last_name: data.lastName ?? null,
      role: data.role,
    });

    await auditService.userUpdated(
      ctx.admin.id,
      targetId,
      { username: updated.username, changedFields },
      { userId: ctx.admin.id, ip: ctx.clientInfo.ip, userAgent: ctx.clientInfo.userAgent },
    );

    return toPublicUser(updated);
  },

  async setStatus(ctx: ActorContext, targetId: string, status: 'ACTIVE' | 'DISABLED') {
    const target = await userRepository.findById(targetId);
    if (!target || target.deleted_at !== null) {
      throw new ApiError(404, 'NOT_FOUND', 'Utilisateur introuvable');
    }
    if (target.status === status) {
      throw new ApiError(
        409,
        status === 'DISABLED' ? 'ALREADY_DISABLED' : 'ALREADY_ACTIVE',
        status === 'DISABLED' ? 'Utilisateur deja desactive' : 'Utilisateur deja actif',
      );
    }

    if (status === 'DISABLED') {
      await userService.disableUser(targetId, ctx.admin, ctx.clientInfo);
    } else {
      await userService.enableUser(targetId, ctx.admin, ctx.clientInfo);
    }

    const updated = await userRepository.findById(targetId);
    return toPublicUser(updated!);
  },

  async resetPassword(ctx: ActorContext, targetId: string, password: string) {
    const target = await userRepository.findById(targetId);
    if (!target || target.deleted_at !== null) {
      throw new ApiError(404, 'NOT_FOUND', 'Utilisateur introuvable');
    }

    const passwordHash = await hashPassword(password);
    await userRepository.updatePasswordHash(targetId, passwordHash);
    const revoked = await sessionService.revokeAllUserSessions(targetId);

    await auditService.userPasswordReset(
      ctx.admin.id,
      targetId,
      { username: target.username, sessionsRevoked: revoked },
      { userId: ctx.admin.id, ip: ctx.clientInfo.ip, userAgent: ctx.clientInfo.userAgent },
    );
  },

  async getUserLoginHistory(targetId: string, query: LoginHistoryQuery) {
    const target = await userRepository.findById(targetId);
    if (!target || target.deleted_at !== null) {
      throw new ApiError(404, 'NOT_FOUND', 'Utilisateur introuvable');
    }

    const { data, total } = await loginLogRepository.list({
      page: query.page,
      pageSize: query.pageSize,
      userId: targetId,
      result: query.result,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });

    return {
      data: data.map(toLoginLogView),
      pagination: pagination(query.page, query.pageSize, total),
    };
  },

  async getGlobalLoginHistory(query: LoginHistoryQuery) {
    const { data, total } = await loginLogRepository.list({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      result: query.result,
      accessType: query.accessType,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });

    return {
      data: data.map(toLoginLogView),
      pagination: pagination(query.page, query.pageSize, total),
    };
  },
};

export type AdminService = typeof adminService;
