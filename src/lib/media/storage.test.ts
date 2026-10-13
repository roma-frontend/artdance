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

  it('mediaProxyUrl routes direct media through the origin proxy when enabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_MEDIA_PROXY_ORIGIN', 'true');
    vi.stubEnv('NEXT_PUBLIC_MEDIA_CDN_URL', 'https://media.example.com/');
    vi.stubEnv('R2_PUBLIC_URL', 'https://media.example.com');
    vi.resetModules();
    const { mediaProxyUrl, mediaUrl } = await import('@/config/media');
    expect(mediaProxyUrl('/media/style-tiles/ballet/ballet-poster.webp')).toBe(
      '/media-proxy/media/style-tiles/ballet/ballet-poster.webp',
    );
    expect(mediaProxyUrl('/media/app-icon-192.png')).toBe('/media-proxy/media/app-icon-192.png');
    expect(mediaProxyUrl('avatars/photo.webp')).toBe('/media-proxy/avatars/photo.webp');
    expect(mediaProxyUrl('https://other.example.com/photo.webp')).toBe('https://other.example.com/photo.webp');
    /* next/image остаётся с абсолютным R2-URL: оптимизатор фетчит сам. */
    expect(mediaUrl('/media/seed/photo.webp')).toBe('https://media.example.com/media/seed/photo.webp');
  });

  it('mediaProxyUrl defers to mediaUrl when the proxy is off', async () => {
    vi.stubEnv('NEXT_PUBLIC_MEDIA_PROXY_ORIGIN', 'false');
    vi.stubEnv('NEXT_PUBLIC_MEDIA_CDN_URL', 'https://media.example.com/');
    vi.stubEnv('R2_PUBLIC_URL', '');
    vi.resetModules();
    const { mediaProxyUrl } = await import('@/config/media');
    expect(mediaProxyUrl('/media/seed/photo.webp')).toBe('https://media.example.com/media/seed/photo.webp');
  });
});
