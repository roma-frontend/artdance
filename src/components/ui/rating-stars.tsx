/**
 * RATING STARS — рейтинг звёздами с числом отзывов.
 *
 * Три правила, которые компонент делает обязательными.
 *
 * **1. Ниже порога средний рейтинг не показывается.** Два отзыва не дают «4.9» —
 * это создаёт ложное впечатление проверенности. Порог —
 * `reviews.minCountToDisplayAverage`, и ниже него выводится только число
 * отзывов. Решать это в каждой карточке заново значит однажды забыть.
 *
 * **2. Звёзды — картинка, число — текст.** Сами звёзды `aria-hidden`, а
 * скринридер получает строку «Оценка 4.9 из 5» (`a11y.ratingStars`). Пять
 * символов ★ в дереве доступности читаются как «звезда звезда звезда…».
 *
 * **3. Дробная часть отображается заливкой, а не округлением.** 4.6 — это не
 * пять звёзд и не четыре: половина последней звезды закрашивается по ширине.
 */

import { StarIcon } from 'lucide-react';

import { reviews } from '@/config';
import { cn } from '@/lib/utils';
import { useFormatter, useTranslations } from 'next-intl';

interface RatingStarsProps {
  /** Средняя оценка в шкале `reviews.minRating`…`reviews.maxRating`. */
  rating: number;
  /** Число отзывов. Определяет, показывать ли среднее вообще. */
  count: number;
  size?: 'sm' | 'md';
  /** Скрыть число отзывов рядом со звёздами (в плотных карточках). */
  hideCount?: boolean;
  className?: string;
}

export function RatingStars({
  rating,
  count,
  size = 'sm',
  hideCount = false,
  className,
}: RatingStarsProps) {
  const t = useTranslations();
  const format = useFormatter();

  const enoughReviews = count >= reviews.minCountToDisplayAverage;
  const starClass = size === 'sm' ? 'size-3.5' : 'size-4';

  /* Отзывов мало — показываем только их количество, без выдуманной средней. */
  if (!enoughReviews) {
    return (
      <span className={cn('text-caption text-content-tertiary', className)}>
        {t('common.counts.reviews', { count })}
      </span>
    );
  }

  const clamped = Math.min(reviews.maxRating, Math.max(0, rating));
  /** Доля закрашенных звёзд в процентах — одна заливка на всю строку. */
  const filledPercent = (clamped / reviews.maxRating) * 100;

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span
        role="img"
        aria-label={t('a11y.ratingStars', {
          rating: format.number(clamped, 'rating'),
          max: reviews.maxRating,
        })}
        className="relative inline-flex"
      >
        {/* Нижний слой: контуры всех звёзд. */}
        <span aria-hidden className="inline-flex gap-0.5 text-border-strong">
          {Array.from({ length: reviews.maxRating }, (_, index) => (
            <StarIcon key={index} className={starClass} />
          ))}
        </span>

        {/* Верхний слой: те же звёзды, обрезанные по доле оценки. */}
        <span
          aria-hidden
          className="absolute inset-0 inline-flex gap-0.5 overflow-hidden text-metal"
          style={{ width: `${filledPercent}%` }}
        >
          {Array.from({ length: reviews.maxRating }, (_, index) => (
            <StarIcon key={index} className={cn(starClass, 'shrink-0 fill-current')} />
          ))}
        </span>
      </span>

      <span className="text-caption font-semibold text-metal">
        {format.number(clamped, 'rating')}
      </span>

      {!hideCount && (
        <span className="text-caption text-content-tertiary">
          {t('common.counts.reviews', { count })}
        </span>
      )}
    </span>
  );
}
