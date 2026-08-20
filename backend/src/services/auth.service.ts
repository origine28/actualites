import { loginLogRepository } from '../repositories/loginLog.repository.ts';
import { userRepository } from '../repositories/user.repository.ts';
import type { AuthUser, ClientInfo } from '../types/auth.ts';
import type { User } from '../types/prisma.ts';
import { toAuthUser } from '../utils/userView.ts';
import { auditService } from './audit.service.ts';
import { getDummyHash, verifyPassword } from './password.service.ts';
import { sessionService } from './session.service.ts';

export interface AuthServiceConfig {
  lockoutMaxAttempts: number;
  lockoutMinutes: number;
  sessionTtlMs: number;
}

export type LoginErrorCode = 'INVALID_CREDENTIALS' | 'ACCOUNT_LOCKED' | 'ACCOUNT_DISABLED';

export interface LoginInput {
  username: string;
  password: string;
  clientInfo: ClientInfo;
}

export type LoginOutcome =
  | { ok: true; user: AuthUser; sessionToken: string; sessionId: string }
  | { ok: false; code: LoginErrorCode };

export interface LogoutInput {
  sessionId: string;
  user: AuthUser;
  clientInfo: ClientInfo;
}

function accessTypeFor(user: User | null): 'ADMIN' | 'USER' {
  return user?.role === 'ADMIN' ? 'ADMIN' : 'USER';
}

export function createAuthService(config: AuthServiceConfig) {
  const lockoutMs = config.lockoutMinutes * 60 * 1000;

  async function recordFailure(user: User | null, username: string, ci: ClientInfo): Promise<void> {
    await loginLogRepository.create({
      user_id: user?.id ?? null,
      username,
      ip: ci.ip,
      source_port: ci.sourcePort,
      result: 'FAILURE',
      access_type: accessTypeFor(user),
      user_agent: ci.userAgent,
      session_id: null,
    });
    await auditService.loginFailure({
      userId: user?.id ?? null,
      metadata: { username },
      ip: ci.ip,
      userAgent: ci.userAgent,
    });
  }

  async function login(input: LoginInput): Promise<LoginOutcome> {
    const username = input.username.trim();
    const ci = input.clientInfo;
    const user = await userRepository.findActiveByUsername(username);

    if (user && user.locked_until && user.locked_until.getTime() > Date.now()) {
      await recordFailure(user, username, ci);
      return { ok: false, code: 'ACCOUNT_LOCKED' };
    }

    if (!user) {
      // Égalisation du temps de réponse : vérification Argon2id factice.
      await verifyPassword(input.password, await getDummyHash());
      await recordFailure(null, username, ci);
      return { ok: false, code: 'INVALID_CREDENTIALS' };
    }

    if (user.status === 'DISABLED') {
      // Égalisation du temps de réponse (compte désactivé ≠ réponse instantanée).
      await verifyPassword(input.password, await getDummyHash());
      await recordFailure(user, username, ci);
      return { ok: false, code: 'ACCOUNT_DISABLED' };
    }

    const valid = await verifyPassword(input.password, user.password_hash);
    if (!valid) {
      // Incrément atomique pour éviter les pertes de mise à jour (race condition).
      const attempts = await userRepository.incrementFailedAttempts(user.id);
      if (attempts >= config.lockoutMaxAttempts) {
        await userRepository.lock(user.id, new Date(Date.now() + lockoutMs));
      }
      await recordFailure(user, username, ci);
      return { ok: false, code: 'INVALID_CREDENTIALS' };
    }

    await userRepository.resetLoginFailures(user.id);
    await userRepository.touchLastLogin(user.id);

    const sessionToken = sessionService.generateToken();
    const session = await sessionService.createSession(
      user.id,
      sessionToken,
      { ip: ci.ip, userAgent: ci.userAgent },
      config.sessionTtlMs,
    );

    await loginLogRepository.create({
      user_id: user.id,
      username: user.username,
      ip: ci.ip,
      source_port: ci.sourcePort,
      result: 'SUCCESS',
      access_type: accessTypeFor(user),
      user_agent: ci.userAgent,
      session_id: session.id,
    });
    await auditService.loginSuccess(
      user.id,
      { username: user.username },
      { userId: user.id, ip: ci.ip, userAgent: ci.userAgent },
    );

    return { ok: true, user: toAuthUser(user), sessionToken, sessionId: session.id };
  }

  async function logout(input: LogoutInput): Promise<void> {
    await sessionService.revokeSession(input.sessionId);
    await loginLogRepository.create({
      user_id: input.user.id,
      username: input.user.username,
      ip: input.clientInfo.ip,
      source_port: input.clientInfo.sourcePort,
      result: 'LOGOUT',
      access_type: accessTypeFor({ role: input.user.role } as User),
      user_agent: input.clientInfo.userAgent,
      session_id: input.sessionId,
    });
    await auditService.logout(
      input.user.id,
      input.sessionId,
      { userId: input.user.id, ip: input.clientInfo.ip, userAgent: input.clientInfo.userAgent },
    );
  }

  return { login, logout };
}

export type AuthService = ReturnType<typeof createAuthService>;
