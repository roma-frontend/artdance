/**
 * INSTRUCTOR CARD — карточка инструктора.
 *
 * Бейдж верификации в прототипе — зелёный круг с галочкой без подписи: для
 * скринридера это ничего не значащая картинка, а для зрячего пользователя —
 * догадка. Здесь у него есть текстовая альтернатива (`instructor.verifiedBadge`),
 * а сам значок `aria-hidden`.
 *
 * Рейтинг рисует `RatingStars`, который сам решает, показывать ли среднюю оценку:
 * у нового инструктора с двумя отзывами «5.0» вводило бы в заблуждение.
 *
 * Цена — «от», а не точная: ставка зависит от длительности и места занятия.
 */

import { BadgeCheckIcon, ChevronRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { PortalLink } from '@/components/fx/portal-link';
import { Media } from '@/components/ui/media';
import { FavoriteButton } from '@/components/ui/favorite-button';
import { Price } from '@/components/ui/price';
import { RatingStars } from '@/components/ui/rating-stars';
import { routes } from '@/config';
import { resolveMedia, type InstructorCardItem } from '@/domain/content';
import type { Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

interface InstructorCardProps {
  item: InstructorCardItem;
  locale: Locale;
  /**
   * Куда ведёт карточка. По умолчанию — профиль инструктора; на странице входа в
   * бронирование это сразу выбор даты, потому что там у карточки одна задача.
   */
  href?: string;
  className?: string;
}

export function InstructorCard({ item, locale, href, className }: InstructorCardProps) {
  const t = useTranslations();

  return (
    <article
      data-portal-card
      className={cn(
        'card-surface group relative flex h-full flex-col overflow-hidden rounded-lg',
        'border border-border-default bg-surface-card',
        'hover:-translate-y-1.5 hover:shadow-lg',
        'focus-within:-translate-y-1.5 focus-within:shadow-lg',
        className,
      )}
    >
      <div data-portal-media className="relative">
        <Media
          {...resolveMedia(item.image, locale)}
          preset="instructorCard"
          fallback="instructor"
          imageClassName="card-media media-zoom group-hover:scale-105"
        />
        {/* Hover cutaway: кадр уходит в монохром, цвет остаётся только в круге под курсором. */}
        <span aria-hidden className="card-spotlight" />

        {item.isVerified && (
          <span
            title={t('instructor.verifiedBadge')}
            className="absolute top-3 left-3 grid size-6 place-items-center rounded-full bg-success text-content-on-accent"
          >
            <BadgeCheckIcon className="size-3.5" aria-hidden />
            <span className="sr-only">{t('instructor.verifiedBadge')}</span>
          </span>
        )}

        {/*
          Сердечко справа, знак верификации слева: в прототипе знак стоял справа,
          но сохранить фаворитом инструктора важнее, чем видеть галочку именно в
          этом углу, а две круглые метки в одном углу читаются как одна.
        */}
        <FavoriteButton
          target="instructor"
          slug={item.slug}
          name={item.name}
          onMedia
          className="absolute top-2.5 right-2.5 z-10"
        />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-card-title">
          <PortalLink
            href={href ?? routes.instructor(item.slug)}
            // Растянутая ссылка накрывает карточку: подпись кольца-курсора видна над всей ней.
            data-cursor-label={t('common.actions.explore')}
            className="after:absolute after:inset-0 after:z-10 after:content-[''] focus-visible:outline-none"
          >
            {item.name}
          </PortalLink>
        </h3>

        <p className="text-eyebrow mt-1.5 text-content-metal">{item.headline}</p>

        <div className="text-caption mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-content-tertiary">
          <RatingStars rating={item.ratingAverage} count={item.ratingCount} hideCount />
          <span>{t('common.units.yearsExperience', { count: item.yearsExperience })}</span>
        </div>

        <div className="mt-auto">
          {/*
            Подвал карточки: цена и «Записаться» в одном слоте, крестфейдом
            (см. class-card.tsx). Высота от hover не меняется.
          */}
          <div className="card-foot pt-4">
            <div className="card-foot-line">
              <Price amount={item.hourlyRateFrom} unit="perHour" from emphasis="total" />
            </div>

            <div className="card-foot-line card-cta flex items-center justify-between gap-3 border-t border-border-default pt-3" aria-hidden="true">
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
