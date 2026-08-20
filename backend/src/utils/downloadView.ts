import type { DownloadStatus, DownloadPlatform, DownloadType } from '../generated/prisma/enums.ts';
import type { AuthorRef } from './contentView.ts';

export interface DownloadCategoryView {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export function toDownloadCategoryView(cat: {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}): DownloadCategoryView {
  return {
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    sort_order: cat.sort_order,
    status: cat.status,
    created_at: cat.created_at,
    updated_at: cat.updated_at,
  };
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
  download_category: DownloadCategoryView | null;
  author: AuthorRef;
  status: DownloadStatus;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** Ligne Download telle que retournée par le repository. */
export interface DownloadRow {
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
  download_category: { id: string; name: string; slug: string } | null;
  author_id: string;
  author: AuthorRef;
  status: DownloadStatus;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export function toDownloadView(row: DownloadRow): DownloadView {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    type: row.type,
    platform: row.platform,
    version: row.version,
    filename: row.filename,
    original_name: row.original_name,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    sha256: row.sha256,
    download_category_id: row.download_category_id,
    download_category: row.download_category
      ? { id: row.download_category.id, name: row.download_category.name, slug: row.download_category.slug, sort_order: 0, status: 'ACTIVE', created_at: new Date(), updated_at: new Date() }
      : null,
    author: row.author,
    status: row.status,
    published_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
