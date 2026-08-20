import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import sharp from 'sharp';
import { ApiError } from './errors.ts';

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number];

/** Extension canonique par type MIME réellement détecté (jamais celle du client). */
export const IMAGE_EXTENSIONS: Record<ImageMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

/** Dimension maximale acceptée (pixels, chaque côté) — évite le déni de ressource. */
export const IMAGE_MAX_DIMENSION = 8000;

export const VARIANT_NAMES = ['thumb', 'medium', 'large'] as const;
export type VariantName = (typeof VARIANT_NAMES)[number];

export interface VariantSpec {
  width: number;
  format: 'webp';
  quality: number;
}

export const VARIANT_SPECS: Record<VariantName, VariantSpec> = {
  thumb: { width: 256, format: 'webp', quality: 80 },
  medium: { width: 1024, format: 'webp', quality: 85 },
  large: { width: 1920, format: 'webp', quality: 85 },
};

/**
 * Détecte le vrai type de l'image par signature binaire (magic bytes).
 * Une extension ou un Content-Type déclaré ne suffit jamais : un polyglotte
 * se ferait détecter ici.
 */
export function sniffImageType(buffer: Buffer): ImageMimeType | null {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  // JPEG : FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';

  // PNG : 89 50 4E 47 0D 0A 1A 0A
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.subarray(0, 8).equals(png)) return 'image/png';

  // WEBP : RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buffer.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }

  // AVIF/HEIC : ....ftyp<brand>
  if (buffer.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('latin1');
    if (['avif', 'avis', 'av01'].includes(brand)) return 'image/avif';
  }

  return null;
}

/**
 * Valide le nom de fichier envoyé par le client : il n'est jamais utilisé pour
 * écrire sur disque (on génère notre propre nom), mais conservé tel quel (stripped)
 * comme métadonnée d'affichage. Toute tentative de traversée ou d'injection est
 * neutralisée.
 */
export function assertSafeClientName(input: unknown): string {
  if (typeof input !== 'string') return '';
  const raw = input.replace(/\\/g, '/');
  const name = basename(raw).trim();
  if (name.length === 0 || name.length > 255) {
    throw new ApiError(400, 'INVALID_FILE_NAME', 'Nom de fichier invalide');
  }
  // Rejette tout caractère de contrôle (sauts de ligne, NUL, etc.).
  const controlChar = name.split('').find((ch) => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127);
  if (controlChar) {
    throw new ApiError(400, 'INVALID_FILE_NAME', 'Nom de fichier invalide');
  }
  return name;
}

export function sha256Buffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export interface BuiltVariants {
  /** Image originale ré-encodée (EXIF d'orientation appliquée, charge utile normalisée). */
  original: Buffer;
  variants: Array<{
    name: VariantName;
    buffer: Buffer;
    width: number;
    height: number;
  }>;
  width: number;
  height: number;
}

/**
 * Valide et traite une image brute : dimensions bornées, ré-encodage de
 * l'original (neutralise tout payload parasite/EXIF géolocalisé) puis
 * génération des variantes thumbnail/medium/large.
 */
export async function buildImageVariants(source: Buffer, mime: ImageMimeType): Promise<BuiltVariants> {
  const metadata = await sharp(source, { failOn: 'error' }).metadata();
  if (!metadata.width || !metadata.height || metadata.width < 1 || metadata.height < 1) {
    throw new ApiError(400, 'INVALID_IMAGE', 'Image invalide');
  }
  if (metadata.width > IMAGE_MAX_DIMENSION || metadata.height > IMAGE_MAX_DIMENSION) {
    throw new ApiError(400, 'IMAGE_TOO_LARGE', 'Dimensions de l image trop grandes');
  }

  const base = sharp(source).rotate();

  const format: 'jpeg' | 'png' | 'webp' | 'avif' =
    mime === 'image/jpeg' ? 'jpeg' : mime === 'image/png' ? 'png' : mime === 'image/avif' ? 'avif' : 'webp';
  const original = await base
    .clone()
    .toFormat(format, {
      ...(format === 'jpeg' ? { quality: 90, mozjpeg: true } : {}),
      ...(format === 'avif' ? { quality: 80 } : {}),
    })
    .toBuffer();

  const variants: BuiltVariants['variants'] = [];
  for (const name of VARIANT_NAMES) {
    const spec = VARIANT_SPECS[name];
    const resized = base
      .clone()
      .resize({
        width: spec.width,
        height: spec.width,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toFormat(spec.format, { quality: spec.quality });
    const outMeta = await resized.metadata();
    const buffer = await resized.toBuffer();
    variants.push({
      name,
      buffer,
      width: outMeta.width ?? 0,
      height: outMeta.height ?? 0,
    });
  }

  return {
    original,
    variants,
    width: metadata.width,
    height: metadata.height,
  };
}
