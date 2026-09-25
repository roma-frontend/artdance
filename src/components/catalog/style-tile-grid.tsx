'use client';

import { ArrowUpRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Reveal } from '@/components/fx/reveal';
import { PortalLink } from '@/components/fx/portal-link';
import { Media } from '@/components/ui/media';
import { routes } from '@/config';
import { danceStyleLabelKey } from '@/domain/enums';
import { resolveMedia, type MediaRef } from '@/domain/content';
import type { Locale } from '@/i18n/config';

export interface StyleTile {
  style: string;
  slug: string;
  image: MediaRef;
  classCount: number;
}

interface StyleTileGridProps {
  tiles: readonly StyleTile[];
  locale: Locale;
}

export function StyleTileGrid({ tiles, locale }: StyleTileGridProps) {
  const t = useTranslations();
  const tCommon = useTranslations('common');
  return (
    <Reveal as="ul" variant="stagger" className="grid grid-cols-2 gap-4">
      {tiles.map((tile) => {
        const href = routes.style(tile.slug);
        return (
          <li key={tile.style}>
            <PortalLink
              href={href}
              data-cursor-label={tCommon('actions.explore')}
              className="card-surface group relative flex aspect-square items-end overflow-hidden rounded-lg border border-border-default hover:border-accent sm:aspect-portrait"
            >
              <Media
                {...resolveMedia(tile.image, locale)}
                preset="categoryCard"
                fill
                className="absolute inset-0 size-full"
                imageClassName="style-tile-media media-zoom group-hover:scale-110 group-hover:brightness-70 group-hover:saturate-125 transition-transform duration-700 ease-out"
              />

              {/* Затемнение снизу: без него белая подпись теряется на светлом кадре. */}
              <span
                aria-hidden
                className="absolute inset-0"
                style={{ background: 'var(--scrim-bottom-strong)' }}
              />

              <span
                aria-hidden
                className="tile-arrow absolute top-4 right-4 flex size-9 items-center justify-center rounded-full text-content-on-cinema backdrop-blur-md"
                style={{ background: 'var(--surface-glass-on-cinema)' }}
              >
                <ArrowUpRight className="size-4" />
              </span>

              <span className="relative z-10 p-5">
                <span className="tile-title block text-card-title text-content-on-cinema">
                  {t(danceStyleLabelKey(tile.style as never))}
                </span>
                <span className="tile-count text-caption mt-1 block text-content-on-cinema-muted">
                  {tCommon('counts.classes', { count: tile.classCount })}
                </span>

                <span className="tile-cta text-caption mt-3 flex items-center gap-1.5 font-semibold text-accent-on-cinema">
                  {tCommon('actions.book')}
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </span>
              </span>
            </PortalLink>
          </li>
        );
      })}
    </Reveal>
  );
}
