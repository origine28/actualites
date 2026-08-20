import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// Extensions autorisées (allowlist)
// ---------------------------------------------------------------------------

export const PDF_EXTENSIONS = ['.pdf'] as const;
export const MOBILE_EXTENSIONS = ['.apk', '.aab', '.ipa'] as const;
export const DESKTOP_EXTENSIONS = ['.exe', '.msi', '.deb', '.dmg', '.appimage'] as const;

export type DownloadType = 'PDF' | 'MOBILE' | 'DESKTOP';

export function extensionsForType(type: DownloadType): readonly string[] {
  switch (type) {
    case 'PDF':
      return PDF_EXTENSIONS;
    case 'MOBILE':
      return MOBILE_EXTENSIONS;
    case 'DESKTOP':
      return DESKTOP_EXTENSIONS;
  }
}

// ---------------------------------------------------------------------------
// Extensions → MIME (contrôlé côté serveur)
// ---------------------------------------------------------------------------

const EXT_TO_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.apk': 'application/vnd.android.package-archive',
  '.aab': 'application/x-archive',
  '.ipa': 'application/octet-stream',
  '.exe': 'application/vnd.microsoft.portable-executable',
  '.msi': 'application/x-ms-installer',
  '.deb': 'application/x-debian-package',
  '.dmg': 'application/x-apple-diskimage',
  '.appimage': 'application/x-executable',
};

export function mimeForExtension(ext: string): string | null {
  return EXT_TO_MIME[ext] ?? null;
}

// ---------------------------------------------------------------------------
// Validation des magic bytes
// ---------------------------------------------------------------------------

export interface MagicValidation {
  ok: boolean;
  reason?: string;
}

/**
 * Valide la signature binaire du fichier selon son extension.
 * Ne prétend PAS valider la structure interne complète (APK, IPA, ELF…).
 */
export function validateMagic(buffer: Buffer, ext: string): MagicValidation {
  if (buffer.length === 0) {
    return { ok: false, reason: 'Fichier vide' };
  }

  switch (ext) {
    case '.pdf':
      return validatePdf(buffer);
    case '.apk':
    case '.aab':
    case '.ipa':
      return validateZip(buffer, ext);
    case '.exe':
      return validateExe(buffer);
    case '.msi':
      return validateMsi(buffer);
    case '.deb':
      return validateDeb(buffer);
    case '.dmg':
      return validateDmg(buffer);
    case '.appimage':
      return validateAppImage(buffer);
    default:
      return { ok: false, reason: 'Extension non supportee' };
  }
}

function validatePdf(buffer: Buffer): MagicValidation {
  const header = buffer.subarray(0, Math.min(1024, buffer.length)).toString('latin1');
  if (!header.startsWith('%PDF-')) {
    return { ok: false, reason: 'Signature PDF invalide' };
  }
  return { ok: true };
}

function validateZip(buffer: Buffer, ext: string): MagicValidation {
  // ZIP local file header : PK\x03\x04
  if (buffer.length < 4) {
    return { ok: false, reason: 'Fichier trop court' };
  }
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
    return { ok: false, reason: `Signature ZIP invalide pour ${ext}` };
  }
  return { ok: true };
}

function validateExe(buffer: Buffer): MagicValidation {
  if (buffer.length < 2) {
    return { ok: false, reason: 'Fichier trop court' };
  }
  // MZ header
  if (buffer[0] !== 0x4d || buffer[1] !== 0x5a) {
    return { ok: false, reason: 'Signature MZ invalide' };
  }
  // PE\0\0 at e_lfanew
  if (buffer.length < 64) {
    return { ok: false, reason: 'Fichier EXE trop court' };
  }
  const eLfanew = buffer.readUInt32LE(60);
  if (eLfanew + 4 > buffer.length) {
    return { ok: false, reason: 'e_lfanew hors limites' };
  }
  const peSig = buffer.readUInt32LE(eLfanew);
  if (peSig !== 0x00004550) {
    return { ok: false, reason: 'Signature PE invalide' };
  }
  return { ok: true };
}

function validateMsi(buffer: Buffer): MagicValidation {
  // OLE2 compound document : D0 CF 11 E0 A1 B1 1A E1
  const MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  if (buffer.length < MAGIC.length) {
    return { ok: false, reason: 'Fichier MSI trop court' };
  }
  if (!buffer.subarray(0, MAGIC.length).equals(MAGIC)) {
    return { ok: false, reason: 'Signature OLE2 invalide' };
  }
  return { ok: true };
}

function validateDeb(buffer: Buffer): MagicValidation {
  const magic = '!<arch>\n';
  if (buffer.length < magic.length) {
    return { ok: false, reason: 'Fichier DEB trop court' };
  }
  if (buffer.subarray(0, magic.length).toString('ascii') !== magic) {
    return { ok: false, reason: 'Signature ar ivalide' };
  }
  return { ok: true };
}

function validateDmg(buffer: Buffer): MagicValidation {
  // UDIF koly block : 4 octets 'koly' dans le dernier secteur (512 octets)
  if (buffer.length < 512) {
    return { ok: false, reason: 'Fichier DMG trop court' };
  }
  const trailer = buffer.subarray(buffer.length - 512);
  // Chercher 'koly' (0x6b6f6c79) dans le trailer
  for (let i = 0; i <= trailer.length - 4; i++) {
    if (
      trailer[i] === 0x6b &&
      trailer[i + 1] === 0x6f &&
      trailer[i + 2] === 0x6c &&
      trailer[i + 3] === 0x79
    ) {
      return { ok: true };
    }
  }
  return { ok: false, reason: 'Marqueur koly absent du trailer UDIF' };
}

function validateAppImage(buffer: Buffer): MagicValidation {
  if (buffer.length < 4) {
    return { ok: false, reason: 'Fichier trop court' };
  }
  // ELF header : 0x7f E L F
  if (buffer[0] !== 0x7f || buffer[1] !== 0x45 || buffer[2] !== 0x4c || buffer[3] !== 0x46) {
    return { ok: false, reason: 'Signature ELF invalide' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Validation extensions doubles
// ---------------------------------------------------------------------------

const DOUBLE_EXT_RE = /\.[a-z0-9]+\.[a-z0-9]{2,4}$/i;

export function hasDoubleExtension(originalName: string): boolean {
  return DOUBLE_EXT_RE.test(originalName);
}

// ---------------------------------------------------------------------------
// SHA-256
// ---------------------------------------------------------------------------

export function sha256Buffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

// ---------------------------------------------------------------------------
// Normalisation d'extension
// ---------------------------------------------------------------------------

export function normalizeExtension(originalName: string): string | null {
  const match = originalName.match(/(\.[a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : null;
}

// ---------------------------------------------------------------------------
// Plateforme → extensions autorisées
// ---------------------------------------------------------------------------

export function extensionsForPlatform(platform: string, type: DownloadType): string[] {
  switch (platform) {
    case 'ANDROID':
      return ['.apk', '.aab'];
    case 'IOS':
      return ['.ipa'];
    case 'WINDOWS':
      return type === 'DESKTOP' ? ['.exe', '.msi'] : ['.pdf'];
    case 'LINUX':
      return type === 'DESKTOP' ? ['.deb', '.appimage'] : ['.pdf'];
    case 'MACOS':
      return type === 'DESKTOP' ? ['.dmg'] : ['.pdf'];
    default:
      return [...extensionsForType(type)];
  }
}
