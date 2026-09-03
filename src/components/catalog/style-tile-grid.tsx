/**
 * STYLE TILE GRID — сетка направлений с фотографией и счётчиком занятий.
 *
 * Перенос блока `.cats` / `.cat` из прототипа. Три решения, которых в макете нет.
 *
 * **1. Плитка — это ссылка, а не `div` с `onclick`.** В прототипе по плитке
 * нельзя перейти с клавиатуры, нельзя открыть в новой вкладке и нельзя увидеть
 * адрес в статусной строке. Здесь это `<a>` с фильтром в URL
 * (`routes.discover({ style })`), поэтому подборка направления — шарящаяся и
 * индексируемая ссылка.
 *
 * **2. Плитка НЕ поднимается при наведении.** В макете у `.cat` нет
 * `translateY`: меняется только фотография (приближение и затемнение) и подписи.
 * Класс `card-surface` на ней нужен ради плавной смены цвета границы — если
 * добавить к нему подъём «для единообразия с карточками», сетка начнёт дрожать
 * при проведении курсором по строке.
 *
 * **3. Счётчик занятий доступен на touch-устройствах.** В прототипе он и стрелка
 * появляются только на hover, то есть на телефоне их не существует. Скрытое
 * состояние объявлено внутри `@media (hover: hover)` (`globals.css`), поэтому
 * там, где наведения нет, подписи видны сразу.
 *
 * Сетка следует макету по числу колонок (пять направлений в строку на широком
 * экране, две на телефоне), а пропорция плитки меняется с 1:1 на 3:4 — как в
 * прототипе, где на 480px `aspect-ratio` переключается на квадрат.
 */

import { ArrowUpRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Reveal } from '@/components/fx/reveal';
import { Media } from '@/components/ui/media';
import { routes } from '@/config';
import { danceStyleLabelKey } from '@/domain/enums';
import { resolveMedia, type MediaRef } from '@/domain/content';
import { Link } from '@/i18n/routing';
import type { Locale } from '@/i18n/config';

export interface StyleTile {
  style: string;
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
    <Reveal as="ul" variant="stagger" className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      {tiles.map((tile) => (
        <li key={tile.style}>
          <Link
            href={routes.discover({ style: tile.style })}
            className="card-surface group relative flex aspect-square items-end overflow-hidden rounded-lg border border-border-default hover:border-accent sm:aspect-portrait"
          >
            <Media
              {...resolveMedia(tile.image, locale)}
              preset="categoryCard"
              fill
              className="absolute inset-0 size-full"
              imageClassName="media-zoom group-hover:scale-108 group-hover:brightness-65 group-hover:saturate-120"
            />

            {/* Затемнение снизу: без него белая подпись теряется на светлом кадре. */}
            <span
              aria-hidden
              className="absolute inset-0"
              style={{ background: 'var(--scrim-bottom-strong)' }}
            />

            {/*
              Стрелка декоративна: смысл перехода несёт название направления,
              которое и является доступным именем ссылки.
            */}
            <span
              aria-hidden
              className="tile-arrow absolute top-4 right-4 flex size-9 items-center justify-center rounded-full text-content-on-cinema backdrop-blur-md"
              style={{ background: 'var(--surface-glass-on-cinema)' }}
            >
              <ArrowUpRight className="size-4" />
            </span>

            <span className="relative z-10 p-5">
              <span className="tile-title block text-card-title text-content-on-cinema">
                {t(danceStyleLabelKey(tile.style as never) as 'danceStyles.hipHop')}
              </span>
              <span className="tile-count text-caption mt-1 block text-content-on-cinema-muted">
                {tCommon('counts.classes', { count: tile.classCount })}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </Reveal>
  );
}
