import type { NextFunction, Request, Response } from 'express';

/** Les réponses dépendant de la session ne doivent jamais être mises en cache. */
export function noStore(_req: Request, res: Response, next: NextFunction): void {
  res.set('Cache-Control', 'private, no-store');
  next();
}
