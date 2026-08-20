export type Role = 'ADMIN' | 'USER';

export type UserStatus = 'ACTIVE' | 'DISABLED';

export interface User {
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
