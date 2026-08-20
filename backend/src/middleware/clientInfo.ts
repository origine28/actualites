import type { NextFunction, Request, Response } from 'express';
import { buildClientInfo } from '../utils/ip.ts';

/** Résout et fixe l'IP, le port source et le user-agent du client. */
export function clientInfoMiddleware(req: Request, _res: Response, next: NextFunction): void {
  req.clientInfo = buildClientInfo(req);
  next();
}
