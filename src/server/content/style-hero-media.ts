/**
 * Фоны страниц направлений — картинки из Downloads/background.
 * Переопределяют обложку занятия в PageHero, один-в-один как HIP_HOP warp.
 * Лежат в public/media/style-hero/<style>.jpg -> отдаются как /media/style-hero/*.jpg
 */

import { mediaUrl } from '@/config/media';
import type { MediaRef } from '@/domain/content';
import type { DanceStyle } from '@/domain/enums';

const HERO_BY_STYLE: Record<string, { key: string; alt: MediaRef['alt'] }> = {
  HIP_HOP: {
    key: mediaUrl('/media/style-hero/hiphop.jpg'),
    alt: { en: 'Hip-hop style hero background', ru: 'Фон направления хип-хоп', hy: 'Հիփ-հոփ ոճի ֆոն' },
  },
  BALLET: {
    key: mediaUrl('/media/style-hero/ballet.jpg'),
    alt: { en: 'Ballet style hero background', ru: 'Фон направления балет', hy: 'Բալետի ֆոն' },
  },
  SALSA: {
    key: mediaUrl('/media/style-hero/salsa.jpg'),
    alt: { en: 'Salsa style hero background', ru: 'Фон направления сальса', hy: 'Սալսայի ֆոն' },
  },
  CONTEMPORARY: {
    key: mediaUrl('/media/style-hero/contemporary.jpg'),
    alt: { en: 'Contemporary style hero background', ru: 'Фон направления contemporary', hy: 'Contemporary ոճի ֆոն' },
  },
  HEELS: {
    key: mediaUrl('/media/style-hero/heels.jpg'),
    alt: { en: 'Heels style hero background', ru: 'Фон направления heels', hy: 'Heels ոճի ֆոն' },
  },
};

export function styleHeroImageFor(style: DanceStyle): MediaRef | null {
  const entry = HERO_BY_STYLE[style];
  if (!entry) return null;
  return {
    key: entry.key,
    alt: entry.alt,
    width: 2048,
    height: 1136,
  };
}
