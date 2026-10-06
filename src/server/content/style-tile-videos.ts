/** Local cleanloop footage for the Find your way to dance tiles. */
import 'server-only';

import type { VideoRef } from '@/domain/content';
import { styleTileVideoKeyByStyle, type StyleTileVideoKey } from '@/config/style-tile-videos';
import { WARP_MANIFEST } from '@/config/portal-warp-manifest';

const tileMetadata: Record<StyleTileVideoKey, Pick<VideoRef, 'poster' | 'bytes'>> = {
  hiphop: {
    poster: { key: '/media/style-tiles/hiphop/hiphop-poster.webp', alt: { en: 'Hip-hop dancer', ru: 'Хип-хоп танцор', hy: 'Հիփ-հոփ պարող' }, width: 1080, height: 1920 },
    bytes: 498058,
  },
  ballet: {
    poster: { key: '/media/style-tiles/ballet/ballet-poster.webp', alt: { en: 'Ballet dancer', ru: 'Балетная танцовщица', hy: 'Բալետի պարուհի' }, width: 1080, height: 1920 },
    bytes: 373140,
  },
  contemporary: {
    poster: { key: '/media/style-tiles/contemporary/contemporary-poster.webp', alt: { en: 'Contemporary dancer in flowing silk', ru: 'Танцовщица contemporary в струящемся шёлке', hy: 'Ժամանակակից պարի պարուհի' }, width: 1080, height: 1920 },
    bytes: 303352,
  },
  salsa: {
    poster: { key: '/media/style-tiles/salsa/salsa-poster.webp', alt: { en: 'Salsa dancers', ru: 'Танцоры сальсы', hy: 'Սալսա պարողներ' }, width: 1080, height: 1920 },
    bytes: 1214962,
  },
  heels: {
    poster: { key: '/media/style-tiles/heels/heels-poster.webp', alt: { en: 'Heels dancer', ru: 'Танцовщица heels', hy: 'Heels պարուհի' }, width: 1080, height: 1920 },
    bytes: 641426,
  },
};

function altSources(key: StyleTileVideoKey): VideoRef['sources'] {
  return ([720, 1080] as const).flatMap((width) =>
    (['av1', 'vp9', 'h264'] as const).map((format) => ({
      format,
      width,
      url: `/media/style-tiles/${key}/${key}-alt-${width === 720 ? 1280 : 1920}-${format}.${format === 'h264' ? 'mp4' : 'webm'}`,
    })),
  );
}

function tileManifest(key: StyleTileVideoKey): VideoRef {
  // Карточка показывает clean-loop, а клик ведёт на другое видео из серии стиля (alt).
  // Hip-hop дополнительно использует абстрактный warp как камеру пролёта — это уже реализовано через transitionSources.
  const transition =
    key === 'hiphop'
      ? WARP_MANIFEST.sources
      : key === 'ballet' || key === 'salsa' || key === 'heels' || key === 'contemporary'
        ? altSources(key)
        : undefined;
  return {
    sources: ([720, 1080] as const).flatMap((width) =>
      (['av1', 'vp9', 'h264'] as const).map((format) => ({
        format,
        width,
        url: `/media/style-tiles/${key}/${key}-${width === 720 ? 1280 : 1920}-${format}.${format === 'h264' ? 'mp4' : 'webm'}`,
      })),
    ),
    ...tileMetadata[key],
    ...(transition ? { transitionSources: transition } : {}),
    durationSeconds: 3.5,
  };
}

const manifests: Record<StyleTileVideoKey, VideoRef> = {
  hiphop: tileManifest('hiphop'),
  ballet: tileManifest('ballet'),
  salsa: tileManifest('salsa'),
  contemporary: tileManifest('contemporary'),
  heels: tileManifest('heels'),
};

export function getStyleTileVideo(style: string): VideoRef | null {
  const key = styleTileVideoKeyByStyle[style];
  return key ? manifests[key] : null;
}

export function getWarpVideo(): VideoRef {
  return WARP_MANIFEST;
}

export function getStyleTileVideos(styles: readonly string[]): ReadonlyMap<string, VideoRef> {
  const map = new Map<string, VideoRef>();
  for (const style of styles) {
    const video = getStyleTileVideo(style);
    if (video) map.set(style, video);
  }
  return map;
}
