import { ArrowUpRightIcon, MapPinIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Media } from '@/components/ui/media';
import { Price } from '@/components/ui/price';
import { SpotsLeft } from '@/components/ui/spots-left';
import { routes } from '@/config';
import { resolveMedia, type EventCardItem } from '@/domain/content';
import { eventTypeLabelKey } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';

/** The first live curated event, not a second copy of the same ticket in the grid. */
export function EventSpotlight({ item, locale }: { item: EventCardItem; locale: Locale }) {
  const t = useTranslations();
  const format = useFormatter();
  return (
    <article data-slot="event-spotlight" className="event-spotlight relative mb-6 grid overflow-hidden rounded-2xl border border-border-default bg-surface-card md:grid-cols-2">
      <div className="relative overflow-hidden">
        <Media {...resolveMedia(item.image, locale)} preset="eventSpotlight" fallback="event" imageClassName="event-spotlight-image" />
        <span aria-hidden className="event-poster-light" />
        <time dateTime={item.startsAt} className="absolute top-6 left-6 rounded-xl bg-accent px-4 py-3 text-content-on-accent shadow-lg">
          <span className="text-heading-1 block">{format.dateTime(new Date(item.startsAt), { day: 'numeric' })}</span>
          <span className="text-label block uppercase">{format.dateTime(new Date(item.startsAt), { month: 'short', year: 'numeric' })}</span>
        </time>
      </div>
      <div className="flex min-w-0 flex-col p-6 sm:p-8 lg:p-10">
        <p className="text-eyebrow text-content-secondary">{t('home.eventSpotlight.eyebrow')}</p>
        <p className="text-label mt-4 text-content-secondary">{t(eventTypeLabelKey(item.type as never))}</p>
        <h3 className="text-heading-2 mt-3 wrap-break-word">{item.title}</h3>
        <p className="text-body-sm mt-4 flex items-start gap-2 text-content-secondary"><MapPinIcon className="mt-0.5 size-4 shrink-0" aria-hidden />{item.locationName}</p>
        <p className="text-body-sm mt-2 text-content-secondary">{item.startTime}—{item.endTime}</p>
        <div className="mt-6 flex flex-wrap items-center gap-5">
          {item.price <= 0 ? <span className="text-price">{t('events.freeEntry')}</span> : <Price amount={item.price} emphasis="total" />}
          <SpotsLeft spots={item.spotsLeft} />
        </div>
        <Button asChild className="mt-6 self-start"><Link href={routes.event(item.slug)}>{t('home.eventSpotlight.cta')}<ArrowUpRightIcon className="size-4" aria-hidden /></Link></Button>
      </div>
    </article>
  );
}
