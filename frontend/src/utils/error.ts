import { isAxiosError } from 'axios';

export interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export function getApiErrorMessage(err: unknown, fallback = 'Une erreur est survenue'): string {
  if (isAxiosError<ApiErrorBody>(err) && err.response?.data?.error?.message) {
    return err.response.data.error.message;
  }
  return fallback;
}
