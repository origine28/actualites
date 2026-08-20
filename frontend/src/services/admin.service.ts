import type { ListResponse } from '../types/api.ts';
import type {
  CreateUserInput,
  LoginHistoryEntry,
  LoginHistoryQuery,
  UpdateUserInput,
  UserAdminQuery,
  UserAdminView,
} from '../types/admin.ts';
import api from './api.ts';

function toQueryString(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export async function listUsers(query: UserAdminQuery = {}): Promise<ListResponse<UserAdminView>> {
  const { data } = await api.get<ListResponse<UserAdminView>>(`/admin/users${toQueryString(query)}`);
  return data;
}

export async function createUser(input: CreateUserInput): Promise<UserAdminView> {
  const { data } = await api.post<{ user: UserAdminView }>('/admin/users', input);
  return data.user;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<UserAdminView> {
  const { data } = await api.put<{ user: UserAdminView }>(`/admin/users/${id}`, input);
  return data.user;
}

export async function setUserStatus(id: string, status: 'ACTIVE' | 'DISABLED'): Promise<UserAdminView> {
  const { data } = await api.patch<{ user: UserAdminView }>(`/admin/users/${id}/status`, { status });
  return data.user;
}

export async function resetPassword(id: string, password: string): Promise<void> {
  await api.post(`/admin/users/${id}/reset-password`, { password });
}

export async function getGlobalLoginHistory(query: LoginHistoryQuery = {}): Promise<ListResponse<LoginHistoryEntry>> {
  const { data } = await api.get<ListResponse<LoginHistoryEntry>>(`/admin/login-history${toQueryString(query)}`);
  return data;
}

export async function getUserLoginHistory(id: string, query: LoginHistoryQuery = {}): Promise<ListResponse<LoginHistoryEntry>> {
  const { data } = await api.get<ListResponse<LoginHistoryEntry>>(`/admin/users/${id}/login-history${toQueryString(query)}`);
  return data;
}
