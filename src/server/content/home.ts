/**
 * Контент главной: совместимый фасад над Prisma-запросом.
 *
 * Карточки, CMS-конфигурация и медиа приходят из `queries/home.ts`; здесь
 * остаётся только сборка VideoRef из генерируемого манифеста петель.
 */

import 'server-only';

import type { VideoLoopKey } from '@/config/media-processing';
import type { HomeContent, MediaRef, VideoRef } from '@/domain/content';
import { videoLoops } from '@/design/video-loops.generated';
import type { Locale } from '@/i18n/config';
import { getHomePageContent } from '@/server/queries/home';

function videoLoop(loop: VideoLoopKey, poster: MediaRef): VideoRef | null {
  const { sources, durationSeconds } = videoLoops[loop];
  if (sources.length === 0) return null;

  const lightest = sources.reduce((min, item) => (item.bytes < min.bytes ? item : min));

  return {
    sources: sources.map((item) => ({
      format: item.format,
      width: item.width,
      url: `/media/video/${item.file}`,
    })),
    poster,
    durationSeconds,
    bytes: lightest.bytes,
  };
}

export async function getHomeContent(locale: Locale): Promise<HomeContent> {
  const content = await getHomePageContent(locale);

  return {
    ...content,
    hero: {
      ...content.hero,
      video: videoLoop('hero', content.hero.image),
    },
    editorial: {
      ...content.editorial,
      video: videoLoop('editorial', content.editorial.image),
    },
    competition: {
      ...content.competition,
      video: videoLoop('competition', content.competition.image),
    },
  };
}
