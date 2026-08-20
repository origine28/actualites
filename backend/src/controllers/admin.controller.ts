import type { Request, Response } from 'express';
import type { z } from 'zod';
import type { AdminService } from '../services/admin.service.ts';
import { ApiError } from '../utils/errors.ts';
import {
  createUserSchema,
  idParamSchema,
  listUsersQuerySchema,
  loginHistoryQuerySchema,
  resetPasswordSchema,
  statusSchema,
  updateUserSchema,
} from '../validators/user.validators.ts';

export interface AdminControllerConfig {
  adminService: AdminService;
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Requete invalide');
  }
  return parsed.data;
}

function requireId(req: Request): string {
  const parsed = idParamSchema.safeParse(req.params.id);
  if (!parsed.success) {
    throw new ApiError(404, 'NOT_FOUND', 'Utilisateur introuvable');
  }
  return parsed.data;
}

export function createAdminController(cfg: AdminControllerConfig) {
  function actor(req: Request) {
    if (!req.auth) {
      throw new ApiError(401, 'AUTH_REQUIRED', 'Authentification requise');
    }
    return req.auth.user;
  }

  function clientInfo(req: Request) {
    return req.clientInfo ?? { ip: 'unknown', sourcePort: null, userAgent: '' };
  }

  async function listUsers(req: Request, res: Response): Promise<void> {
    const query = parse(listUsersQuerySchema, req.query);
    res.json(await cfg.adminService.listUsers(query));
  }

  async function createUser(req: Request, res: Response): Promise<void> {
    const data = parse(createUserSchema, req.body);
    const user = await cfg.adminService.createUser(
      { admin: actor(req), clientInfo: clientInfo(req) },
      data,
    );
    res.status(201).json({ user });
  }

  async function updateUser(req: Request, res: Response): Promise<void> {
    const targetId = requireId(req);
    const data = parse(updateUserSchema, req.body);
    const user = await cfg.adminService.updateUser(
      { admin: actor(req), clientInfo: clientInfo(req) },
      targetId,
      data,
    );
    res.json({ user });
  }

  async function setStatus(req: Request, res: Response): Promise<void> {
    const targetId = requireId(req);
    const { status } = parse(statusSchema, req.body);
    const user = await cfg.adminService.setStatus(
      { admin: actor(req), clientInfo: clientInfo(req) },
      targetId,
      status,
    );
    res.json({ user });
  }

  async function resetPassword(req: Request, res: Response): Promise<void> {
    const targetId = requireId(req);
    const { password } = parse(resetPasswordSchema, req.body);
    await cfg.adminService.resetPassword(
      { admin: actor(req), clientInfo: clientInfo(req) },
      targetId,
      password,
    );
    res.status(204).end();
  }

  async function getUserLoginHistory(req: Request, res: Response): Promise<void> {
    const targetId = requireId(req);
    const query = parse(loginHistoryQuerySchema, req.query);
    res.json(await cfg.adminService.getUserLoginHistory(targetId, query));
  }

  async function getGlobalLoginHistory(req: Request, res: Response): Promise<void> {
    const query = parse(loginHistoryQuerySchema, req.query);
    res.json(await cfg.adminService.getGlobalLoginHistory(query));
  }

  return {
    listUsers,
    createUser,
    updateUser,
    setStatus,
    resetPassword,
    getUserLoginHistory,
    getGlobalLoginHistory,
  };
}

export type AdminController = ReturnType<typeof createAdminController>;
