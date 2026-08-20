export type VideoPlatform = 'YOUTUBE' | 'VIMEO';

export interface ParsedVideoUrl {
  platform: VideoPlatform;
  externalId: string;
  /** URL d'embed normalisée (servie au client, jamais l'URL brute arbitraire). */
  url: string;
}

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);

const YOUTUBE_ID = /^[a-zA-Z0-9_-]{6,20}$/;
const VIMEO_ID = /^\d{1,12}$/;

/**
 * Analyse et normalise une URL de vidéo. Seuls YouTube et Vimeo sont acceptés,
 * via des hôtes explicitement autorisés ; l'identifiant est extrait puis validé
 * par une expression stricte. L'URL stockée et servie est TOUJOURS l'URL
 * d'embed normalisée (iframe), jamais l'URL d'entrée.
 */
export function parseVideoUrl(input: unknown): ParsedVideoUrl | null {
  if (typeof input !== 'string' || input.length === 0 || input.length > 2048) return null;
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  const host = parsed.hostname.toLowerCase();

  if (YOUTUBE_HOSTS.has(host)) {
    const externalId = extractYouTubeId(host, parsed);
    if (!externalId || !YOUTUBE_ID.test(externalId)) return null;
    return {
      platform: 'YOUTUBE',
      externalId,
      url: `https://www.youtube.com/embed/${externalId}`,
    };
  }

  if (VIMEO_HOSTS.has(host)) {
    const externalId = extractVimeoId(parsed);
    if (!externalId || !VIMEO_ID.test(externalId)) return null;
    return {
      platform: 'VIMEO',
      externalId,
      url: `https://player.vimeo.com/video/${externalId}`,
    };
  }

  return null;
}

function extractYouTubeId(host: string, url: URL): string | null {
  if (host === 'youtu.be') {
    return url.pathname.split('/').filter(Boolean)[0] ?? null;
  }
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments[0] === 'watch') {
    return url.searchParams.get('v');
  }
  if (['embed', 'shorts', 'live'].includes(segments[0])) {
    return segments[1] ?? null;
  }
  if (segments[0] === 'attribution_link') {
    const v = url.searchParams.get('v');
    return v ?? url.searchParams.get('u');
  }
  return null;
}

function extractVimeoId(url: URL): string | null {
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments[0] === 'video') return segments[1] ?? null;
  return segments[0] ?? null;
}
