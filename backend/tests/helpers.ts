import 'dotenv/config';
import type { Express } from 'express';
import type { Response } from 'supertest';
import request from 'supertest';
import sharp from 'sharp';
import { createApp, type AppOptions } from '../src/app.ts';
import { prisma } from '../src/db/client.ts';
import type { ArticleStatus, UserStatus, VideoPlatform, VideoStatus } from '../src/generated/prisma/enums.ts';
import { hashPassword } from '../src/services/password.service.ts';
import { storageService } from '../src/storage/index.ts';
import type { Article, Category, Tag, User, Video } from '../src/types/prisma.ts';
import { slugify } from '../src/utils/slug.ts';

export const TEST_PASSWORD = 'TestP@ssw0rd!';

export function createTestApp(options: Partial<AppOptions> = {}): Express {
  return createApp({
    loginRateLimit: options.loginRateLimit ?? null,
    ...options,
  });
}

export interface CreatedUser {
  user: User;
  password: string;
}

export async function createUser(
  overrides: {
    username?: string;
    email?: string;
    password?: string;
    role?: 'ADMIN' | 'USER';
    status?: UserStatus;
  } = {},
): Promise<CreatedUser> {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const username = (overrides.username ?? `user_${suffix}`).toLowerCase();
  const email = overrides.email ?? `${username}@example.test`;
  const password = overrides.password ?? TEST_PASSWORD;
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      username,
      email,
      password_hash: passwordHash,
      role: overrides.role ?? 'USER',
      status: overrides.status ?? 'ACTIVE',
    },
  });
  return { user, password };
}

export async function cleanupUser(id: string): Promise<void> {
  await prisma.session.deleteMany({ where: { user_id: id } });
  await prisma.loginLog.deleteMany({ where: { user_id: id } });
  await prisma.auditLog.deleteMany({ where: { user_id: id } });
  await prisma.downloadLog.deleteMany({ where: { user_id: id } });
  // Article.author / Video.author sont Restrict : suppression du contenu AVANT l'utilisateur.
  await prisma.article.deleteMany({ where: { author_id: id } });
  await prisma.video.deleteMany({ where: { author_id: id } });
  await prisma.download.deleteMany({ where: { author_id: id } });
  await prisma.user.delete({ where: { id } });
}

function suffix(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function uniqueSlugFrom(base: string): string {
  return `${slugify(base)}-${suffix()}`.slice(0, 80);
}

export async function createCategory(
  overrides: {
    name?: string;
    slug?: string;
    parent_id?: string | null;
    sort_order?: number;
    status?: 'ACTIVE' | 'INACTIVE';
  } = {},
): Promise<Category> {
  const name = overrides.name ?? `Categorie ${suffix()}`;
  return prisma.category.create({
    data: {
      name,
      slug: overrides.slug ?? uniqueSlugFrom(name),
      parent_id: overrides.parent_id ?? null,
      sort_order: overrides.sort_order ?? 0,
      status: overrides.status ?? 'ACTIVE',
    },
  });
}

export async function createTag(
  overrides: {
    name?: string;
    slug?: string;
  } = {},
): Promise<Tag> {
  const name = overrides.name ?? `Tag ${suffix()}`;
  return prisma.tag.create({
    data: {
      name,
      slug: overrides.slug ?? uniqueSlugFrom(name),
    },
  });
}

export async function createArticle(
  overrides: {
    author_id: string;
    title?: string;
    slug?: string;
    summary?: string | null;
    content?: string;
    category_id?: string | null;
    status?: ArticleStatus;
    language?: string;
    published_at?: Date | null;
    tagIds?: string[];
  },
): Promise<Article> {
  const title = overrides.title ?? `Article ${suffix()}`;
  const status = overrides.status ?? 'DRAFT';
  return prisma.article.create({
    data: {
      title,
      slug: overrides.slug ?? uniqueSlugFrom(title),
      summary: overrides.summary ?? null,
      content: overrides.content ?? 'Contenu de test',
      category_id: overrides.category_id ?? null,
      author_id: overrides.author_id,
      status,
      language: overrides.language ?? 'fr',
      published_at:
        overrides.published_at ?? (status === 'PUBLISHED' ? new Date() : null),
      ...(overrides.tagIds && overrides.tagIds.length > 0
        ? { tags: { create: overrides.tagIds.map((tag_id) => ({ tag_id })) } }
        : {}),
    },
  });
}

export async function cleanupArticle(id: string): Promise<void> {
  await prisma.articleTag.deleteMany({ where: { article_id: id } });
  await prisma.article.delete({ where: { id } });
}

export async function cleanupTag(id: string): Promise<void> {
  await prisma.articleTag.deleteMany({ where: { tag_id: id } });
  await prisma.tag.delete({ where: { id } });
}

/** Supprime une catégorie : d'abord les articles puis les enfants (FK Restrict). */
export async function cleanupCategory(id: string): Promise<void> {
  await prisma.article.updateMany({ where: { category_id: id }, data: { category_id: null } });
  const children = await prisma.category.findMany({
    where: { parent_id: id },
    select: { id: true },
  });
  for (const child of children) {
    await cleanupCategory(child.id);
  }
  await prisma.category.delete({ where: { id } });
}

export interface CsrfContext {
  cookieHeader: string;
  token: string;
}

export async function fetchCsrf(app: Express, agent: request.Agent): Promise<CsrfContext> {
  const res = await agent.get('/api/auth/csrf');
  const setCookie = res.headers['set-cookie'];
  const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie ?? '');
  const match = cookieStr.match(/news\.csrf=([^;]+)/);
  return {
    cookieHeader: match ? `news.csrf=${match[1]}` : '',
    token: (res.body?.csrfToken as string) ?? '',
  };
}

