import type { VideoRef } from '@/domain/content';

export const WARP_MANIFEST: VideoRef = {
  sources: [
    { format: 'av1', width: 1280, url: '/media/warp/warp-1280-av1.webm' },
    { format: 'vp9', width: 1280, url: '/media/warp/warp-1280-vp9.webm' },
    { format: 'h264', width: 1280, url: '/media/warp/warp-1280-h264.mp4' },
    { format: 'av1', width: 1920, url: '/media/warp/warp-1920-av1.webm' },
    { format: 'vp9', width: 1920, url: '/media/warp/warp-1920-vp9.webm' },
    { format: 'h264', width: 1920, url: '/media/warp/warp-1920-h264.mp4' },
  ],
  poster: {
    key: '/media/style-tiles/hiphop/hiphop-poster.webp',
    alt: { en: '', ru: '', hy: '' },
  },
  durationSeconds: 2.21,
  bytes: 285133,
};
