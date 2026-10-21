/**
 * КАРТОЧКА КУРСА.
 *
 * Показывает три вещи, по которым курс выбирают: чему учат (направление и
 * уровень), сколько это займёт (число уроков и суммарная длительность) и кто
 * ведёт. Цена — отдельным блоком, потому что она может отсутствовать у
 * бесплатного курса.
 *
 * Ссылка растянута на карточку через `after:absolute inset-0`, а не обёрнута
 * вокруг `<article>`: карточка содержит картинку с alt и отдельные подписи, и
 * обёртка-ссылка заставила бы скринридер прочитать всю карточку как название
 * ссылки, включая количество уроков.
 */

import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Media } from '@/components/ui/media';
import { Price } from '@/components/ui/price';
import { routes } from '@/config';
import { resolveMedia } from '@/domain/content';
import { danceStyleLabelKey, skillLevelLabelKey } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import type { CourseCard as CourseCardItem } from '@/server/queries/courses';
import { cn } from '@/lib/utils';

export function CourseCard({ item, locale, className }: { item: CourseCardItem; locale: Locale; className?: string }) {
  const t = useTranslations();

  const cover = item.cover ? resolveMedia(item.cover, locale) : null;
  const avatar = item.instructor.avatar ? resolveMedia(item.instructor.avatar, locale) : null;
  const hours = Math.max(1, Math.round(item.totalMinutes / 60));

  return (
    <article
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-xl border border-border-default bg-surface-card',
        'transition-shadow duration-normal ease-brand hover:shadow-md focus-within:shadow-md',
        className,
      )}
    >
      <div className="relative">
        <Media
          {...(cover ?? { src: null, alt: '' })}
          preset="classCard"
          fallback="classCard"
          imageClassName="card-media media-zoom"
        />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="accent" className="self-start">{t(danceStyleLabelKey(item.style))}</Badge>
          <Badge variant="neutral" className="self-start">{t(skillLevelLabelKey(item.level))}</Badge>
        </div>

        <h3 className="text-card-title mt-3">
          <Link
            href={routes.course(item.slug)}
            data-cursor-label={t('common.actions.explore')}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {item.title}
          </Link>
        </h3>

        <p className="text-body-sm mt-1.5 line-clamp-2 text-content-secondary">{item.description}</p>

        <p className="text-body-sm mt-3 text-content-tertiary">
          {t('courses.lessonsCount', { count: item.lessonsCount })}
          {' · '}
          {t('courses.totalDuration', { duration: t('common.units.hours', { count: hours }) })}
        </p>

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <span className="flex min-w-0 items-center gap-2">
            {avatar ? (
              <Media {...avatar} preset="avatar" fallback="avatar" className="size-8 shrink-0 rounded-full" />
            ) : null}
            <span className="truncate text-body-sm text-content-secondary">{item.instructor.name}</span>
          </span>
          <Price amount={item.price} emphasis="total" className="shrink-0" />
        </div>
      </div>
    </article>
  );
}
