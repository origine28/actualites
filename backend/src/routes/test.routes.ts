import { Router } from 'express';
import { requireRole } from '../middleware/requireRole.ts';
import { requireAuth } from '../middleware/requireAuth.ts';

/**
 * Route technique temporaire, montée UNIQUEMENT en test (exposeTestRoutes)
 * pour valider requireAuth + requireRole('ADMIN'). Absente de l'API de
 * production.
 */
export const testRouter: Router = Router();

testRouter.get('/protected', requireAuth, requireRole('ADMIN'), (_req, res) => {
  res.json({ ok: true });
});
