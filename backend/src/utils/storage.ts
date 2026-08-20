import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SUBDIRS = ['images', 'pdf', 'mobile', 'desktop'];

export function ensureStorageDirs(root: string): void {
  const base = resolve(root);
  for (const dir of SUBDIRS) {
    mkdirSync(join(base, dir), { recursive: true });
  }
}

/**
 * Sous-racine de stockage pour les téléchargements, selon le type.
 */
export function downloadStorageRoot(root: string, type: 'PDF' | 'MOBILE' | 'DESKTOP'): string {
  const map: Record<string, string> = { PDF: 'pdf', MOBILE: 'mobile', DESKTOP: 'desktop' };
  return join(root, map[type]);
}
