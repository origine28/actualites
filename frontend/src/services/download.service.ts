import type { ListResponse } from '../types/api.ts';
import type {
  CreateDownloadCategoryInput,
  CreateDownloadInput,
  DownloadCategoryView,
  DownloadQuery,
  DownloadView,
  UpdateDownloadCategoryInput,
  UpdateDownloadInput,
} from '../types/download.ts';
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

// ---------------------------------------------------------------------------
// Downloads (ADMIN)
// ---------------------------------------------------------------------------

export async function listDownloads(query: DownloadQuery = {}): Promise<ListResponse<DownloadView>> {
  const { data } = await api.get<ListResponse<DownloadView>>(`/admin/downloads${toQueryString(query)}`);
  return data;
}

export async function getDownload(id: string): Promise<DownloadView> {
  const { data } = await api.get<{ download: DownloadView }>(`/admin/downloads/${id}`);
  return data.download;
}

export async function createDownload(file: File, input: CreateDownloadInput): Promise<DownloadView> {
  const form = new FormData();
  form.append('file', file);
  form.append('data', JSON.stringify(input));
  const { data } = await api.post<{ download: DownloadView }>('/admin/downloads', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.download;
}

export async function updateDownload(id: string, input: UpdateDownloadInput): Promise<DownloadView> {
  const { data } = await api.put<{ download: DownloadView }>(`/admin/downloads/${id}`, input);
  return data.download;
}

export async function setDownloadStatus(id: string, status: string): Promise<DownloadView> {
  const { data } = await api.patch<{ download: DownloadView }>(`/admin/downloads/${id}/status`, { status });
  return data.download;
}

export async function deleteDownload(id: string): Promise<void> {
  await api.delete(`/admin/downloads/${id}`);
}

export async function replaceDownloadFile(id: string, file: File): Promise<DownloadView> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<{ download: DownloadView }>(`/admin/downloads/${id}/file`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.download;
}

// ---------------------------------------------------------------------------
// Download Categories (ADMIN)
// ---------------------------------------------------------------------------

export async function listDownloadCategories(): Promise<ListResponse<DownloadCategoryView>> {
  const { data } = await api.get<ListResponse<DownloadCategoryView>>('/admin/download-categories');
  return data;
}

export async function createDownloadCategory(input: CreateDownloadCategoryInput): Promise<DownloadCategoryView> {
  const { data } = await api.post<{ category: DownloadCategoryView }>('/admin/download-categories', input);
  return data.category;
}

export async function updateDownloadCategory(id: string, input: UpdateDownloadCategoryInput): Promise<DownloadCategoryView> {
  const { data } = await api.put<{ category: DownloadCategoryView }>(`/admin/download-categories/${id}`, input);
  return data.category;
}

export async function deleteDownloadCategory(id: string): Promise<void> {
  await api.delete(`/admin/download-categories/${id}`);
}

// ---------------------------------------------------------------------------
// Downloads (USER — public)
// ---------------------------------------------------------------------------

export async function listPublicDownloads(query: DownloadQuery = {}): Promise<ListResponse<DownloadView>> {
  const { data } = await api.get<ListResponse<DownloadView>>(`/downloads${toQueryString(query)}`);
  return data;
}

export async function downloadFile(id: string): Promise<void> {
  const a = document.createElement('a');
  a.href = `${api.defaults.baseURL}/downloads/${id}/file`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
