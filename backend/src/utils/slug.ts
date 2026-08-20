import { ApiError } from './errors.ts';

const MAX_SLUG_LENGTH = 80;

/**
 * Slug normalisé, URL-safe, sans accents : lettres a-z, chiffres, tirets.
 * Exemple : "Nouvelle actualité en Afrique" → "nouvelle-actualite-en-afrique".
 */
export function slugify(input: string): string {
  const base = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, MAX_SLUG_LENGTH);
  return base;
}

/**
 * Réserve un slug unique : si la base existe déjà, on ajoute un suffixe
 * numérique (article, article-2, article-3…). Le prédicat `exists` doit être
 * fourni par le repository (unicité contrôlée par la base).
 */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
  fallback = 'article',
): Promise<string> {
  const clean = slugify(base) || fallback;
  if (!(await exists(clean))) return clean;

  for (let i = 2; i < 10000; i++) {
    const candidate = `${clean}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  throw new ApiError(409, 'DUPLICATE_SLUG', 'Impossible de generer un slug unique');
}

/** Normalise un slug fourni explicitement par le client (jamais aveuglément confié). */
export function normalizeSlug(input: string): string {
  const clean = slugify(input);
  if (!clean) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Slug invalide');
  }
  return clean;
}
