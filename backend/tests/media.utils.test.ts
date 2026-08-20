import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { describe, expect, it, afterAll } from 'vitest';
import { LocalStorageService } from '../src/storage/localStorage.service.ts';
import { assertSafeClientName, buildImageVariants, sniffImageType } from '../src/utils/image.ts';
import { parseVideoUrl } from '../src/utils/video.ts';

describe('LocalStorageService', () => {
  const root = mkdtempSync(join(tmpdir(), 'opencode-storage-'));
  const storage = new LocalStorageService(root);

  it('refuse toute clé traversante ou non conforme', () => {
    expect(() => storage.resolve('..\\..\\evil')).toThrow();
    expect(() => storage.resolve('../evil')).toThrow();
    expect(() => storage.resolve('a/../b')).toThrow();
    expect(() => storage.resolve('a/..\\b')).toThrow();
    expect(() => storage.resolve('')).toThrow();
    expect(() => storage.resolve('clé accentée.png')).toThrow();
    expect(() => storage.resolve('ok.webp')).not.toThrow();
  });

  it('écrit puis relit un fichier (sans laisser de tmp)', async () => {
    const key = `${randomUUID()}.png`;
    await storage.writeFile(key, Buffer.from('contenu'));
    const content = await storage.readFile(key);
    expect(content?.toString('utf8')).toBe('contenu');
    expect(existsSync(join(root, key))).toBe(true);
    expect(existsSync(join(root, `${key}.${process.pid}.tmp`))).toBe(false);
    await storage.deleteFile(key);
    expect(await storage.readFile(key)).toBeNull();
  });

  it('deleteFile sur une clé absente → false', async () => {
    expect(await storage.deleteFile(`${randomUUID()}.bin`)).toBe(false);
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });
});

describe('sniffImageType', () => {
  it('reconnaît JPEG, PNG, WEBP et AVIF ; refuse le reste', () => {
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('image/jpeg');
    expect(sniffImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))).toBe('image/png');
    expect(sniffImageType(Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe('image/webp');
    expect(sniffImageType(Buffer.from([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]))).toBe('image/avif');
    expect(sniffImageType(Buffer.from('<html>x</html>'))).toBeNull();
    expect(sniffImageType(Buffer.from('%PDF-1.4'))).toBeNull();
    expect(sniffImageType(Buffer.alloc(4))).toBeNull();
  });
});

describe('assertSafeClientName', () => {
  it('retire la traversée, conserve le nom affichable, rejette les caractères de contrôle', () => {
    expect(assertSafeClientName('../../x/y.png')).toBe('y.png');
    expect(assertSafeClientName('..\\x.png')).toBe('x.png');
    expect(assertSafeClientName('photo.png')).toBe('photo.png');
    expect(() => assertSafeClientName('')).toThrow();
    expect(() => assertSafeClientName('bad\nname.png')).toThrow();
    expect(() => assertSafeClientName('bad\tname.png')).toThrow();
  });
});

describe('parseVideoUrl', () => {
  it('normalise YouTube (watch, short, embed, nocookie, mobile) et Vimeo', () => {
    expect(parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      platform: 'YOUTUBE',
      externalId: 'dQw4w9WgXcQ',
      url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    });
    expect(parseVideoUrl('https://youtu.be/dQw4w9WgXcQ')?.url).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(parseVideoUrl('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')?.externalId).toBe('dQw4w9WgXcQ');
    expect(parseVideoUrl('https://m.youtube.com/shorts/9bZkp7q19f0')?.externalId).toBe('9bZkp7q19f0');
    expect(parseVideoUrl('https://vimeo.com/76979871')).toEqual({
      platform: 'VIMEO',
      externalId: '76979871',
      url: 'https://player.vimeo.com/video/76979871',
    });
  });

  it('rejette hôtes non autorisés et identifiants invalides', () => {
    expect(parseVideoUrl('https://example.com/video')).toBeNull();
    expect(parseVideoUrl('https://youtu.be/!!')).toBeNull();
    expect(parseVideoUrl('https://youtu.be/ab')).toBeNull();
    expect(parseVideoUrl('https://vimeo.com/abc')).toBeNull();
    expect(parseVideoUrl('javascript:alert(1)')).toBeNull();
    expect(parseVideoUrl('not a url')).toBeNull();
  });
});

describe('buildImageVariants', () => {
  it('génère original + variantes webp et vérifie la borne de dimensions', async () => {
    const sharp = (await import('sharp')).default;
    const png = await sharp({ create: { width: 800, height: 600, channels: 4, background: { r: 200, g: 100, b: 50, alpha: 1 } } })
      .png()
      .toBuffer();
    const built = await buildImageVariants(png, 'image/png');
    expect(built.variants).toHaveLength(3);
    expect(built.variants.map((v) => v.name)).toEqual(['thumb', 'medium', 'large']);
    const thumbMeta = await sharp(built.variants[0].buffer).metadata();
    expect(thumbMeta.width).toBeLessThanOrEqual(256);
    expect(thumbMeta.format).toBe('webp');
    expect(built.width).toBe(800);
    expect(built.height).toBe(600);

    const giant = await sharp({ create: { width: 9000, height: 9000, channels: 4, background: '#fff' } })
      .png()
      .toBuffer();
    await expect(buildImageVariants(giant, 'image/png')).rejects.toThrow();
  });
});
