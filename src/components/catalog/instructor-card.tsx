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

import { BadgeCheckIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Media } from '@/components/ui/media';
import { Price } from '@/components/ui/price';
import { RatingStars } from '@/components/ui/rating-stars';
import { routes } from '@/config';
import { resolveMedia, type HomeInstructorCard } from '@/domain/content';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

interface InstructorCardProps {
  item: HomeInstructorCard;
  locale: Locale;
  className?: string;
}

export function InstructorCard({ item, locale, className }: InstructorCardProps) {
  const t = useTranslations();

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
          preset="instructorCard"
          fallback="instructor"
          imageClassName="media-zoom group-hover:scale-105 group-hover:brightness-90"
        />

        {item.isVerified && (
          <span
            title={t('instructor.verifiedBadge')}
            className="absolute top-3 right-3 grid size-6 place-items-center rounded-full bg-success text-content-on-accent"
          >
            <BadgeCheckIcon className="size-3.5" aria-hidden />
            <span className="sr-only">{t('instructor.verifiedBadge')}</span>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-card-title">
          <Link
            href={routes.instructor(item.slug)}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {item.name}
          </Link>
        </h3>

        <p className="text-eyebrow mt-1.5 text-metal">{item.headline}</p>

        <div className="text-caption mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-content-tertiary">
          <RatingStars rating={item.ratingAverage} count={item.ratingCount} hideCount />
          <span>{t('common.units.yearsExperience', { count: item.yearsExperience })}</span>
        </div>

        <div className="mt-auto pt-4">
          <Price amount={item.hourlyRateFrom} unit="perHour" from emphasis="total" />
        </div>
      </div>
    </article>
  );
}
