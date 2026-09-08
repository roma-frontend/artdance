/**
 * STYLE LINK LIST — перечень направлений ссылками, без фотографий.
 *
 * Второй способ показать направления, и он нужен именно потому, что первый
 * (`StyleTileGrid`) держится на кадре: плитка без фотографии — пустой
 * прямоугольник, а фотография есть у пяти направлений из восемнадцати.
 * Придумывать остальным «похожий» снимок нельзя (кадр другого танца утверждает
 * неправду), поэтому там, где перечислены ВСЕ направления, работает текст.
 *
 * Используется в двух местах с одним смыслом «вот направления, откройте любое»:
 * полный перечень на `/styles` и блок соседних направлений на хабе.
 *
 * Подпись под названием отвечает на вопрос «есть ли здесь что-то для меня»
 * данными, а не обещанием: сколько занятий, если они есть; сколько
 * преподавателей, если занятий пока нет; и честное «ищем преподавателей», если
 * нет ни того, ни другого. Ноль в счётчике («0 занятий») сообщает то же самое,
 * но выглядит как поломка.
 */

import { ArrowUpRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Reveal } from '@/components/fx/reveal';
import { routes } from '@/config';
import type { StyleSummary } from '@/domain/content';
import { danceStyleLabelKey } from '@/domain/enums';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

interface StyleLinkListProps {
  items: readonly StyleSummary[];
  /** Три колонки в перечне направлений, две — в блоке соседних. */
  columns?: 2 | 3;
  className?: string;
}

export function StyleLinkList({ items, columns = 3, className }: StyleLinkListProps) {
  const t = useTranslations();
  const tCommon = useTranslations('common');
  const tHub = useTranslations('styleHub');

  const supply = (item: StyleSummary): string => {
    if (item.classCount > 0) return tCommon('counts.classes', { count: item.classCount });
    if (item.instructorCount > 0) {
      return tCommon('counts.instructors', { count: item.instructorCount });
    }
    return tHub('seeking');
  };

  return (
    <Reveal
      as="ul"
      variant="stagger"
      className={cn(
        'grid gap-3 xs:grid-cols-2',
        columns === 3 && 'lg:grid-cols-3',
        className,
      )}
    >
      {items.map((item) => (
        <li key={item.slug}>
          {/*
            Ссылка занимает всю карточку, а стрелка декоративна: доступное имя
            несёт название направления. Подъём при наведении — как у карточек
            каталога, чтобы перечень не выглядел чужеродным блоком.
          */}
          <Link
            href={routes.style(item.slug)}
            className="card-surface group flex items-center justify-between gap-4 rounded-lg border border-border-default bg-surface-card px-5 py-4 hover:border-accent hover:shadow-md"
          >
            <span className="min-w-0">
              <span className="text-card-title block truncate text-content-primary">
                {t(danceStyleLabelKey(item.style as never))}
              </span>
              <span className="text-caption mt-1 block text-content-tertiary">{supply(item)}</span>
            </span>

            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-content-tertiary transition-colors group-hover:bg-accent-soft group-hover:text-content-accent"
            >
              <ArrowUpRight className="size-4" />
            </span>
          </Link>
        </li>
      ))}
    </Reveal>
  );
}
