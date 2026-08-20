import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attachArticleImages,
  createVideo,
  deleteImage,
  deleteVideo,
  detachArticleImage,
  listImages,
  listVideos,
  reorderArticleImages,
  setArticleFeatured,
  setVideoStatus,
  updateImageAlt,
  updateVideo,
  uploadImage,
} from '../../src/services/media.service.ts';
import api from '../../src/services/api.ts';

vi.mock('../../src/services/api.ts', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('media.service — images', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('liste les images avec la query string construite', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [], pagination: { page: 1, pageSize: 24, total: 0, totalPages: 0 } } });
    await listImages({ search: 'banniere', page: 2, pageSize: 24 });
    expect(api.get).toHaveBeenCalledWith('/admin/images?search=banniere&page=2&pageSize=24');
  });

  it('omet les filtres vides de la query string', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [], pagination: { page: 1, pageSize: 24, total: 0, totalPages: 0 } } });
    await listImages({});
    expect(api.get).toHaveBeenCalledWith('/admin/images');
  });

  it('uploade via FormData (champ image) sans requête JSON', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { image: { id: 'i-1' } } });
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    const image = await uploadImage(file);
    expect(image.id).toBe('i-1');
    expect(api.post).toHaveBeenCalledTimes(1);
    const [, form] = vi.mocked(api.post).mock.calls[0] as unknown as [string, FormData];
    expect(form.get('image')).toBe(file);
  });

  it('met à jour le texte alternatif et supprime une image', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { image: { id: 'i-1', alt: 'Nouveau' } } });
    await updateImageAlt('i-1', 'Nouveau');
    expect(api.patch).toHaveBeenCalledWith('/admin/images/i-1', { alt: 'Nouveau' });

    vi.mocked(api.delete).mockResolvedValue({});
    await deleteImage('i-1');
    expect(api.delete).toHaveBeenCalledWith('/admin/images/i-1');
  });

  it('gère la galerie : attache, détache, réordonne, image principale', async () => {
    const images = [{ position: 0, image: { id: 'a' } }];
    vi.mocked(api.post).mockResolvedValue({ data: { images } });
    vi.mocked(api.delete).mockResolvedValue({ data: { images: [] } });
    vi.mocked(api.put).mockResolvedValue({ data: { images } });
    vi.mocked(api.put).mockResolvedValueOnce({ data: { images } });

    await attachArticleImages('a1', ['i1']);
    expect(api.post).toHaveBeenCalledWith('/admin/articles/a1/images', { image_ids: ['i1'] });

    await detachArticleImage('a1', 'i1');
    expect(api.delete).toHaveBeenCalledWith('/admin/articles/a1/images/i1');

    await reorderArticleImages('a1', ['i1', 'i2']);
    expect(api.put).toHaveBeenCalledWith('/admin/articles/a1/images/order', { image_ids: ['i1', 'i2'] });

    await setArticleFeatured('a1', 'i1');
    expect(api.put).toHaveBeenCalledWith('/admin/articles/a1/featured-image', { image_id: 'i1' });

    await setArticleFeatured('a1', null);
    expect(api.put).toHaveBeenCalledWith('/admin/articles/a1/featured-image', { image_id: null });
  });
});

describe('media.service — vidéos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('liste les vidéos avec filtre de statut', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [], pagination: { page: 1, pageSize: 12, total: 0, totalPages: 0 } } });
    await listVideos({ status: 'PUBLISHED', page: 1 });
    expect(api.get).toHaveBeenCalledWith('/admin/videos?status=PUBLISHED&page=1');
  });

  it('crée une vidéo avec le body attendu', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { video: { id: 'v1' } } });
    await createVideo({ title: 'Mon film', url: 'https://youtu.be/dQw4w9WgXcQ', status: 'PUBLISHED' });
    expect(api.post).toHaveBeenCalledWith('/admin/videos', {
      title: 'Mon film',
      url: 'https://youtu.be/dQw4w9WgXcQ',
      status: 'PUBLISHED',
    });
  });

  it('met à jour et change le statut', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { video: { id: 'v1' } } });
    vi.mocked(api.patch).mockResolvedValue({ data: { video: { id: 'v1', status: 'ARCHIVED' } } });
    vi.mocked(api.delete).mockResolvedValue({});

    await updateVideo('v1', { title: 'Renommée' });
    expect(api.put).toHaveBeenCalledWith('/admin/videos/v1', { title: 'Renommée' });

    await setVideoStatus('v1', 'ARCHIVED');
    expect(api.patch).toHaveBeenCalledWith('/admin/videos/v1/status', { status: 'ARCHIVED' });

    await deleteVideo('v1');
    expect(api.delete).toHaveBeenCalledWith('/admin/videos/v1');
  });
});