export interface LoginResult {
  res: Response;
  agent: request.Agent;
  csrf: CsrfContext;
}

/** Login complet avec récupération du jeton CSRF (cookies persistés par l'agent). */
export async function loginAs(app: Express, username: string, password: string): Promise<LoginResult> {
  const agent = request.agent(app);
  const csrf = await fetchCsrf(app, agent);
  const res = await agent
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrf.token)
    .send({ username, password });
  return { res, agent, csrf };
}

// ---------------------------------------------------------------------------
// Médias (images / vidéos)
// ---------------------------------------------------------------------------

/** Génère un vrai PNG en mémoire (fixture d'upload). */
export function makePngBuffer(width = 40, height = 30): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

/** Génère un vrai JPEG en mémoire. */
export function makeJpegBuffer(width = 40, height = 30): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 0, g: 128, b: 255 },
    },
  })
    .jpeg()
    .toBuffer();
}

/** Génère un vrai WEBP en mémoire. */
export function makeWebpBuffer(width = 40, height = 30): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 10, g: 200, b: 120 },
    },
  })
    .webp()
    .toBuffer();
}

/** Upload API d'une image (multipart, CSRF inclus). */
export function uploadImage(
  app: Express,
  agent: request.Agent,
  csrf: CsrfContext,
  buffer: Buffer,
  filename = 'photo.png',
  contentType = 'image/png',
): Promise<Response> {
  return agent
    .post('/api/admin/images')
    .set('X-CSRF-Token', csrf.token)
    .attach('image', buffer, { filename, contentType });
}

export async function createVideo(
  overrides: {
    author_id: string;
    title?: string;
    platform?: VideoPlatform;
    external_id?: string;
    url?: string;
    category_id?: string | null;
    status?: VideoStatus;
    published_at?: Date | null;
  },
): Promise<Video> {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const platform = overrides.platform ?? 'YOUTUBE';
  const externalId = overrides.external_id ?? `yt_${suffix}`;
  const status = overrides.status ?? 'DRAFT';
  return prisma.video.create({
    data: {
      title: overrides.title ?? `Video ${suffix}`,
      platform,
      external_id: externalId,
      url: overrides.url ?? (platform === 'YOUTUBE' ? `https://www.youtube.com/embed/${externalId}` : `https://player.vimeo.com/video/${externalId}`),
      category_id: overrides.category_id ?? null,
      author_id: overrides.author_id,
      status,
      published_at:
        overrides.published_at ?? (status === 'PUBLISHED' ? new Date() : null),
    },
  });
}

export async function cleanupVideo(id: string): Promise<void> {
  await prisma.video.delete({ where: { id } });
}

/** Supprime une image : d'abord ses fichiers disque (via StorageService), puis la ligne DB. */
export async function cleanupImage(id: string): Promise<void> {
  const row = await prisma.image.findUnique({ where: { id } });
  if (!row) return;
  const keys: string[] = [row.path];
  if (row.variants && typeof row.variants === 'object') {
    for (const value of Object.values(row.variants as Record<string, unknown>)) {
      if (typeof value === 'string') keys.push(value);
    }
  }
  for (const key of keys) {
    try {
      await storageService.deleteFile(key);
    } catch {
      // best-effort : ligne DB déjà supprimée en dernier ressort
    }
  }
  await prisma.image.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Téléchargements
// ---------------------------------------------------------------------------

import { getDownloadStorage } from '../src/storage/downloadStorage.ts';

/** Génère un vrai PDF en mémoire (signature %PDF- + contenu minimal). */
export function makePdfBuffer(): Buffer {
  const content = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n170\n%%EOF';
  return Buffer.from(content, 'latin1');
}

/** Génère un buffer ZIP (PK\\x03\\x04) pour simuler APK/AAB/IPA. */
export function makeZipBuffer(): Buffer {
  const header = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
  const padding = Buffer.alloc(128, 0);
  return Buffer.concat([header, padding]);
}

/** Génère un buffer EXE (MZ header + PE signature). */
export function makeExeBuffer(): Buffer {
  const buf = Buffer.alloc(256, 0);
  // MZ header
  buf[0] = 0x4d; // M
  buf[1] = 0x5a; // Z
  // e_lfanew at offset 60 = 64
  buf.writeUInt32LE(64, 60);
  // PE signature at offset 64
  buf.writeUInt32LE(0x00004550, 64); // PE\0\0
  return buf;
}

/** Upload API d'un téléchargement (multipart, CSRF inclus). */
export function uploadDownload(
  app: Express,
  agent: request.Agent,
  csrf: CsrfContext,
  buffer: Buffer,
  filename: string,
  contentType: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return agent
    .post('/api/admin/downloads')
    .set('X-CSRF-Token', csrf.token)
    .field('data', JSON.stringify(body))
    .attach('file', buffer, { filename, contentType });
}

/** Supprime un téléchargement : fichier disque + ligne DB. */
export async function cleanupDownload(id: string): Promise<void> {
  const row = await prisma.download.findUnique({ where: { id } });
  if (row) {
    try {
      const storage = getDownloadStorage(row.type as 'PDF' | 'MOBILE' | 'DESKTOP');
      await storage.deleteFile(row.filename);
    } catch {
      // best-effort
    }
    await prisma.downloadLog.deleteMany({ where: { download_id: id } });
    await prisma.download.delete({ where: { id } });
  }
}

/** Supprime une catégorie de téléchargement. */
export async function cleanupDownloadCategory(id: string): Promise<void> {
  await prisma.download.updateMany({ where: { download_category_id: id }, data: { download_category_id: null } });
  await prisma.downloadCategory.delete({ where: { id } });
}
