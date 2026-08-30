import { isIP } from 'node:net';
import type { Request } from 'express';
import type { ClientInfo } from '../types/auth.ts';

const MAX_IP_LENGTH = 45;
const MAX_USER_AGENT_LENGTH = 500;

function normalizeIp(raw: string): string | null {
  const value = raw.trim().replace(/^::ffff:/, '').split(',')[0].trim();
  if (value.length === 0 || value.length > MAX_IP_LENGTH) return null;
  if (isIP(value) === 0) return null;
  return value;
}

/**
 * Résout l'IP réelle du client.
 *
 * Chaîne de confiance :
 * Internet → Cloudflare → Cloudflare Tunnel → cloudflared → 127.0.0.1:8080 → Express
 *
 * 1. `CF-Connecting-IP` (posé par Cloudflare à l'edge, transmis par le tunnel).
 * 2. `req.ip` (Express ne l'utilise que si la connexion directe provient de la
 *    plage de confiance `loopback` — cloudflared local ; X-Forwarded-For n'est
 *    honoré que dans cette chaîne).
 * 3. `req.socket.remoteAddress` (accès direct local / développement).
 *
 * Une IP fournie par le client dans le body/query n'est JAMAIS utilisée.
 */
export function resolveClientIp(req: Request): string {
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.length > 0) {
    const normalized = normalizeIp(cfIp);
    if (normalized) return normalized;
  }

  if (req.ip) {
    const normalized = normalizeIp(req.ip);
    if (normalized) return normalized;
  }

  const socketIp = req.socket?.remoteAddress;
  if (socketIp) {
    const normalized = normalizeIp(socketIp);
    if (normalized) return normalized;
  }

  return 'unknown';
}

/**
 * Port TCP source.
 *
 * En accès local direct, `req.socket.remotePort` est le port TCP client réel
 * et il est capturé tel quel.
 *
 * Derrière Cloudflare Tunnel, le port TCP source du client Internet n'est
 * pas transmis par Cloudflare : on ne peut donc capturer que le port de la
 * connexion locale au tunnel (127.0.0.1:port), pas celui du client distant.
 * Plutôt que de renvoyer systématiquement `NULL`, on capture ce port quand
 * il est disponible (`remotePort`), tout en le documentant comme « port de
 * l'extrémité vue par l'application ». Un port n'est jamais inventé : s'il
 * n'existe aucun port réel, `NULL` est conservé.
 */
export function resolveSourcePort(req: Request): number | null {
  const port = req.socket?.remotePort;
  return typeof port === 'number' && port > 0 ? port : null;
}

export function resolveUserAgent(req: Request): string {
  const ua = req.headers['user-agent'];
  if (typeof ua !== 'string') return '';
  return ua.slice(0, MAX_USER_AGENT_LENGTH);
}

export function buildClientInfo(req: Request): ClientInfo {
  return {
    ip: resolveClientIp(req),
    sourcePort: resolveSourcePort(req),
    userAgent: resolveUserAgent(req),
  };
}
