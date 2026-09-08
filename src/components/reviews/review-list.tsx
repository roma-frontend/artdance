/**
 * REVIEW LIST — отзывы на детальной странице.
 *
 * Один список на занятие, инструктора и площадку: расхождение в том, как
 * показан отзыв, между разделами не имеет смысла, а поддерживать три копии
 * пришлось бы всерьёз.
 *
 * Три решения.
 *
 * **Средняя оценка и число отзывов разделены.** Среднее скрывается ниже
 * `reviews.minCountToDisplayAverage` (это решает `RatingStars`), а количество
 * показывается всегда: «отзывов пока мало» — полезная информация, «4,9 по одному
 * отзыву» — вводящая в заблуждение.
 *
 * **Пустое состояние обязательно.** В прототипе его нет ни у одного списка. У
 * нового инструктора отзывов не будет вообще, и пустой блок с заголовком
 * «Отзывы» читается как незагрузившийся.
 *
 * **Бейдж «подтверждённая бронь» — не украшение.** Он появляется только при
 * `reviews.requireVerifiedPurchase`: если правило выключат, бейдж исчезнет
 * вместе с ним, а не останется неверным обещанием.
 */

import { BadgeCheckIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Media } from '@/components/ui/media';
import { RatingStars } from '@/components/ui/rating-stars';
import { reviews as reviewRules } from '@/config';
import { resolveMedia, type RatingSummary, type ReviewItem } from '@/domain/content';
import type { Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

interface ReviewListProps {
  rating: RatingSummary;
  items: readonly ReviewItem[];
  locale: Locale;
  /** Заголовок раздела. Уровень задаётся страницей, а не компонентом. */
  title: string;
  className?: string;
}

export function ReviewList({ rating, items, locale, title, className }: ReviewListProps) {
  const t = useTranslations('reviews');

  return (
    <section className={cn('scroll-mt-(--layout-nav-height)', className)} id="reviews">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-heading-3">{title}</h2>
        <RatingStars rating={rating.average} count={rating.count} size="md" />
      </div>

      {items.length === 0 ? (
        /*
         * `status`/`polite`: раздел может обновиться после публикации отзыва без
         * перезагрузки страницы.
         */
        <p
          role="status"
          className="text-body rounded-lg border border-dashed border-border-default bg-surface-raised px-6 py-10 text-center text-content-secondary"
        >
          {t('empty')}
          <span className="text-body-sm mt-1 block text-content-tertiary">{t('emptyHint')}</span>
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="quote-watermark relative overflow-hidden rounded-lg border border-border-default bg-surface-card p-6"
            >
              <RatingStars rating={item.rating} count={reviewRules.minCountToDisplayAverage} />

              <p className="text-body mt-4 text-content-secondary">{item.body}</p>

              <footer className="mt-5 flex items-center gap-3">
                <Media
                  {...resolveMedia(item.image, locale)}
                  preset="avatar"
                  fallback="avatar"
                  className="size-11 shrink-0 rounded-full"
                />

                <div className="min-w-0">
                  <p className="text-body font-semibold text-content-primary">{item.authorName}</p>
                  <p className="text-caption text-content-tertiary">{item.authorRole}</p>
                </div>

                {item.isVerifiedPurchase && (
                  <Badge variant="success" size="sm" className="ms-auto shrink-0">
                    <BadgeCheckIcon aria-hidden className="size-3" />
                    {t('verifiedBadge')}
                  </Badge>
                )}
              </footer>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
