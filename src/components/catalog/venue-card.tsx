/**
 * VENUE CARD — карточка площадки для аренды.
 *
 * Оснащение показывается не полностью: три метки и «ещё N». Полный список из
 * восьми пунктов превращает карточку в таблицу и мешает сравнивать площадки
 * между собой — а именно для этого сетка и существует. Порог объявлен здесь
 * константой с именем, чтобы «почему три» был вопросом к одной строке.
 *
 * Район — иконка `lucide` плюс текст, а не эмодзи 📍 как в прототипе: эмодзи
 * рендерится по-разному в системах, а скринридер читает его как «булавка».
 */

import { MapPinIcon, ChevronRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { PortalLink } from '@/components/fx/portal-link';
import { Badge } from '@/components/ui/badge';
import { FavoriteButton } from '@/components/ui/favorite-button';
import { Media } from '@/components/ui/media';
import { Price } from '@/components/ui/price';
import { RatingStars } from '@/components/ui/rating-stars';
import { routes } from '@/config';
import { resolveMedia, type VenueCardItem } from '@/domain/content';
import { venueAmenityLabelKey } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

/** Сколько меток оснащения показывать до «ещё N». */
const VISIBLE_AMENITIES = 3;

interface VenueCardProps {
  item: VenueCardItem;
  locale: Locale;
  className?: string;
}

export function VenueCard({ item, locale, className }: VenueCardProps) {
  const t = useTranslations();

  const visible = item.amenities.slice(0, VISIBLE_AMENITIES);
  const hidden = item.amenities.length - visible.length;

  return (
    <article
      data-portal-card
      className={cn(
        'card-surface group relative flex h-full flex-col overflow-hidden rounded-lg',
        'border border-border-default bg-surface-card',
        'hover:-translate-y-1 hover:shadow-lg',
        'focus-within:-translate-y-1 focus-within:shadow-lg',
        className,
      )}
    >
      <div data-portal-media className="relative">
        <Media
          {...resolveMedia(item.image, locale)}
          preset="studioCard"
          fallback="studio"
          imageClassName="card-media media-zoom group-hover:scale-105"
        />
        <span aria-hidden data-cursor-light="" className="card-cursor-light" />

        {/*
          «Что внутри»: полное оснащение поверх кадра. Дубль списка ниже, поэтому
          aria-hidden и не `<ul>`; где наведения нет, панель не рисуется вовсе.
        */}
        {item.amenities.length > 0 && (
          <div
            aria-hidden
            className="card-inside liquid-glass absolute inset-x-3 bottom-3 rounded-md bg-surface-cinema/70 p-3 text-content-on-cinema"
          >
            <p className="text-eyebrow text-content-on-cinema-muted">{t('studio.amenitiesTitle')}</p>
            <p className="text-caption mt-1">
              {item.amenities.map((amenity) => t(venueAmenityLabelKey(amenity as never))).join(' · ')}
            </p>
          </div>
        )}

        <FavoriteButton
          target="venue"
          slug={item.slug}
          name={item.name}
          onMedia
          className="absolute top-2.5 right-2.5 z-10"
        />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-caption flex items-center gap-1.5 text-content-tertiary">
          <MapPinIcon className="size-3.5" aria-hidden />
          {item.district}
        </p>

        <h3 className="text-card-title mt-1.5">
          <PortalLink
            href={routes.studio(item.slug)}
            // Растянутая ссылка накрывает карточку: подпись кольца-курсора видна над всей ней.
            data-cursor-label={t('common.actions.explore')}
            className="after:absolute after:inset-0 after:z-10 after:content-[''] focus-visible:outline-none"
          >
            {item.name}
          </PortalLink>
        </h3>

        <p className="text-body-sm mt-2 text-content-secondary">{item.description}</p>

        <ul className="mt-3 flex flex-wrap gap-1.5">
          {visible.map((amenity) => (
            <li key={amenity}>
              <Badge size="sm">
                {t(venueAmenityLabelKey(amenity as never))}
              </Badge>
            </li>
          ))}
          {hidden > 0 && (
            <li>
              <Badge size="sm" variant="accent">
                {t('common.labels.andMore', { count: hidden })}
              </Badge>
            </li>
          )}
        </ul>

        <div className="mt-auto">
          {/*
            Подвал карточки: цена с рейтингом и «Записаться» в одном слоте,
            крестфейдом (см. class-card.tsx). Высота от hover не меняется.
          */}
          <div className="card-foot border-t border-border-default pt-3">
            <div className="card-foot-line flex items-center justify-between gap-3">
              <Price amount={item.pricePerHour} unit="perHour" emphasis="total" />
              <RatingStars rating={item.ratingAverage} count={item.ratingCount} hideCount />
            </div>

            <div className="card-foot-line card-cta flex items-center justify-between gap-3" aria-hidden="true">
              <span className="text-label font-semibold text-content-accent">
                {t('common.actions.book')}
              </span>
              <ChevronRightIcon
                aria-hidden
                className="card-cta-chevron size-4 text-content-accent"
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
