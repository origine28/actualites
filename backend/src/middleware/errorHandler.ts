import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/errors.ts';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ressource introuvable' } });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (err instanceof ApiError) {
    if (res.headersSent) {
      next(err);
      return;
    }
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Requete invalide' } });
    return;
  }

  // Jamais de stack trace ni de détails internes dans la réponse.
  console.error('[error]', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur' } });
};
