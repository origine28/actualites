import axios from 'axios';
import { useAuthStore } from '../store/authStore.ts';
import type { User } from '../types/auth.ts';

const api = axios.create({
  baseURL: '/api',
  headers: { Accept: 'application/json' },
});

const SAFE_METHODS = new Set(['get', 'head', 'options']);

api.interceptors.request.use((config) => {
  const method = (config.method ?? 'get').toLowerCase();
  if (!SAFE_METHODS.has(method)) {
    const token = readCsrfToken();
    if (token) {
      config.headers['X-CSRF-Token'] = token;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      useAuthStore.getState().clearAuth();
    }
    return Promise.reject(error);
  },
);

function readCsrfToken(): string {
  const match = document.cookie.match(/(?:^|; )news\.csrf=([^;]+)/);
  if (!match) return '';
  return match[1].split('.')[0];
}

export interface HealthResponse {
  status: string;
}

export interface CsrfResponse {
  csrfToken: string;
}

export async function getHealth(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>('/health');
  return data;
}

export async function getCsrfToken(): Promise<string> {
  const { data } = await api.get<CsrfResponse>('/auth/csrf');
  return data.csrfToken;
}

export async function login(username: string, password: string): Promise<User> {
  const { data } = await api.post<{ user: User }>('/auth/login', { username, password });
  return data.user;
}

export async function getMe(): Promise<User> {
  const { data } = await api.get<{ user: User }>('/auth/me');
  return data.user;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

export default api;
