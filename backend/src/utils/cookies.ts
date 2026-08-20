import type { CookieOptions, Response } from 'express';

export const SESSION_COOKIE_NAME = 'news.sid';
export const CSRF_COOKIE_NAME = 'news.csrf';

function baseOptions(secure: boolean, httpOnly: boolean): CookieOptions {
  return {
    httpOnly,
    secure,
    sameSite: 'lax',
    path: '/',
  };
}

export function setSessionCookie(res: Response, token: string, secure: boolean, ttlMs: number): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    ...baseOptions(secure, true),
    maxAge: ttlMs,
  });
}

export function clearSessionCookie(res: Response, secure: boolean): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    ...baseOptions(secure, true),
    maxAge: 0,
  });
}

export function setCsrfCookie(res: Response, token: string, secure: boolean, ttlMs: number): void {
  // non-HttpOnly : le frontend (même origine) doit pouvoir lire le token pour
  // l'envoyer dans l'en-tête X-CSRF-Token.
  res.cookie(CSRF_COOKIE_NAME, token, {
    ...baseOptions(secure, false),
    maxAge: ttlMs,
  });
}

export function clearCsrfCookie(res: Response, secure: boolean): void {
  res.clearCookie(CSRF_COOKIE_NAME, {
    ...baseOptions(secure, false),
    maxAge: 0,
  });
}
