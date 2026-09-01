import type { Request, Response } from 'express';
import type { z } from 'zod';
import type { DownloadService } from '../services/download.service.ts';
import { ApiError } from '../utils/errors.ts';
import { idParamSchema } from '../validators/user.validators.ts';
import {
  type CreateDownloadInput,
  createDownloadCategorySchema,
  createDownloadSchema,
  downloadCategoryQuerySchema,
  downloadQuerySchema,
  downloadStatusTransitionSchema,
  publicDownloadQuerySchema,
  updateDownloadCategorySchema,
  updateDownloadSchema,
} from '../validators/download.validators.ts';

export interface DownloadControllerConfig {
  downloadService: DownloadService;
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Requete invalide');
  }
  return parsed.data;
}

function requireActor(req: Request) {
  if (!req.auth) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Authentification requise');
  }
  return req.auth.user;
}

function requireId(req: Request): string {
  const parsed = idParamSchema.safeParse(req.params.id);
  if (!parsed.success) {
    throw new ApiError(404, 'NOT_FOUND', 'Ressource introuvable');
  }
  return parsed.data;
}

function clientInfo(req: Request) {
  return req.clientInfo ?? { ip: 'unknown', sourcePort: null, userAgent: '' };
}

export function createDownloadController(cfg: DownloadControllerConfig) {
  // -------------------------------------------------------------------------
  // ADMIN — Downloads
  // -------------------------------------------------------------------------

  async function uploadDownload(req: Request, res: Response): Promise<void> {
    // Supporte JSON direct ou FormData avec champ 'data' contenant le JSON
    let input: CreateDownloadInput;
    if (req.body?.data && typeof req.body.data === 'string') {
      input = parse(createDownloadSchema, JSON.parse(req.body.data));
    } else {
      input = parse(createDownloadSchema, req.body);
    }
    const download = await cfg.downloadService.upload(
      { admin: requireActor(req), clientInfo: clientInfo(req) },
      req.file,
      input,
    );
    res.status(201).json({ download });
  }

  async function listDownloads(req: Request, res: Response): Promise<void> {
    const query = parse(downloadQuerySchema, req.query);
    res.json(await cfg.downloadService.list(query));
  }

  async function getDownload(req: Request, res: Response): Promise<void> {
    const id = requireId(req);
    const download = await cfg.downloadService.get(id);
    res.json({ download });
  }

  async function updateDownload(req: Request, res: Response): Promise<void> {
    const id = requireId(req);
    const data = parse(updateDownloadSchema, req.body);
    const download = await cfg.downloadService.update(
      { admin: requireActor(req), clientInfo: clientInfo(req) },
      id,
      data,
    );
    res.json({ download });
  }

  async function setDownloadStatus(req: Request, res: Response): Promise<void> {
    const id = requireId(req);
    const { status } = parse(downloadStatusTransitionSchema, req.body);
    const download = await cfg.downloadService.setStatus(
      { admin: requireActor(req), clientInfo: clientInfo(req) },
      id,
      status,
    );
    res.json({ download });
  }

  async function deleteDownload(req: Request, res: Response): Promise<void> {
    const id = requireId(req);
    await cfg.downloadService.remove(
      { admin: requireActor(req), clientInfo: clientInfo(req) },
      id,
    );
    res.status(204).end();
  }

  async function replaceFile(req: Request, res: Response): Promise<void> {
    const id = requireId(req);
    const download = await cfg.downloadService.replaceFile(
      { admin: requireActor(req), clientInfo: clientInfo(req) },
      id,
      req.file,
    );
    res.json({ download });
  }

  // -------------------------------------------------------------------------
  // ADMIN — Categories
  // -------------------------------------------------------------------------

  async function listDownloadCategories(req: Request, res: Response): Promise<void> {
    const query = parse(downloadCategoryQuerySchema, req.query);
    res.json(await cfg.downloadService.listCategories(query));
  }

  async function createDownloadCategory(req: Request, res: Response): Promise<void> {
    const data = parse(createDownloadCategorySchema, req.body);
    const category = await cfg.downloadService.createCategory(
      { admin: requireActor(req), clientInfo: clientInfo(req) },
      data,
    );
    res.status(201).json({ category });
  }

  async function updateDownloadCategory(req: Request, res: Response): Promise<void> {
    const id = requireId(req);
    const data = parse(updateDownloadCategorySchema, req.body);
    const category = await cfg.downloadService.updateCategory(
      { admin: requireActor(req), clientInfo: clientInfo(req) },
      id,
      data,
    );
    res.json({ category });
  }

  async function deleteDownloadCategory(req: Request, res: Response): Promise<void> {
    const id = requireId(req);
    await cfg.downloadService.removeCategory(
      { admin: requireActor(req), clientInfo: clientInfo(req) },
      id,
    );
    res.status(204).end();
  }

  // -------------------------------------------------------------------------
  // USER — Téléchargements publics
  // -------------------------------------------------------------------------

  async function listPublicDownloads(req: Request, res: Response): Promise<void> {
    const query = parse(publicDownloadQuerySchema, req.query);
    res.json(await cfg.downloadService.listPublic(query));
  }

  async function downloadFile(req: Request, res: Response): Promise<void> {
    const id = requireId(req);
    const user = req.auth?.user ?? null;
    const result = await cfg.downloadService.downloadFile(user, id, clientInfo(req).ip);
    if (!result) {
      throw new ApiError(404, 'DOWNLOAD_NOT_FOUND', 'Fichier introuvable');
    }
    res.set({
      'Content-Type': result.mimeType,
      'Content-Length': String(Math.max(result.sizeBytes, 0)),
      'Content-Disposition': `attachment; filename="${result.originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    });
    result.stream.on('error', () => res.destroy());
    result.stream.pipe(res);
  }

  return {
    uploadDownload,
    listDownloads,
    getDownload,
    updateDownload,
    setDownloadStatus,
    deleteDownload,
    replaceFile,
    listDownloadCategories,
    createDownloadCategory,
    updateDownloadCategory,
    deleteDownloadCategory,
    listPublicDownloads,
    downloadFile,
  };
}

export type DownloadController = ReturnType<typeof createDownloadController>;
