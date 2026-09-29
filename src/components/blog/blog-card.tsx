/**
 * Блог — карточка статьи.
 *
 * Дизайн: тёмный editorial-акцент + светлая карточка, как у остальных разделов.
 * Первая карточка (featured) — крупнее: тянется на две колонки на десктопе.
 */

import { CalendarDaysIcon, Clock3Icon, EyeIcon } from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';

import { Media } from '@/components/ui/media';
import { Badge } from '@/components/ui/badge';
import { resolveMedia, type MediaRef } from '@/domain/content';
import type { BlogCardItem } from '@/domain/blog';
import { routes } from '@/config';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

interface BlogCardProps {
  item: BlogCardItem;
  locale: Locale;
  featured?: boolean;
  priority?: boolean;
}

export async function BlogCard({ item, locale, featured = false, priority = false }: BlogCardProps) {
  const tRoot = await getTranslations({ locale });
  const format = await getFormatter({ locale });

  const readingLabel = (tRoot as unknown as (k: string, v?: Record<string, unknown>) => string)('blog.readingTime', { count: item.readingMinutes });
  const dateLabel = format.dateTime(new Date(item.publishedAt), { dateStyle: 'medium' });

  const imageRef: MediaRef | null = item.image;

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border border-border-default bg-surface-card',
        'hover:-translate-y-1 hover:shadow-xl transition-all duration-200',
        featured && 'md:col-span-2 lg:col-span-2',
      )}
    >
      <Link href={routes.blogPost(item.slug)} className="absolute inset-0 z-10" aria-label={item.title}>
        <span className="sr-only">{item.title}</span>
      </Link>

      <div className={cn('relative overflow-hidden', featured ? 'aspect-[16/9]' : 'aspect-[16/10]')}>
        {imageRef ? (
          <Media
            {...resolveMedia(imageRef, locale)}
            preset="studioCard"
            fill
            priority={priority}
            fallback="event"
            imageClassName="transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-surface-sunken to-metal/10 flex items-center justify-center">
            <span className="text-5xl opacity-20">✦</span>
          </div>
        )}

        {/* Category badge */}
        {item.category && (
          <div className="absolute left-3 top-3 z-20">
            <Badge variant="accent" size="sm">
              {item.category}
            </Badge>
          </div>
        )}

        {/* Subtle gradient for text legibility when no badge overlaps */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/15 to-transparent pointer-events-none" />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3
          className={cn(
            'font-display font-bold leading-tight text-content-primary line-clamp-2',
            featured ? 'text-xl md:text-2xl' : 'text-base md:text-lg',
          )}
        >
          {item.title}
        </h3>

        <p className="mt-2 line-clamp-2 text-body-sm text-content-secondary">{item.excerpt}</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-surface-sunken px-2.5 py-0.5 text-2xs font-medium text-content-secondary"
            >
              #{tag}
            </span>
          ))}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-3 pt-4 text-caption text-content-tertiary">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDaysIcon aria-hidden className="size-3.5" />
            {dateLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3Icon aria-hidden className="size-3.5" />
            {readingLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <EyeIcon aria-hidden className="size-3.5" />
            {item.viewCount}
          </span>
          {item.authorName && <span className="ml-auto font-medium text-content-secondary">{item.authorName}</span>}
        </div>
      </div>
    </article>
  );
}
