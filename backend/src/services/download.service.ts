import { randomUUID } from 'node:crypto';
import { statSync } from 'node:fs';
import { Prisma } from '../generated/prisma/client.ts';
import { prisma } from '../db/client.ts';
import {
  downloadRepository,
  downloadCategoryRepository,
  downloadLogRepository,
  DOWNLOAD_SELECT,
  type DownloadTx,
} from '../repositories/download.repository.ts';
import { getDownloadStorage } from '../storage/downloadStorage.ts';
import type { ActorContext } from '../types/content.ts';
import { env } from '../config/env.ts';
import { ApiError } from '../utils/errors.ts';
import {
  extensionsForType,
  hasDoubleExtension,
  mimeForExtension,
  normalizeExtension,
  sha256Buffer,
  validateMagic,
} from '../utils/download.ts';
import { toDownloadView, toDownloadCategoryView, type DownloadView, type DownloadCategoryView } from '../utils/downloadView.ts';
import { pagination } from '../utils/pagination.ts';
import { slugify } from '../utils/slug.ts';
import type {
  CreateDownloadCategoryInput,
  CreateDownloadInput,
  DownloadQuery,
  PublicDownloadQuery,
  UpdateDownloadCategoryInput,
  UpdateDownloadInput,
} from '../validators/download.validators.ts';
import type { DownloadCategoryQuery } from '../validators/download.validators.ts';
import { auditService } from './audit.service.ts';
import type { DownloadType, DownloadPlatform, DownloadStatus } from '../generated/prisma/enums.ts';

async function fetchFullDownload(id: string, tx?: DownloadTx) {
  const client = tx ?? prisma;
  return client.download.findUnique({
    where: { id },
    select: DOWNLOAD_SELECT,
  });
}

// ---------------------------------------------------------------------------
// Téléchargements
// ---------------------------------------------------------------------------

