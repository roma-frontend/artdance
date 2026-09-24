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

import { Badge } from '@/components/ui/badge';
import { FavoriteButton } from '@/components/ui/favorite-button';
import { Media } from '@/components/ui/media';
import { Price } from '@/components/ui/price';
import { RatingStars } from '@/components/ui/rating-stars';
import { routes } from '@/config';
import { resolveMedia, type VenueCardItem } from '@/domain/content';
import { venueAmenityLabelKey } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
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
      className={cn(
        'card-surface group relative flex h-full flex-col overflow-hidden rounded-lg',
        'border border-border-default bg-surface-card',
        'hover:-translate-y-1 hover:shadow-lg',
        'focus-within:-translate-y-1 focus-within:shadow-lg',
        className,
      )}
    >
      <div className="relative">
        <Media
          {...resolveMedia(item.image, locale)}
          preset="studioCard"
          fallback="studio"
          imageClassName="media-zoom group-hover:scale-105"
        />

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
          <Link
            href={routes.studio(item.slug)}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {item.name}
          </Link>
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
          <div className="flex items-center justify-between gap-3 border-t border-border-default pt-3">
            <Price amount={item.pricePerHour} unit="perHour" emphasis="total" />
            <RatingStars rating={item.ratingAverage} count={item.ratingCount} hideCount />
          </div>

          {/*
            CTA-полоса карточки. На десктопе прячется и проявляется при наведении,
            на touch и без hover — видна всегда. См. комментарий в class-card.tsx.
          */}
          <div className="card-cta mt-3">
            <div className="card-cta-row min-h-0 overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-t border-border-default pt-3">
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
      </div>
    </article>
  );
}
