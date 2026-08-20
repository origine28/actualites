import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { resolveClientIp } from '../utils/ip.ts';

/**
 * Rate limiting global sur /api/* — protection basique contre les attaques
 * par déni de service. Limite généreuse pour ne pas gêner l'utilisation
 * normale (200 requêtes / 15 min par IP par défaut).
 */
export function createGlobalRateLimiter(windowMs: number, max: number) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => resolveClientIp(req),
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Trop de requetes. Reessayez plus tard.' },
      });
    },
  });
}

export type GlobalRateLimiter = ReturnType<typeof createGlobalRateLimiter>;

/**
 * Rate limiting spécifique à la route de login (brute force / credential
 * stuffing). La clé est l'IP réelle résolue. Ne bloque pas le reste du site.
 */
export function createLoginRateLimiter(windowMs: number, max: number) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => resolveClientIp(req),
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Trop de tentatives. Reessayez plus tard.' },
      });
    },
  });
}

export type LoginRateLimiter = ReturnType<typeof createLoginRateLimiter>;

/**
 * Rate limiting pour le formulaire de contact (anti-spam).
 * 5 messages par fenêtre de 15 minutes par IP.
 */
export function createContactRateLimiter(windowMs: number, max: number) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => resolveClientIp(req),
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Trop de messages. Reessayez plus tard.' },
      });
    },
  });
}

export type ContactRateLimiter = ReturnType<typeof createContactRateLimiter>;
