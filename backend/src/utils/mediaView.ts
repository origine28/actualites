import type { VideoPlatform, VideoStatus } from '../generated/prisma/enums.ts';
import type { AuthorRef, CategoryRef } from './contentView.ts';

export const IMAGE_URL_BASE = '/api/images';

/** Ligne Image telle que retournée par les repositories. */
export interface ImageRow {
  id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  width: number;
  height: number;
  sha256: string;
  alt: string;
  created_at: Date;
  updated_at: Date;
}

export interface ImageView {
  id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  width: number;
  height: number;
  sha256: string;
  alt: string;
  /** URL de l'original. */
  url: string;
  /** URLs des variantes pré-générées (thumb/medium/large) + original. */
  urls: {
    original: string;
    thumb: string;
    medium: string;
    large: string;
  };
  created_at: Date;
  updated_at: Date;
}

export function imageUrl(id: string, variant?: string): string {
  return variant ? `${IMAGE_URL_BASE}/${id}?variant=${variant}` : `${IMAGE_URL_BASE}/${id}`;
}

export function toImageView(image: ImageRow): ImageView {
  return {
    id: image.id,
    original_name: image.original_name,
    mime_type: image.mime_type,
    size_bytes: image.size_bytes,
    width: image.width,
    height: image.height,
    sha256: image.sha256,
    alt: image.alt,
    url: imageUrl(image.id),
    urls: {
      original: imageUrl(image.id),
      thumb: imageUrl(image.id, 'thumb'),
      medium: imageUrl(image.id, 'medium'),
      large: imageUrl(image.id, 'large'),
    },
    created_at: image.created_at,
    updated_at: image.updated_at,
  };
}

export interface GalleryItemView {
  position: number;
  image: ImageView;
}

export function toGalleryItemView(row: { position: number; image: ImageRow }): GalleryItemView {
  return { position: row.position, image: toImageView(row.image) };
}

/** Ligne Video telle que retournée par le repository (relations incluses). */
export interface VideoRow {
  id: string;
  title: string;
  description: string | null;
  platform: VideoPlatform;
  external_id: string;
  url: string;
  thumbnail: ImageRow | null;
  category: CategoryRef | null;
  author: AuthorRef;
  status: VideoStatus;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface VideoView {
  id: string;
  title: string;
  description: string | null;
  platform: VideoPlatform;
  external_id: string;
  /** URL d'embed normalisée (iframe). */
  url: string;
  thumbnail: ImageView | null;
  category: CategoryRef | null;
  author: AuthorRef;
  status: VideoStatus;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export function toVideoView(video: VideoRow): VideoView {
  return {
    id: video.id,
    title: video.title,
    description: video.description,
    platform: video.platform,
    external_id: video.external_id,
    url: video.url,
    thumbnail: video.thumbnail ? toImageView(video.thumbnail) : null,
    category: video.category,
    author: video.author,
    status: video.status,
    published_at: video.published_at,
    created_at: video.created_at,
    updated_at: video.updated_at,
  };
}
