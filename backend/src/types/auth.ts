import type { Role, UserStatus } from '../generated/prisma/enums.ts';

export interface AuthUser {
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

export interface AuthSession {
  id: string;
  user_id: string;
  ip: string | null;
  user_agent: string | null;
  created_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
}

export interface AuthContext {
  user: AuthUser;
  session: AuthSession;
}

export interface ClientInfo {
  ip: string;
  sourcePort: number | null;
  userAgent: string;
}
