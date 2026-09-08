/**
 * EVENT CARD — карточка события: воркшоп, батл, мастер-класс.
 *
 * Бейдж даты — число и месяц, собранные форматтером локали, а не строка «15 SEP»
 * из данных: в армянской версии месяц обязан быть армянским. Число вынесено в
 * display-гарнитуру, как в макете.
 *
 * Дата ещё и машиночитаема: `<time dateTime>` даёт поисковику и скринридеру
 * полную дату, тогда как «15 SEP» без года не значит ничего.
 *
 * Бесплатный вход выводится словом, а не нулём: «0 ֏» читается как ошибка
 * данных, а не как «вход свободный».
 */

import { useFormatter, useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Media } from '@/components/ui/media';
import { Price } from '@/components/ui/price';
import { SpotsLeft } from '@/components/ui/spots-left';
import { routes } from '@/config';
import { resolveMedia, type EventCardItem } from '@/domain/content';
import { eventTypeLabelKey } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

interface EventCardProps {
  item: EventCardItem;
  locale: Locale;
  className?: string;
}

export function EventCard({ item, locale, className }: EventCardProps) {
  const t = useTranslations();
  const format = useFormatter();

  const isFree = item.price <= 0;

  return (
    <article
      className={cn(
        'card-surface group relative flex h-full flex-col overflow-hidden rounded-lg',
        'border border-border-default bg-surface-card',
        'hover:-translate-y-1.5 hover:shadow-lg',
        'focus-within:-translate-y-1.5 focus-within:shadow-lg',
        className,
      )}
    >
      <div className="relative">
        <Media
          {...resolveMedia(item.image, locale)}
          preset="studioCard"
          fallback="event"
          imageClassName="media-zoom group-hover:scale-105"
        />

        {/* Бейдж даты: число крупно, месяц под ним — как в макете. */}
        <time
          dateTime={item.startsAt}
          className={cn(
            'absolute top-3 left-3 grid place-items-center rounded-md px-3 py-2',
            'bg-accent text-content-on-accent shadow-md',
          )}
        >
          <span className="text-heading-4 leading-none">
            {format.dateTime(new Date(item.startsAt), { day: 'numeric' })}
          </span>
          <span className="text-2xs mt-0.5 uppercase">
            {format.dateTime(new Date(item.startsAt), { month: 'short' })}
          </span>
        </time>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <Badge variant="accent" className="self-start">
          {t(eventTypeLabelKey(item.type as never))}
        </Badge>

        <h3 className="text-card-title mt-3">
          <Link
            href={routes.event(item.slug)}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {item.title}
          </Link>
        </h3>

        <p className="text-body-sm mt-1.5 text-content-secondary">
          {item.locationName} · {item.startTime}—{item.endTime}
        </p>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border-default pt-3">
          {isFree ? (
            <span className="text-price text-content-primary">{t('events.freeEntry')}</span>
          ) : (
            <Price amount={item.price} emphasis="total" />
          )}
          <SpotsLeft spots={item.spotsLeft} />
        </div>
      </div>
    </article>
  );
}
