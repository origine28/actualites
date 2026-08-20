import type { ListQuery } from './api.ts';
import type { Role, UserStatus } from './auth.ts';

export interface UserAdminView {
  id: string;
  username: string;
  email: string;
  role: Role;
  status: UserStatus;
  first_name: string | null;
  last_name: string | null;
  last_login_at: string | null;
  created_at: string;
}

export interface UserAdminQuery extends ListQuery {
  status?: UserStatus;
  role?: Role;
  sort?: 'username' | 'email' | 'role' | 'status' | 'created_at' | 'last_login_at';
}

export interface CreateUserInput {
  username: string;
  email: string;
  password: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: Role;
}

export interface UpdateUserInput {
  username: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: Role;
}

export interface LoginHistoryEntry {
  id: string;
  username: string;
  created_at: string;
  ip: string;
  source_port: number | null;
  result: 'SUCCESS' | 'FAILURE' | 'LOGOUT';
  access_type: 'USER' | 'ADMIN';
  user_agent: string;
  session_id_masked: string | null;
}

export interface LoginHistoryQuery extends ListQuery {
  result?: 'SUCCESS' | 'FAILURE' | 'LOGOUT';
  accessType?: 'USER' | 'ADMIN';
  from?: string;
  to?: string;
}
