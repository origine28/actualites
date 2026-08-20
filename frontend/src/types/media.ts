import type { ListQuery } from './api.ts';
import type { AuthorRef, CategoryRef } from './content.ts';

export type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif';
export type ImageVariant = 'thumb' | 'medium' | 'large';

export type VideoPlatform = 'YOUTUBE' | 'VIMEO';
export type VideoStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface ImageView {
  id: string;
  original_name: string;
  mime_type: ImageMimeType;
  size_bytes: number;
  width: number;
  height: number;
  sha256: string;
  alt: string;
  url: string;
  urls: {
    original: string;
    thumb: string;
    medium: string;
    large: string;
  };
  created_at: string;
  updated_at: string;
}

export interface GalleryItemView {
  position: number;
  image: ImageView;
}

export interface VideoView {
  id: string;
  title: string;
  description: string | null;
  platform: VideoPlatform;
  external_id: string;
  url: string;
  thumbnail: ImageView | null;
  category: CategoryRef | null;
  author: AuthorRef;
  status: VideoStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImageQuery extends ListQuery {
  sort?: 'created_at' | 'filename' | 'size_bytes';
}

export interface VideoQuery extends ListQuery {
  status?: VideoStatus;
  category_id?: string;
}

export interface CreateVideoInput {
  title: string;
  description?: string | null;
  url: string;
  thumbnail_image_id?: string | null;
  category_id?: string | null;
  status?: VideoStatus;
  published_at?: string | null;
}

export interface UpdateVideoInput {
  title?: string;
  description?: string | null;
  url?: string;
  thumbnail_image_id?: string | null;
  category_id?: string | null;
  status?: VideoStatus;
  published_at?: string | null;
}
