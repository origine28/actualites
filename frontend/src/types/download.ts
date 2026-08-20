import type { ListQuery } from './api.ts';

export type DownloadType = 'PDF' | 'MOBILE' | 'DESKTOP';
export type DownloadPlatform = 'ANDROID' | 'IOS' | 'WINDOWS' | 'LINUX' | 'MACOS' | 'OTHER';
export type DownloadStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface DownloadCategoryRef {
  id: string;
  name: string;
  slug: string;
}

export interface AuthorRef {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
}

export interface DownloadView {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  type: DownloadType;
  platform: DownloadPlatform;
  version: string | null;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  download_category_id: string | null;
  download_category: DownloadCategoryRef | null;
  author: AuthorRef;
  status: DownloadStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DownloadCategoryView {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DownloadQuery extends ListQuery {
  status?: DownloadStatus;
  type?: DownloadType;
  platform?: DownloadPlatform;
  download_category_id?: string;
}

export interface CreateDownloadInput {
  title: string;
  description?: string | null;
  type: DownloadType;
  platform: DownloadPlatform;
  version?: string | null;
  download_category_id?: string | null;
  status?: DownloadStatus;
}

export interface UpdateDownloadInput {
  title?: string;
  description?: string | null;
  type?: DownloadType;
  platform?: DownloadPlatform;
  version?: string | null;
  download_category_id?: string | null;
}

export interface CreateDownloadCategoryInput {
  name: string;
  sort_order?: number;
  status?: string;
}

export interface UpdateDownloadCategoryInput {
  name?: string;
  sort_order?: number;
  status?: string;
}
