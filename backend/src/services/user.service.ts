import { userRepository } from '../repositories/user.repository.ts';
import type { AuthUser, ClientInfo } from '../types/auth.ts';
import { ApiError } from '../utils/errors.ts';
import { auditService } from './audit.service.ts';
import { sessionService } from './session.service.ts';

function assertNotLastActiveAdmin(targetId: string): Promise<void> {
  return (async () => {
    const others = await userRepository.countActiveAdmins(targetId);
    if (others === 0) {
      throw new ApiError(409, 'LAST_ADMIN', 'Il doit rester au moins un administrateur actif');
    }
  })();
}

/**
 * Cycle de vie d'un utilisateur (activation / désactivation).
 * Toutes les sessions sont réellement révoquées en base lors d'une
 * désactivation ; un compte désactivé ne peut plus se connecter.
 */
export const userService = {
  /**
   * Désactivation d'un utilisateur (ACTIVE → DISABLED) : toutes ses sessions
   * actives sont immédiatement révoquées. Le prochain accès reçoit 401 même si
   * le cookie existe encore. Le dernier ADMIN actif est protégé (409).
   */
  async disableUser(targetUserId: string, admin: AuthUser, clientInfo: ClientInfo): Promise<void> {
    const target = await userRepository.findById(targetUserId);
    if (!target) {
      throw new ApiError(404, 'NOT_FOUND', 'Utilisateur introuvable');
    }
    if (target.status === 'DISABLED') {
      throw new ApiError(409, 'ALREADY_DISABLED', 'Utilisateur deja desactive');
    }
    if (target.role === 'ADMIN') {
      await assertNotLastActiveAdmin(targetUserId);
    }

    await userRepository.setStatus(targetUserId, 'DISABLED');
    const count = await sessionService.revokeAllUserSessions(targetUserId);

    await auditService.userDisabled(
      admin.id,
      targetUserId,
      { username: target.username },
      { userId: admin.id, ip: clientInfo.ip, userAgent: clientInfo.userAgent },
    );
    if (count > 0) {
      await auditService.sessionRevoked(
        admin.id,
        targetUserId,
        count,
        { userId: admin.id, ip: clientInfo.ip, userAgent: clientInfo.userAgent },
      );
    }
  },

  /** Réactivation (DISABLED → ACTIVE) : le compteur d'échecs est remis à zéro. */
  async enableUser(targetUserId: string, admin: AuthUser, clientInfo: ClientInfo): Promise<void> {
    const target = await userRepository.findById(targetUserId);
    if (!target) {
      throw new ApiError(404, 'NOT_FOUND', 'Utilisateur introuvable');
    }
    if (target.status === 'ACTIVE') {
      throw new ApiError(409, 'ALREADY_ACTIVE', 'Utilisateur deja actif');
    }

    await userRepository.setStatus(targetUserId, 'ACTIVE');
    await userRepository.resetLoginFailures(targetUserId);

    await auditService.userEnabled(
      admin.id,
      targetUserId,
      { username: target.username },
      { userId: admin.id, ip: clientInfo.ip, userAgent: clientInfo.userAgent },
    );
  },
};
