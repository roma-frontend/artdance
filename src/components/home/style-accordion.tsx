'use client';

/**
 * STYLE ACCORDION («Театральные кулисы»)
 *
 * Элегантный интерактивный аккордеон стилей танца.
 * Карточки стоят в обычном потоке как вертикальные кулисы сцены.
 * При наведении (hover) или фокусе карточка плавно и пластично расширяется,
 * открывая полноцветный кадр, детали и кнопку перехода,
 * а соседние карточки мягко сужаются.
 *
 * Никаких привязок к скроллу и залипаний — естественная прокрутка страницы.
 */

import { ArrowUpRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';
import { useIsLiteMode } from '@/lib/perf/lite-mode';

import { PortalLink } from '@/components/fx/portal-link';
import { Media } from '@/components/ui/media';
import { TileVideo } from '@/components/ui/tile-video';
import { danceMood, routes } from '@/config';
import { danceStyleLabelKey } from '@/domain/enums';
import { resolveMedia, type MediaRef, type VideoRef } from '@/domain/content';
import type { Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

export interface StyleTile {
  style: string;
  slug: string;
  image: MediaRef;
  video?: VideoRef | null;
  classCount: number;
}

interface StyleAccordionProps {
  tiles: readonly StyleTile[];
  locale: Locale;
  className?: string;
}

export function StyleAccordion({ tiles, locale, className }: StyleAccordionProps) {
  const t = useTranslations();
  const tCommon = useTranslations('common');
  const [isCoarse, setIsCoarse] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const lite = useIsLiteMode();
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  // По умолчанию активна средняя карточка (Salsa)
  const [activeIndex, setActiveIndex] = useState<number>(2);

  useEffect(() => {
    const mql = window.matchMedia('(hover: none), (pointer: coarse)');
    const update = () => setIsCoarse(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  // Keep the raster/video surface at its largest size. Flex only changes the
  // clipping window, not object-fit or the decoder's output size on every frame.
  useEffect(() => {
    const container = containerRef.current;
    const list = container?.querySelector('ul');
    if (!container || !list) return;
    const measure = () => {
      const horizontal = window.matchMedia('(min-width: 768px)').matches;
      const gap = Number.parseFloat(getComputedStyle(list).gap) || 0;
      const available = (horizontal ? list.clientWidth : list.clientHeight) - gap * (tiles.length - 1);
      const expanded = available * 3.5 / (tiles.length + 2.5);
      container.style.setProperty('--style-media-width', `${horizontal ? expanded : list.clientWidth}px`);
      container.style.setProperty('--style-media-height', `${horizontal ? list.clientHeight : expanded}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [tiles.length]);

  // Do not start a network request/decoder while the curtains are resizing.
  // Rapid selections cancel the pending start, including on touch devices.
  useEffect(() => {
    if (reducedMotion || lite) return;
    const timeout = window.setTimeout(() => setPlayingIndex(activeIndex), 1250);
    return () => window.clearTimeout(timeout);
  }, [activeIndex, reducedMotion, lite]);

  const selectPanel = (index: number) => {
    if (index === activeIndex) return;
    setPlayingIndex(null);
    setActiveIndex(index);
  };

  return (
    <div
      ref={containerRef}
      data-slot="style-accordion"
      className={cn('style-accordion-container relative w-full overflow-hidden my-4', className)}
    >
      <ul className="flex flex-col md:flex-row gap-3 md:gap-3.5 h-140! w-full">
        {tiles.map((tile, index) => {
          const isActive = activeIndex === index;
          const href = routes.style(tile.slug);

          const handleSelect = () => selectPanel(index);
          const handleLinkClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
            // На touch первый тап — раскрыть кулису и показать эффект, второй — переход.
            // На desktop hover уже раскрыл, поэтому сразу лететь порталом.
            if (isCoarse && event.detail !== 0 && !isActive) {
              event.preventDefault();
              event.stopPropagation();
              handleSelect();
            }
          };

          return (
            <li
              key={tile.style}
              data-style-panel=""
              data-portal-card=""
              data-dance-mood={danceMood(tile.style)}
              data-active={isActive ? 'true' : 'false'}
              onMouseEnter={() => {
                if (!isCoarse) selectPanel(index);
              }}
              onFocus={(event) => {
                // Touch focus precedes click; it must not bypass the first-tap preview.
                if (!isCoarse || event.target.matches(':focus-visible')) selectPanel(index);
              }}
              onClick={handleSelect}
              style={{ flex: isActive ? '3.5 1 0%' : '1 1 0%' }}
              className={cn(
                'dance-style-panel relative min-h-0 min-w-0 h-full overflow-hidden rounded-2xl border cursor-pointer [contain:layout_paint]',
                'transition-[flex-grow,opacity] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]',
                isActive
                  ? 'border-accent/80'
                  : 'border-border-default/60 opacity-75 hover:opacity-100',
              )}
            >
              <PortalLink
                href={href}
                flight="media"
                onClick={handleLinkClick}
                data-cursor-label={tCommon('actions.explore')}
                className="group relative flex size-full items-end p-6 select-none"
              >
                <div className="dance-style-media dance-style-image" aria-hidden="true">
                  <Media
                    {...resolveMedia(tile.video?.poster ?? tile.image, locale)}
                    preset="categoryCard"
                    fill
                    className="absolute inset-0 size-full"
                    imageClassName="size-full object-cover"
                  />

                  {tile.video && (
                    <TileVideo
                      video={tile.video}
                      posterAlt={resolveMedia(tile.video.poster, locale).alt}
                      isActive={isActive && playingIndex === index && !reducedMotion && !lite}
                    />
                  )}
                </div>
                <span data-portal-media="" aria-hidden className="pointer-events-none absolute inset-0" />

                {/* Затемнение — мощная 700ms волна вместе с flex. */}
                <div
                  aria-hidden="true"
                  className={cn(
                    'absolute inset-0 transition-opacity duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]',
                    isActive
                      ? 'bg-gradient-to-t from-surface-cinema/95 via-surface-cinema/40 to-transparent'
                      : 'bg-gradient-to-t from-surface-cinema/90 via-surface-cinema/50 to-surface-cinema/20',
                  )}
                />

                {/* Стрелка перехода */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-5 right-5 flex size-10 items-center justify-center rounded-full text-content-on-cinema transition-[opacity,scale] duration-500 ease-out',
                    isActive
                      ? 'bg-accent/80 opacity-100 scale-100'
                      : 'bg-surface-glass-on-cinema opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100',
                  )}
                >
                  <ArrowUpRight className="size-4" />
                </span>

                {/* Контентная плашка */}
                <div className="relative z-10 flex w-full flex-col justify-end">
                  <span className="font-display font-bold tracking-tight text-content-on-cinema uppercase text-2xl lg:text-3xl whitespace-nowrap overflow-hidden text-ellipsis">
                    {t(danceStyleLabelKey(tile.style as never))}
                  </span>

                  {/* Дополнительная информация, плавно раскрывающаяся у активной кулисы */}
                  <div
                    className={cn(
                      'overflow-hidden flex flex-col mt-2 transition-[opacity,translate] duration-500 ease-out',
                      isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
                    )}
                  >
                    <span data-style-count="" className="text-caption text-content-on-cinema-muted">
                      {tCommon('counts.classes', { count: tile.classCount })}
                    </span>

                    <span className="text-caption mt-2 inline-flex items-center gap-1 font-semibold text-accent-on-cinema">
                      {tCommon('actions.book')}
                      <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </PortalLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
