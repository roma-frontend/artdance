/**
 * CARD QUICK ACTIONS — сердечко и тулбар «Explore / Book» на карточке каталога.
 *
 * В прототипе такого тулбара нет: там у карточки только `♡`. Подписи и адреса взяты
 * из того, что уже есть в карточке: «Explore» ведёт туда же, куда название, «Book» —
 * туда же, куда подвал. Тулбар не даёт новых переходов, он выносит их к сердечку.
 *
 * **Появляется по наведению на сердечко и по фокусу с клавиатуры.** Наведение
 * ловит и сам тулбар, поэтому курсор можно вести от сердечка к ссылкам без потери.
 * Клавиатурный фокус проверяется через `:focus-visible`, а не `:focus-within`:
 * после клика мышью тулбар не остаётся висеть, пока курсор ушёл.
 *
 * **На touch-устройствах виден всегда.** Наведения там нет, а проект не прячет
 * hover-только элементы от телефона (тот же приём у `ProductQuickAdd`). Ссылки
 * дублируют название и подвал, поэтому скрыть их на телефоне ничего не потеряло бы,
 * но постоянный тулбар на касании честнее, чем угадывать, что пользователь ищет.
 *
 * **Скрыт через `visibility`, а не прозрачность.** Невидимые ссылки иначе зачитал бы
 * скринридер на каждой карточке. Тулбар стоит в DOM после сердечка, поэтому
 * табуляция идёт сердечко → Explore → Book, хотя визуально тулбар левее сердечка.
 */

import { useTranslations } from 'next-intl';

import { PortalLink } from '@/components/fx/portal-link';
import { FavoriteButton } from '@/components/ui/favorite-button';
import { Link } from '@/i18n/routing';
import type { FavoriteTarget } from '@/lib/client/favorites';
import { cn } from '@/lib/utils';

interface CardQuickActionsProps {
  target: FavoriteTarget;
  slug: string;
  /** Название сущности: попадает в подписи ссылок и в доступное имя сердечка. */
  name: string;
  /** Куда ведёт «Explore» — то же, что название карточки. */
  exploreHref: string;
  /** Куда ведёт «Book» — то же, что подвал карточки. */
  bookHref: string;
  /** Подпись «Book» совпадает с подвалом: при нехватке мест там «В лист ожидания». */
  bookLabel: string;
}

const quickLinkBase = cn(
  'inline-flex h-8 items-center whitespace-nowrap rounded-full px-3',
  'text-label font-semibold transition-colors duration-normal ease-brand',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
);
// «Book» — главное действие тулбара, поэтому залит акцентом; акцентный текст на тёмной карточке нечитаем.
const exploreLinkClass = cn(quickLinkBase, 'text-content-primary hover:bg-surface-sunken');
const bookLinkClass = cn(quickLinkBase, 'bg-accent text-content-on-accent hover:bg-accent-hover');

export function CardQuickActions({ target, slug, name, exploreHref, bookHref, bookLabel }: CardQuickActionsProps) {
  const t = useTranslations('common.actions');
  const exploreLabel = t('explore');

  return (
    // `z-20` обязателен: растянутый якорь названия накрывает карточку целиком.
    <div className="group/fav absolute top-2.5 right-2.5 z-20">
      <FavoriteButton target={target} slug={slug} name={name} onMedia />

      <div
        className={cn(
          'invisible absolute top-1/2 right-full -translate-y-1/2 pr-2 opacity-0',
          'transition-[opacity,visibility] duration-normal ease-brand',
          'group-hover/fav:visible group-hover/fav:opacity-100',
          'group-has-[:focus-visible]/fav:visible group-has-[:focus-visible]/fav:opacity-100',
          '[@media(hover:none)]:visible [@media(hover:none)]:opacity-100',
        )}
      >
        {/* `pr-2` — мост между тулбаром и сердечком: курсор не теряет наведение в зазоре. */}
        <div className="flex items-center gap-1 rounded-full bg-surface-card p-1 shadow-md">
          <PortalLink
            href={exploreHref}
            aria-label={`${exploreLabel}: ${name}`}
            data-cursor-label={exploreLabel}
            className={exploreLinkClass}
          >
            {exploreLabel}
          </PortalLink>
          <Link
            href={bookHref}
            aria-label={`${bookLabel}: ${name}`}
            data-cursor-label={bookLabel}
            className={bookLinkClass}
          >
            {bookLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
