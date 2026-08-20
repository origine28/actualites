import type { AuthContext, ClientInfo } from './auth.ts';

declare global {
  namespace Express {
    interface Request {
      /** Utilisateur + session authentifiés, remplis par requireAuth. */
      auth?: AuthContext;
      /** Informations client résolues (IP, port source, user agent). */
      clientInfo?: ClientInfo;
    }
  }
}

export {};
