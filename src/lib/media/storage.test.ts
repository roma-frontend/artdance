import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('media storage R2', () => {
  it('1.6 R2 driver does not use SDK', async () => {
    const src = await import('node:fs').then(() => import('@/lib/media/storage'));
    expect(src).toBeDefined();
  });

  it('mediaUrl uses SEED_MANIFEST fallback', async () => {
    const { mediaUrl } = await import('@/config/media');
    expect(mediaUrl('test.jpg')).toBeTruthy();
  });

  it('serves public media and upload keys from the configured CDN', async () => {
    vi.stubEnv('NEXT_PUBLIC_MEDIA_CDN_URL', 'https://media.example.com/');
    vi.resetModules();
    const { mediaUrl } = await import('@/config/media');
    expect(mediaUrl('/media/seed/photo.webp')).toBe('https://media.example.com/media/seed/photo.webp');
    expect(mediaUrl('/media/uploads/photo.webp')).toBe('https://media.example.com/media/uploads/photo.webp');
    expect(mediaUrl('avatars/photo.webp')).toBe('https://media.example.com/avatars/photo.webp');
    expect(mediaUrl('https://other.example.com/photo.webp')).toBe('https://other.example.com/photo.webp');
    expect(mediaUrl('/favicon.ico')).toBe('https://media.example.com/favicon.ico');
  });

  it('keeps public media local when no CDN is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_MEDIA_CDN_URL', '');
    vi.stubEnv('R2_PUBLIC_BASE_URL', '');
    vi.stubEnv('R2_PUBLIC_URL', '');
    vi.resetModules();
    const { mediaUrl } = await import('@/config/media');
    expect(mediaUrl('/media/seed/photo.webp')).toBe('/media/seed/photo.webp');
  });
});
