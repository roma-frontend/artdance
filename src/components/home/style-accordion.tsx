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
import { useState } from 'react';

import { PortalLink } from '@/components/fx/portal-link';
import { Media } from '@/components/ui/media';
import { routes } from '@/config';
import { danceStyleLabelKey } from '@/domain/enums';
import { resolveMedia, type MediaRef } from '@/domain/content';
import type { Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

export interface StyleTile {
  style: string;
  slug: string;
  image: MediaRef;
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
  // По умолчанию активна средняя карточка (Salsa)
  const [activeIndex, setActiveIndex] = useState<number>(2);

  return (
    <div
      data-slot="style-accordion"
      className={cn('style-accordion-container relative w-full overflow-hidden my-4', className)}
    >
      <ul className="flex flex-col md:flex-row gap-3 md:gap-3.5 h-140! w-full">
        {tiles.map((tile, index) => {
          const isActive = activeIndex === index;
          const href = routes.style(tile.slug);

          return (
            <li
              key={tile.style}
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              className={cn(
                'relative h-full overflow-hidden rounded-2xl border transition-all duration-500 ease-out cursor-pointer',
                isActive
                  ? 'flex-[3.5] border-accent/80 shadow-[0_12px_40px_-10px_var(--accent-glow)]'
                  : 'flex-[1] border-border-default/60 hover:border-accent/40 opacity-75 hover:opacity-100',
              )}
            >
              <PortalLink
                href={href}
                data-cursor-label={tCommon('actions.explore')}
                className="group relative flex size-full items-end p-6 select-none"
              >
                {/* Фоновое фото */}
                <Media
                  {...resolveMedia(tile.image, locale)}
                  preset="categoryCard"
                  fill
                  className="absolute inset-0 size-full"
                  imageClassName={cn(
                    'size-full object-cover transition-all duration-700 ease-out',
                    isActive ? 'scale-105 filter-none' : 'scale-100 brightness-75 grayscale-[25%]',
                  )}
                />

                {/* Градиентное затемнение */}
                <div
                  aria-hidden="true"
                  className={cn(
                    'absolute inset-0 transition-opacity duration-500',
                    isActive
                      ? 'bg-gradient-to-t from-surface-cinema/95 via-surface-cinema/40 to-transparent'
                      : 'bg-gradient-to-t from-surface-cinema/90 via-surface-cinema/50 to-surface-cinema/20',
                  )}
                />

                {/* Стрелка перехода */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-5 right-5 flex size-10 items-center justify-center rounded-full text-content-on-cinema backdrop-blur-md transition-all duration-500',
                    isActive
                      ? 'bg-accent/80 opacity-100 scale-100'
                      : 'bg-surface-glass-on-cinema opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100',
                  )}
                >
                  <ArrowUpRight className="size-4" />
                </span>

                {/* Контентная плашка */}
                <div className="relative z-10 flex w-full flex-col justify-end">
                  <span className="font-display text-2xl lg:text-3xl font-bold tracking-tight text-content-on-cinema uppercase">
                    {t(danceStyleLabelKey(tile.style as never))}
                  </span>

                  {/* Дополнительная информация, плавно раскрывающаяся у активной кулисы */}
                  <div
                    className={cn(
                      'overflow-hidden transition-all duration-500 flex flex-col',
                      isActive ? 'max-h-24 opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0',
                    )}
                  >
                    <span className="text-caption text-content-on-cinema-muted">
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
