import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { env } from '../config/env.ts';

/** Stockage mémoire : le service valide et ré-encode le buffer (jamais d'écriture directe). */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_IMAGE_SIZE, files: 1 },
});

export const uploadSingleImage = upload.single('image');

/** Upload de téléchargement (PDF/app). La limite est MAX_APP_SIZE (100 Mo par défaut). */
const downloadUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_APP_SIZE, files: 1 },
});

export const uploadSingleDownload = downloadUpload.single('file');

/** Convertit les erreurs Multer en réponses API propres (jamais de stack trace). */
export function handleUploadError(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: { code: 'FILE_TOO_LARGE', message: 'Fichier trop volumineux' } });
      return;
    }
    res.status(400).json({ error: { code: 'UPLOAD_ERROR', message: 'Televersement invalide' } });
    return;
  }
  next(err);
}
