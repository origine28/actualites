import type { AuthUser, ClientInfo } from './auth.ts';

/** Contexte d'action : l'acteur provient TOUJOURS de la session (jamais du body). */
export interface ActorContext {
  admin: AuthUser;
  clientInfo: ClientInfo;
}
