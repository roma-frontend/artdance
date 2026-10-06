/**
 * STYLE TILE VIDEOS — петли внутри кулис «Find your way to dance».
 *
 * Короткие вертикальные лупы 9:16 для каждой карточки StyleAccordion.
 * HIP_HOP, BALLET и SALSA используют чистые петли 3.5s + warp-переход.
 * Остальные стили добавляются по той же схеме без затрагивания компонента:
 * добавь новую запись в `styleTileVideoPolicy` и соответствующие файлы в
 * `public/media/style-tiles/<style>/`.
 *
 * Управляется контент-слоем, а не хардкодом в компоненте: компонент не знает
 * имён файлов, он получает уже собранный `VideoRef | null`.
 */

import type { VideoLoopPolicy } from './media-processing';

const cleanloopPolicy = {
    maxBytes: 7 * 1024 * 1024,
    maxDurationSeconds: 4,
    renditions: [
      { width: 720, height: 1280, minViewportWidth: 0, bitrateKbps: { av1: 1500, vp9: 2200, h264: 3200 } },
      { width: 1080, height: 1920, minViewportWidth: 1400, bitrateKbps: { av1: 2600, vp9: 3600, h264: 5400 } },
    ],
    targetFps: 24,
    formats: ['av1', 'vp9', 'h264'] as const,
    stripAudio: true,
    seamCrossfadeSeconds: 1,
    removeWatermark: null,
    scrub: null,
    reversed: false,
    extractsPoster: true,
} as const;

export const styleTileVideoPolicy = {
  hiphop: { ...cleanloopPolicy, baseName: 'hiphop-loop' },
  ballet: { ...cleanloopPolicy, baseName: 'ballet-loop' },
  salsa: { ...cleanloopPolicy, baseName: 'salsa-loop' },
  contemporary: { ...cleanloopPolicy, baseName: 'contemporary-loop' },
  heels: { ...cleanloopPolicy, baseName: 'heels-loop' },
} as const satisfies Record<string, VideoLoopPolicy>;

export type StyleTileVideoKey = keyof typeof styleTileVideoPolicy;

/** Соответствие DanceStyle -> ключ локальной петли. */
export const styleTileVideoKeyByStyle: Record<string, StyleTileVideoKey | undefined> = {
  HIP_HOP: 'hiphop',
  BALLET: 'ballet',
  SALSA: 'salsa',
  CONTEMPORARY: 'contemporary',
  HEELS: 'heels',
};

/** Warp-петля перехода portal (16:9, 2.2s, не зациклена сама, играет once при клике). */
export const warpVideoPolicy = {
  baseName: 'portal-warp',
  maxBytes: 7 * 1024 * 1024,
  maxDurationSeconds: 3,
  renditions: [
    { width: 1280, height: 720, minViewportWidth: 0, bitrateKbps: { av1: 1500, vp9: 2200, h264: 3200 } },
    { width: 1920, height: 1080, minViewportWidth: 1400, bitrateKbps: { av1: 2600, vp9: 3600, h264: 5400 } },
  ],
  targetFps: 24,
  formats: ['av1', 'vp9', 'h264'] as const,
  stripAudio: true,
  seamCrossfadeSeconds: 0,
  removeWatermark: null,
  scrub: null,
  reversed: false,
  extractsPoster: false,
} as const satisfies VideoLoopPolicy;
