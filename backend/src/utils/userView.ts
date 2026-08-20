import type { Role, UserStatus } from '../generated/prisma/enums.ts';
import type { AuthUser } from '../types/auth.ts';

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  role: Role;
  status: UserStatus;
  first_name: string | null;
  last_name: string | null;
  last_login_at: Date | null;
  created_at: Date;
}

type PublicUserInput = PublicUser;

/** Ne retourne JAMAIS password_hash ni données internes. */
export function toPublicUser(user: PublicUserInput): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status,
    first_name: user.first_name,
    last_name: user.last_name,
    last_login_at: user.last_login_at,
    created_at: user.created_at,
  };
}

export function toAuthUser(user: AuthUser): AuthUser {
  return user;
}
