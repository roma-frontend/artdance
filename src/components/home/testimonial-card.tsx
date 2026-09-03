/**
 * TESTIMONIAL CARD — отзыв с крупной кавычкой-водяным знаком.
 *
 * Кавычка — псевдоэлемент (`.quote-watermark`), а не символ в разметке: она
 * декоративна, и в тексте отзыва её быть не должно — скринридер прочитал бы её
 * как часть цитаты.
 *
 * Разметка семантическая: `<blockquote>` для текста и `<figcaption>` для автора.
 * В прототипе это набор `div`, из-за чего цитата и подпись для скринридера
 * сливаются в один абзац, а связь «кто это сказал» теряется.
 */

import { Media } from '@/components/ui/media';
import { RatingStars } from '@/components/ui/rating-stars';
import { reviews } from '@/config';
import { resolveMedia, type HomeTestimonial } from '@/domain/content';
import type { Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

interface TestimonialCardProps {
  item: HomeTestimonial;
  locale: Locale;
  className?: string;
}

export function TestimonialCard({ item, locale, className }: TestimonialCardProps) {
  return (
    <figure
      className={cn(
        'quote-watermark relative flex h-full flex-col overflow-hidden rounded-xl',
        'border border-border-default bg-surface-card p-6',
        className,
      )}
    >
      {/*
        Рейтинг отзыва — одна оценка, а не среднее по выборке, поэтому порог
        `minCountToDisplayAverage` к нему не применяется: `count` равен единице
        по смыслу, и звёзды показывают именно её.
      */}
      <RatingStars
        rating={item.rating}
        count={reviews.minCountToDisplayAverage}
        hideCount
        className="relative"
      />

      <blockquote className="text-quote relative mt-4 text-content-primary">{item.body}</blockquote>

      <figcaption className="relative mt-6 flex items-center gap-3">
        <Media
          {...resolveMedia(item.image, locale)}
          preset="avatar"
          fallback="avatar"
          className="size-11 shrink-0 rounded-full"
        />
        <span>
          <span className="text-body-sm block font-semibold text-content-primary">
            {item.authorName}
          </span>
          <span className="text-caption block text-content-tertiary">{item.authorRole}</span>
        </span>
      </figcaption>
    </figure>
  );
}
