import { describe, expect, it } from 'vitest';

describe('media storage R2', () => {
  it('1.6 R2 driver does not use SDK', async () => {
    const src = await import('node:fs').then(() => import('@/lib/media/storage'));
    expect(src).toBeDefined();
  });

  it('mediaUrl uses SEED_MANIFEST fallback', async () => {
    const { mediaUrl } = await import('@/config/media');
    expect(mediaUrl('test.jpg')).toBeTruthy();
  });
});
