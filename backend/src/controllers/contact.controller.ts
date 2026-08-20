import type { Request, Response } from 'express';
import type { z } from 'zod';
import type { ContactService } from '../services/contact.service.ts';
import { ApiError } from '../utils/errors.ts';
import { idParamSchema } from '../validators/user.validators.ts';
import {
  createContactMessageSchema,
  contactMessageQuerySchema,
  contactStatusTransitionSchema,
} from '../validators/contact.validators.ts';

export interface ContactControllerConfig {
  contactService: ContactService;
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

export function createContactController(cfg: ContactControllerConfig) {
  async function sendMessage(req: Request, res: Response) {
    const user = requireActor(req);
    const input = parse(createContactMessageSchema, req.body);

    await cfg.contactService.create(input, {
      user,
      clientInfo: clientInfo(req),
    });

    res.status(201).json({ message: 'Message envoye' });
  }

  async function listMessages(req: Request, res: Response) {
    requireActor(req);
    const query = parse(contactMessageQuerySchema, req.query);
    const result = await cfg.contactService.list(query);
    res.json(result);
  }

  async function getMessage(req: Request, res: Response) {
    requireActor(req);
    const id = requireId(req);
    const message = await cfg.contactService.getById(id);
    res.json({ message });
  }

  async function setStatus(req: Request, res: Response) {
    const user = requireActor(req);
    const id = requireId(req);
    const { status } = parse(contactStatusTransitionSchema, req.body);

    const message = await cfg.contactService.setStatus(id, status, {
      user,
      clientInfo: clientInfo(req),
    });

    res.json({ message });
  }

  async function deleteMessage(req: Request, res: Response) {
    const user = requireActor(req);
    const id = requireId(req);

    await cfg.contactService.remove(id, {
      user,
      clientInfo: clientInfo(req),
    });

    res.status(204).end();
  }

  return { sendMessage, listMessages, getMessage, setStatus, deleteMessage };
}

export type ContactController = ReturnType<typeof createContactController>;
