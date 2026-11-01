/**
 * CLASS CARD — карточка занятия.
 *
 * Что в этой карточке решено осознанно.
 *
 * **Название — ссылка на занятие, подвал — ссылка на запись.** В прототипе кликается
 * `div` через `onclick` — такая карточка недоступна с клавиатуры и не открывается
 * в новой вкладке. Якорь названия растянут на карточку псевдоэлементом, поэтому
 * его доступное имя — название занятия, а не весь текст блока.
 *
 * **Бейджи взаимоисключающие.** «В тренде» и «мест нет» одновременно —
 * противоречие: то, что нельзя купить, не рекламируют. Приоритет у «мест нет»:
 * это ограничение, а оно важнее рекламы.
 *
 * **Расписание собирается из числа и времени**, а не приходит готовой строкой:
 * «Saturday, 18:00» из данных означало бы английский день недели на армянской
 * странице.
 *
 * **Сердечко видно всегда.** В прототипе `♡` появляется только при наведении
 * курсора — на телефоне такая кнопка недостижима в принципе. Отметка работает и
 * без входа: набор гостя живёт в браузере и переносится в аккаунт при входе.
 */

import { ChevronRightIcon, GraduationCapIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

import { CardQuickActions } from '@/components/catalog/card-quick-actions';
import { PortalLink } from '@/components/fx/portal-link';
import { Badge } from '@/components/ui/badge';
import { Media } from '@/components/ui/media';
import { Price } from '@/components/ui/price';
import { SpotsLeft } from '@/components/ui/spots-left';
import { routes } from '@/config';
import { resolveMedia, type ClassCardItem } from '@/domain/content';
import { danceStyleLabelKey, lessonTypeLabelKey, skillLevelLabelKey } from '@/domain/enums';
import { disciplineLabelKey } from '@/domain/dancesport';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { dateForWeekday } from '@/lib/format/weekday';
import { cn } from '@/lib/utils';

interface ClassCardProps {
  item: ClassCardItem;
  locale: Locale;
  className?: string;
}

export function ClassCard({ item, locale, className }: ClassCardProps) {
  const t = useTranslations();
  const format = useFormatter();

  const soldOut = item.spotsLeft <= 0;
  // Как кнопка на странице занятия; карточка из старого кеша без instructorSlug ведёт на занятие.
  const footHref = item.instructorSlug
    ? routes.instructorBooking(item.instructorSlug, item.slug)
    : routes.class(item.slug);
  const bookAction = t(soldOut ? 'common.actions.joinWaitlist' : 'common.actions.book');
  const directionLabel = item.danceSportDiscipline
    ? t(disciplineLabelKey(item.danceSportDiscipline as never))
    : t(danceStyleLabelKey(item.style as never));

  return (
    <article
      data-portal-card
      className={cn(
        'card-surface group relative flex h-full flex-col overflow-hidden rounded-lg',
        'border border-border-default bg-surface-card',
        'hover:shadow-md focus-within:shadow-md',
        className,
      )}
    >
      <div data-portal-media className="relative">
        <Media
          {...resolveMedia(item.image, locale)}
          preset="classCard"
          fallback="classCard"
          imageClassName="card-media media-zoom"
        />
        {/* При наведении обложка сменяется портретом ведущего; имя уже есть текстом ниже. */}
        {item.instructorImage && (
          <div aria-hidden className="card-swap absolute inset-0">
            <Media
              {...resolveMedia(item.instructorImage, locale)}
              alt=""
              preset="classCard"
              priority={false}
              fill
              className="size-full"
              imageClassName="media-zoom"
            />
            <span className="card-swap-caption liquid-glass text-caption absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-content-on-cinema">
              <GraduationCapIcon aria-hidden className="size-3.5" />
              {item.instructorName}
            </span>
          </div>
        )}
        <span aria-hidden data-cursor-light="" className="card-cursor-light" />

        {/* Приоритет у ограничения: заполненную группу не рекламируют. */}
        {soldOut ? (
          <Badge variant="signal" size="sm" className="absolute top-3 left-3">
            {t('classDetail.fullBadge')}
          </Badge>
        ) : (
          item.isTrending && (
            <Badge variant="onMedia" size="sm" className="absolute top-3 left-3">
              {t('classDetail.trendingBadge')}
            </Badge>
          )
        )}

        {/* Сердечко поверх кадра и тулбар «Explore / Book» у него — см. CardQuickActions. */}
        <CardQuickActions
          target="class"
          slug={item.slug}
          name={item.title}
          exploreHref={routes.class(item.slug)}
          bookHref={footHref}
          bookLabel={bookAction}
        />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-caption flex flex-wrap items-center gap-2 text-content-tertiary">
          <span>{directionLabel}</span>
          {item.lessonType && (
            <>
              <i aria-hidden className="size-1 shrink-0 rounded-full bg-border-strong" />
              <span>{t(lessonTypeLabelKey(item.lessonType as never))}</span>
            </>
          )}
          <i aria-hidden className="size-1 shrink-0 rounded-full bg-border-strong" />
          <span>{t(skillLevelLabelKey(item.level as never))}</span>
          <i aria-hidden className="size-1 shrink-0 rounded-full bg-border-strong" />
          <span>{t('common.units.minutes', { count: item.durationMinutes })}</span>
        </p>

        <h3 className="text-card-title mt-2">
          {/*
            Растянутый якорь: кликается карточка, кроме подвала. Доступное имя —
            только название занятия. `focus-visible` виден на всей карточке через
            `focus-within` выше.
          */}
          <PortalLink
            href={routes.class(item.slug)}
            // Растянутая ссылка накрывает карточку: подпись кольца-курсора видна над всей ней.
            data-cursor-label={t('common.actions.explore')}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {item.title}
          </PortalLink>
        </h3>

        <p className="text-body-sm mt-1 text-content-secondary">
          {item.instructorName}
          {' · '}
          {format.dateTime(dateForWeekday(item.weekday), 'weekdayLong')}
          {', '}
          {item.startTime}
        </p>

        <div className="mt-auto">
          {/*
            Цена и доступность остаются видимыми; справа проявляется стрелка.
            Её место зарезервировано — hover не меняет высоту карточки.
          */}
          <Link
            href={footHref}
            aria-label={`${bookAction}: ${item.title}`}
            data-cursor-label={bookAction}
            className="card-foot card-foot-link border-t border-border-default pt-3"
          >
            <div className="card-foot-line flex flex-wrap items-center justify-between gap-3">
              <Price amount={item.price} unit="perClass" />
              <SpotsLeft spots={item.spotsLeft} waitlistOpen={item.waitlistOpen} />
            </div>

            <div className="card-foot-line card-cta flex flex-wrap items-center justify-between gap-3" aria-hidden="true">
              <span className="text-label font-semibold text-content-accent">
                {bookAction}
              </span>
              <ChevronRightIcon
                aria-hidden
                className="card-cta-chevron size-4 text-content-accent"
              />
            </div>
          </Link>
        </div>
      </div>
    </article>
  );
}
