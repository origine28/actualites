import type { ListResponse } from '../types/api.ts';
import type {
  CreateVideoInput,
  GalleryItemView,
  ImageQuery,
  ImageView,
  UpdateVideoInput,
  VideoQuery,
  VideoStatus,
  VideoView,
} from '../types/media.ts';
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
// Images (bibliothèque)
// ---------------------------------------------------------------------------
export async function listImages(query: ImageQuery = {}): Promise<ListResponse<ImageView>> {
  const { data } = await api.get<ListResponse<ImageView>>(`/admin/images${toQueryString(query)}`);
  return data;
}

export async function uploadImage(file: File): Promise<ImageView> {
  const form = new FormData();
  form.append('image', file);
  const { data } = await api.post<{ image: ImageView }>('/admin/images', form);
  return data.image;
}

export async function updateImageAlt(id: string, alt: string): Promise<ImageView> {
  const { data } = await api.patch<{ image: ImageView }>(`/admin/images/${id}`, { alt });
  return data.image;
}

export async function deleteImage(id: string): Promise<void> {
  await api.delete(`/admin/images/${id}`);
}

// ---------------------------------------------------------------------------
// Galerie des articles
// ---------------------------------------------------------------------------
export async function getArticleGallery(articleId: string): Promise<GalleryItemView[]> {
  const { data } = await api.get<{ images: GalleryItemView[] }>(`/admin/articles/${articleId}/images`);
  return data.images;
}

export async function attachArticleImages(articleId: string, imageIds: string[]): Promise<GalleryItemView[]> {
  const { data } = await api.post<{ images: GalleryItemView[] }>(`/admin/articles/${articleId}/images`, {
    image_ids: imageIds,
  });
  return data.images;
}

export async function detachArticleImage(articleId: string, imageId: string): Promise<GalleryItemView[]> {
  const { data } = await api.delete<{ images: GalleryItemView[] }>(
    `/admin/articles/${articleId}/images/${imageId}`,
  );
  return data.images;
}

export async function reorderArticleImages(articleId: string, imageIds: string[]): Promise<GalleryItemView[]> {
  const { data } = await api.put<{ images: GalleryItemView[] }>(`/admin/articles/${articleId}/images/order`, {
    image_ids: imageIds,
  });
  return data.images;
}

export async function setArticleFeatured(articleId: string, imageId: string | null): Promise<ImageView | null> {
  const { data } = await api.put<{ featured_image: ImageView | null }>(
    `/admin/articles/${articleId}/featured-image`,
    { image_id: imageId },
  );
  return data.featured_image;
}

// ---------------------------------------------------------------------------
// Vidéos (administration)
// ---------------------------------------------------------------------------
export async function listVideos(query: VideoQuery = {}): Promise<ListResponse<VideoView>> {
  const { data } = await api.get<ListResponse<VideoView>>(`/admin/videos${toQueryString(query)}`);
  return data;
}

export async function getVideo(id: string): Promise<VideoView> {
  const { data } = await api.get<{ video: VideoView }>(`/admin/videos/${id}`);
  return data.video;
}

export async function createVideo(input: CreateVideoInput): Promise<VideoView> {
  const { data } = await api.post<{ video: VideoView }>('/admin/videos', input);
  return data.video;
}

export async function updateVideo(id: string, input: UpdateVideoInput): Promise<VideoView> {
  const { data } = await api.put<{ video: VideoView }>(`/admin/videos/${id}`, input);
  return data.video;
}

export async function setVideoStatus(id: string, status: VideoStatus): Promise<VideoView> {
  const { data } = await api.patch<{ video: VideoView }>(`/admin/videos/${id}/status`, { status });
  return data.video;
}

export async function deleteVideo(id: string): Promise<void> {
  await api.delete(`/admin/videos/${id}`);
}

export async function listPublicVideos(query: VideoQuery = {}): Promise<ListResponse<VideoView>> {
  const { data } = await api.get<ListResponse<VideoView>>(`/videos${toQueryString(query)}`);
  return data;
}
