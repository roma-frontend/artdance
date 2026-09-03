/**
 * CLASS CARD — карточка занятия.
 *
 * Что в этой карточке решено осознанно.
 *
 * **Ссылка одна на всю карточку, а не на каждый элемент.** В прототипе кликается
 * `div` через `onclick` — такая карточка недоступна с клавиатуры и не открывается
 * в новой вкладке. Здесь якорь растянут на карточку псевдоэлементом, поэтому
 * доступное имя ссылки — название занятия, а не весь текст блока.
 *
 * **Бейджи взаимоисключающие.** «В тренде» и «мест нет» одновременно —
 * противоречие: то, что нельзя купить, не рекламируют. Приоритет у «мест нет»:
 * это ограничение, а оно важнее рекламы.
 *
 * **Расписание собирается из числа и времени**, а не приходит готовой строкой:
 * «Saturday, 18:00» из данных означало бы английский день недели на армянской
 * странице.
 *
 * Кнопки «в избранное» здесь пока нет намеренно: она требует сессии, а показывать
 * сердечко, которое ничего не делает, — хуже, чем не показывать его вовсе. Придёт
 * с волной аутентификации (`FavoriteButton` в карте компонентов).
 */

import { useFormatter, useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Media } from '@/components/ui/media';
import { Price } from '@/components/ui/price';
import { SpotsLeft } from '@/components/ui/spots-left';
import { routes } from '@/config';
import { resolveMedia, type HomeClassCard } from '@/domain/content';
import { danceStyleLabelKey, skillLevelLabelKey } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { dateForWeekday } from '@/lib/format/weekday';
import { cn } from '@/lib/utils';

interface ClassCardProps {
  item: HomeClassCard;
  locale: Locale;
  className?: string;
}

export function ClassCard({ item, locale, className }: ClassCardProps) {
  const t = useTranslations();
  const format = useFormatter();

  const soldOut = item.spotsLeft <= 0;

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
          preset="classCard"
          fallback="classCard"
          imageClassName="media-zoom group-hover:scale-105"
        />

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
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-caption flex flex-wrap items-center gap-2 text-content-tertiary">
          <span>{t(danceStyleLabelKey(item.style as never) as 'danceStyles.hipHop')}</span>
          <i aria-hidden className="size-1 shrink-0 rounded-full bg-border-strong" />
          <span>{t(skillLevelLabelKey(item.level as never) as 'levels.beginner')}</span>
          <i aria-hidden className="size-1 shrink-0 rounded-full bg-border-strong" />
          <span>{t('common.units.minutes', { count: item.durationMinutes })}</span>
        </p>

        <h3 className="text-card-title mt-2">
          {/*
            Растянутый якорь: кликается вся карточка, но доступное имя ссылки —
            только название занятия. `focus-visible` виден на всей карточке через
            `focus-within` выше.
          */}
          <Link
            href={routes.class(item.slug)}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {item.title}
          </Link>
        </h3>

        <p className="text-body-sm mt-1 text-content-secondary">
          {item.instructorName}
          {' · '}
          {format.dateTime(dateForWeekday(item.weekday), 'weekdayLong')}
          {', '}
          {item.startTime}
        </p>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border-default pt-3">
          <Price amount={item.price} unit="perClass" />
          <SpotsLeft spots={item.spotsLeft} waitlistOpen={item.waitlistOpen} />
        </div>
      </div>
    </article>
  );
}
