import type { User } from '../src/types/auth.ts';
import type { LoginHistoryEntry } from '../src/types/admin.ts';
import type { GalleryItemView, ImageView, VideoView } from '../src/types/media.ts';
import type { DownloadView, DownloadCategoryView } from '../src/types/download.ts';
import type { ContactMessageView } from '../src/types/contact.ts';

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u-1',
    username: 'alice',
    email: 'alice@example.fr',
    role: 'USER',
    status: 'ACTIVE',
    first_name: null,
    last_name: null,
    last_login_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

let loginLogSeq = 0;
export function makeLoginHistoryEntry(overrides: Partial<LoginHistoryEntry> = {}): LoginHistoryEntry {
  const id = overrides.id ?? `ll-${++loginLogSeq}`;
  return {
    id,
    username: 'alice',
    created_at: '2026-01-01T00:00:00.000Z',
    ip: '203.0.113.7',
    source_port: 54321,
    result: 'SUCCESS',
    access_type: 'USER',
    user_agent: 'Mozilla/5.0 (test)',
    session_id_masked: null,
    ...overrides,
  };
}

let imageSeq = 0;
export function makeImage(overrides: Partial<ImageView> = {}): ImageView {
  const id = overrides.id ?? `img-${++imageSeq}`;
  return {
    id,
    original_name: 'photo.png',
    mime_type: 'image/png',
    size_bytes: 1024,
    width: 800,
    height: 600,
    sha256: 'a'.repeat(64),
    alt: '',
    url: `/api/images/${id}`,
    urls: {
      original: `/api/images/${id}`,
      thumb: `/api/images/${id}?variant=thumb`,
      medium: `/api/images/${id}?variant=medium`,
      large: `/api/images/${id}?variant=large`,
    },
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeGalleryItem(image: ImageView, position: number): GalleryItemView {
  return { position, image };
}

let videoSeq = 0;
export function makeVideo(overrides: Partial<VideoView> = {}): VideoView {
  const id = overrides.id ?? `vid-${++videoSeq}`;
  return {
    id,
    title: 'Vidéo de test',
    description: null,
    platform: 'YOUTUBE',
    external_id: 'dQw4w9WgXcQ',
    url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    thumbnail: null,
    category: null,
    author: { id: 'u-1', username: 'alice', first_name: null, last_name: null },
    status: 'DRAFT',
    published_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

let downloadSeq = 0;
export function makeDownload(overrides: Partial<DownloadView> = {}): DownloadView {
  const id = overrides.id ?? `dl-${++downloadSeq}`;
  return {
    id,
    title: 'Fichier de test',
    slug: `fichier-de-test-${id}`,
    description: null,
    type: 'PDF',
    platform: 'WINDOWS',
    version: null,
    filename: `${id}.pdf`,
    original_name: 'fichier.pdf',
    mime_type: 'application/pdf',
    size_bytes: 2048,
    sha256: 'a'.repeat(64),
    download_category_id: null,
    download_category: null,
    author: { id: 'u-1', username: 'alice', first_name: null, last_name: null },
    status: 'DRAFT',
    published_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

let catSeq = 0;
export function makeDownloadCategory(overrides: Partial<DownloadCategoryView> = {}): DownloadCategoryView {
  const id = overrides.id ?? `cat-${++catSeq}`;
  return {
    id,
    name: 'Categorie test',
    slug: `categorie-test-${id}`,
    sort_order: 0,
    status: 'ACTIVE',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

let contactSeq = 0;
export function makeContactMessage(overrides: Partial<ContactMessageView> = {}): ContactMessageView {
  const id = overrides.id ?? `cm-${++contactSeq}`;
  return {
    id,
    name: 'Jean Dupont',
    email: 'jean@example.fr',
    subject: 'Question importante',
    message: 'Bonjour, j\'ai une question concernant vos services.',
    ip: '127.0.0.1',
    user_id: 'u-1',
    user: { id: 'u-1', username: 'alice', first_name: null, last_name: null },
    status: 'NEW',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