export const downloadService = {
  async upload(ctx: ActorContext, file: Express.Multer.File | undefined, input: CreateDownloadInput): Promise<DownloadView> {
    if (!file) {
      throw new ApiError(400, 'NO_FILE', 'Aucun fichier joint');
    }
    if (!file.buffer || file.buffer.length === 0) {
      throw new ApiError(400, 'EMPTY_FILE', 'Fichier vide');
    }

    const maxSize = input.type === 'PDF' ? env.MAX_PDF_SIZE : env.MAX_APP_SIZE;
    if (file.size > maxSize) {
      throw new ApiError(413, 'FILE_TOO_LARGE', 'Fichier trop volumineux');
    }

    if (hasDoubleExtension(file.originalname)) {
      throw new ApiError(415, 'DOUBLE_EXTENSION', 'Double extension interdite');
    }
    const ext = normalizeExtension(file.originalname);
    if (!ext) {
      throw new ApiError(415, 'INVALID_EXTENSION', 'Extension invalide');
    }
    const allowed = extensionsForType(input.type);
    if (!(allowed as readonly string[]).includes(ext)) {
      throw new ApiError(415, 'UNSUPPORTED_EXTENSION', `Extension ${ext} non supportee pour le type ${input.type}`);
    }
    const magic = validateMagic(file.buffer, ext);
    if (!magic.ok) {
      throw new ApiError(415, 'INVALID_MAGIC', magic.reason ?? 'Signature invalide');
    }
    const expectedMime = mimeForExtension(ext);
    if (expectedMime && file.mimetype && file.mimetype !== expectedMime) {
      throw new ApiError(415, 'MIME_MISMATCH', 'Type MIME incoherent');
    }

    const sha256 = sha256Buffer(file.buffer);
    const storageFilename = `${randomUUID()}${ext}`;
    const storage = getDownloadStorage(input.type);
    const info = await storage.writeFile(storageFilename, file.buffer);

    const baseSlug = slugify(input.title);
    const slug = `${baseSlug}-${Date.now().toString(36)}`.slice(0, 120);
    const status = input.status as DownloadStatus;
    const publishedAt = input.published_at ?? (status === 'PUBLISHED' ? new Date() : null);

    try {
      const created = await prisma.$transaction(async (tx) => {
        const download = await downloadRepository.create(
          {
            title: input.title,
            slug,
            description: input.description ?? null,
            type: input.type as DownloadType,
            platform: input.platform as DownloadPlatform,
            version: input.version ?? null,
            filename: storageFilename,
            original_name: file.originalname,
            storage_path: info.absolutePath,
            mime_type: expectedMime ?? file.mimetype,
            size_bytes: file.size,
            sha256,
            download_category_id: input.download_category_id ?? null,
            author_id: ctx.admin.id,
            status,
            published_at: publishedAt,
          },
          tx,
        );
        await auditService.record(
          {
            userId: ctx.admin.id,
            action: 'DOWNLOAD_CREATED',
            entityType: 'download',
            entityId: download.id,
            metadata: {
              title: input.title,
              type: input.type,
              platform: input.platform,
              original_name: file.originalname,
              size_bytes: file.size,
              sha256,
            },
            ip: ctx.clientInfo.ip,
            userAgent: ctx.clientInfo.userAgent,
          },
          tx,
        );
        return download;
      });
      const full = await fetchFullDownload(created.id);
      return toDownloadView(full as Parameters<typeof toDownloadView>[0]);
    } catch (err) {
      try { await storage.deleteFile(storageFilename); } catch { /* best-effort */ }
      throw err;
    }
  },

  async replaceFile(ctx: ActorContext, id: string, file: Express.Multer.File | undefined): Promise<DownloadView> {
    const existing = await downloadRepository.findById(id);
    if (!existing || existing.deleted_at) {
      throw new ApiError(404, 'DOWNLOAD_NOT_FOUND', 'Telechargement introuvable');
    }
    if (!file) {
      throw new ApiError(400, 'NO_FILE', 'Aucun fichier joint');
    }
    if (!file.buffer || file.buffer.length === 0) {
      throw new ApiError(400, 'EMPTY_FILE', 'Fichier vide');
    }

    const maxSize = existing.type === 'PDF' ? env.MAX_PDF_SIZE : env.MAX_APP_SIZE;
    if (file.size > maxSize) {
      throw new ApiError(413, 'FILE_TOO_LARGE', 'Fichier trop volumineux');
    }

    if (hasDoubleExtension(file.originalname)) {
      throw new ApiError(415, 'DOUBLE_EXTENSION', 'Double extension interdite');
    }
    const ext = normalizeExtension(file.originalname);
    if (!ext) {
      throw new ApiError(415, 'INVALID_EXTENSION', 'Extension invalide');
    }
    const allowed = extensionsForType(existing.type as DownloadType);
    if (!(allowed as readonly string[]).includes(ext)) {
      throw new ApiError(415, 'UNSUPPORTED_EXTENSION', `Extension ${ext} non supportee`);
    }
    const magic = validateMagic(file.buffer, ext);
    if (!magic.ok) {
      throw new ApiError(415, 'INVALID_MAGIC', magic.reason ?? 'Signature invalide');
    }
    const expectedMime = mimeForExtension(ext);
    if (expectedMime && file.mimetype && file.mimetype !== expectedMime) {
      throw new ApiError(415, 'MIME_MISMATCH', 'Type MIME incoherent');
    }

    const sha256 = sha256Buffer(file.buffer);
    const storage = getDownloadStorage(existing.type as 'PDF' | 'MOBILE' | 'DESKTOP');
    const newFilename = `${randomUUID()}${ext}`;
    const info = await storage.writeFile(newFilename, file.buffer);

    try {
      await prisma.$transaction(async (tx) => {
        await downloadRepository.update(
          id,
          {
            filename: newFilename,
            original_name: file.originalname,
            storage_path: info.absolutePath,
            mime_type: expectedMime ?? file.mimetype,
            size_bytes: file.size,
            sha256,
          },
          tx,
        );
        await auditService.record(
          {
            userId: ctx.admin.id,
            action: 'DOWNLOAD_FILE_REPLACED',
            entityType: 'download',
            entityId: id,
            metadata: {
              old_filename: existing.filename,
              new_filename: newFilename,
              size_bytes: file.size,
              sha256,
            },
            ip: ctx.clientInfo.ip,
            userAgent: ctx.clientInfo.userAgent,
          },
          tx,
        );
      });

      try { await storage.deleteFile(existing.filename); } catch { /* best-effort */ }
      const full = await fetchFullDownload(id);
      return toDownloadView(full as Parameters<typeof toDownloadView>[0]);
    } catch (err) {
      try { await storage.deleteFile(newFilename); } catch { /* best-effort */ }
      throw err;
    }
  },

  async list(query: DownloadQuery) {
    const { data, total } = await downloadRepository.list(query);
    return {
      data: data.map((row) => toDownloadView(row as unknown as Parameters<typeof toDownloadView>[0])),
      pagination: pagination(query.page, query.pageSize, total),
    };
  },

  async get(id: string): Promise<DownloadView> {
    const download = await downloadRepository.findById(id);
    if (!download || download.deleted_at) {
      throw new ApiError(404, 'DOWNLOAD_NOT_FOUND', 'Telechargement introuvable');
    }
    const full = await fetchFullDownload(id);
    return toDownloadView(full as Parameters<typeof toDownloadView>[0]);
  },

  async update(ctx: ActorContext, id: string, input: UpdateDownloadInput): Promise<DownloadView> {
    const existing = await downloadRepository.findById(id);
    if (!existing || existing.deleted_at) {
      throw new ApiError(404, 'DOWNLOAD_NOT_FOUND', 'Telechargement introuvable');
    }
    await prisma.$transaction(async (tx) => {
      await downloadRepository.update(id, {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.type !== undefined ? { type: input.type as DownloadType } : {}),
        ...(input.platform !== undefined ? { platform: input.platform as DownloadPlatform } : {}),
        ...(input.version !== undefined ? { version: input.version } : {}),
        ...(input.download_category_id !== undefined ? { download_category_id: input.download_category_id } : {}),
        ...(input.published_at !== undefined ? { published_at: input.published_at } : {}),
      }, tx);
      await auditService.record(
        {
          userId: ctx.admin.id,
          action: 'DOWNLOAD_UPDATED',
          entityType: 'download',
          entityId: id,
          metadata: { ...input } as unknown as Prisma.InputJsonObject,
          ip: ctx.clientInfo.ip,
          userAgent: ctx.clientInfo.userAgent,
        },
        tx,
      );
    });
    const full = await fetchFullDownload(id);
    return toDownloadView(full as Parameters<typeof toDownloadView>[0]);
  },

  async setStatus(ctx: ActorContext, id: string, status: string): Promise<DownloadView> {
    const existing = await downloadRepository.findById(id);
    if (!existing || existing.deleted_at) {
      throw new ApiError(404, 'DOWNLOAD_NOT_FOUND', 'Telechargement introuvable');
    }
    const publishedAt = status === 'PUBLISHED' && existing.status !== 'PUBLISHED' ? new Date() : existing.published_at;
    await prisma.$transaction(async (tx) => {
      await downloadRepository.update(id, {
        status: status as DownloadStatus,
        published_at: publishedAt,
      }, tx);
      const action = status === 'PUBLISHED' ? 'DOWNLOAD_PUBLISHED' : status === 'ARCHIVED' ? 'DOWNLOAD_ARCHIVED' : 'DOWNLOAD_UPDATED';
      await auditService.record(
        {
          userId: ctx.admin.id,
          action,
          entityType: 'download',
          entityId: id,
          metadata: { status, previous_status: existing.status } as unknown as Prisma.InputJsonObject,
          ip: ctx.clientInfo.ip,
          userAgent: ctx.clientInfo.userAgent,
        },
        tx,
      );
    });
    const full = await fetchFullDownload(id);
    return toDownloadView(full as Parameters<typeof toDownloadView>[0]);
  },

  async remove(ctx: ActorContext, id: string): Promise<void> {
    const existing = await downloadRepository.findById(id);
    if (!existing || existing.deleted_at) {
      throw new ApiError(404, 'DOWNLOAD_NOT_FOUND', 'Telechargement introuvable');
    }
    await prisma.$transaction(async (tx) => {
      await downloadRepository.softDelete(id, tx);
      await auditService.record(
        {
          userId: ctx.admin.id,
          action: 'DOWNLOAD_DELETED',
          entityType: 'download',
          entityId: id,
          metadata: { title: existing.title, type: existing.type } as unknown as Prisma.InputJsonObject,
          ip: ctx.clientInfo.ip,
          userAgent: ctx.clientInfo.userAgent,
        },
        tx,
      );
    });
    const storage = getDownloadStorage(existing.type as 'PDF' | 'MOBILE' | 'DESKTOP');
    try { await storage.deleteFile(existing.filename); } catch { /* best-effort */ }
  },

  async downloadFile(user: { id: string } | null, id: string, ip: string | null) {
    const existing = await downloadRepository.findById(id);
    if (!existing || existing.deleted_at) {
      throw new ApiError(404, 'DOWNLOAD_NOT_FOUND', 'Telechargement introuvable');
    }
    if (existing.status !== 'PUBLISHED') {
      throw new ApiError(404, 'DOWNLOAD_NOT_FOUND', 'Telechargement introuvable');
    }

    const storage = getDownloadStorage(existing.type as 'PDF' | 'MOBILE' | 'DESKTOP');
    const stream = storage.createReadStream(existing.filename);
    if (!stream) {
      throw new ApiError(500, 'FILE_MISSING', 'Fichier absent du disque');
    }

    if (user) {
      await downloadLogRepository.create({
        user_id: user.id,
        download_id: id,
        ip,
      });
    }

    const sizeBytes = statSize(existing.filename, storage);

    return {
      stream,
      mimeType: existing.mime_type,
      sizeBytes,
      originalName: existing.original_name,
    };
  },

  // -------------------------------------------------------------------------
  // Catégories
  // -------------------------------------------------------------------------

  async listCategories(query: DownloadCategoryQuery) {
    const { data, total } = await downloadCategoryRepository.list(query);
    return {
      data: data.map((row) => toDownloadCategoryView(row)),
      pagination: pagination(query.page, query.pageSize, total),
    };
  },

  async createCategory(ctx: ActorContext, input: CreateDownloadCategoryInput): Promise<DownloadCategoryView> {
    const baseSlug = slugify(input.name);
    const slug = `${baseSlug}-${Date.now().toString(36)}`.slice(0, 80);
    const category = await downloadCategoryRepository.create({
      name: input.name,
      slug,
      sort_order: input.sort_order ?? 0,
      status: input.status ?? 'ACTIVE',
    });
    await auditService.record({
      userId: ctx.admin.id,
      action: 'DOWNLOAD_CATEGORY_CREATED',
      entityType: 'download_category',
      entityId: category.id,
      metadata: { name: input.name, slug } as unknown as Prisma.InputJsonObject,
      ip: ctx.clientInfo.ip,
      userAgent: ctx.clientInfo.userAgent,
    });
    return toDownloadCategoryView(category);
  },

  async updateCategory(ctx: ActorContext, id: string, input: UpdateDownloadCategoryInput): Promise<DownloadCategoryView> {
    const existing = await downloadCategoryRepository.findById(id);
    if (!existing) {
      throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Categorie introuvable');
    }
    const data: { name?: string; sort_order?: number; status?: string } = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.sort_order !== undefined) data.sort_order = input.sort_order;
    if (input.status !== undefined) data.status = input.status;
    const updated = await downloadCategoryRepository.update(id, data);
    await auditService.record({
      userId: ctx.admin.id,
      action: 'DOWNLOAD_CATEGORY_UPDATED',
      entityType: 'download_category',
      entityId: id,
      metadata: data as unknown as Prisma.InputJsonObject,
      ip: ctx.clientInfo.ip,
      userAgent: ctx.clientInfo.userAgent,
    });
    return toDownloadCategoryView(updated);
  },

  async removeCategory(ctx: ActorContext, id: string): Promise<void> {
    const existing = await downloadCategoryRepository.findById(id);
    if (!existing) {
      throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Categorie introuvable');
    }
    const count = await downloadCategoryRepository.countDownloads(id);
    if (count > 0) {
      throw new ApiError(409, 'CATEGORY_IN_USE', 'Categorie utilisee par des telechargements');
    }
    await downloadCategoryRepository.delete(id);
    await auditService.record({
      userId: ctx.admin.id,
      action: 'DOWNLOAD_CATEGORY_DELETED',
      entityType: 'download_category',
      entityId: id,
      metadata: { name: existing.name } as unknown as Prisma.InputJsonObject,
      ip: ctx.clientInfo.ip,
      userAgent: ctx.clientInfo.userAgent,
    });
  },

  // -------------------------------------------------------------------------
  // Liste publique
  // -------------------------------------------------------------------------

  async listPublic(query: PublicDownloadQuery) {
    const { data, total } = await downloadRepository.listPublic(query);
    return {
      data: data.map((row) => toDownloadView(row as unknown as Parameters<typeof toDownloadView>[0])),
      pagination: pagination(query.page, query.pageSize, total),
    };
  },
};

function statSize(filename: string, storage: ReturnType<typeof getDownloadStorage>): number {
  try {
    return statSync(storage.resolve(filename)).size;
  } catch {
    return 0;
  }
}

export type DownloadService = typeof downloadService;
