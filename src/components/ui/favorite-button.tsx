'use client';

/**
 * FAVORITE BUTTON — сердечко «сохранить».
 *
 * Три решения, отличающие эту кнопку от сердечка в прототипе.
 *
 * **Видно на касании.** В макете `♡` появляется только при наведении курсора —
 * на телефоне такая кнопка недостижима в принципе. Здесь она видна всегда;
 * наведение меняет только заметность, а не факт существования.
 *
 * **Работает до входа.** Отметка гостя живёт в браузере и переносится в аккаунт
 * при входе (`readGuestFavorites`). Требовать вход в момент первого желания
 * что-то сохранить — самый дорогой способ потерять посетителя.
 *
 * **Имеет доступное имя с названием сущности.** Не «в избранное», а «сохранить
 * „Latin Fusion“ в избранное»: на странице десяток одинаковых кнопок, и список
 * из десяти «в избранное» в скринридере бесполезен. По той же причине состояние
 * передаётся `aria-pressed`, а не только цветом заливки.
 */

import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useFavorite, type FavoriteTarget } from '@/lib/client/favorites';
import { cn } from '@/lib/utils';

interface FavoriteButtonProps {
  target: FavoriteTarget;
  slug: string;
  /** Название сущности — попадает в доступное имя кнопки. */
  name: string;
  /**
   * Кнопка поверх фотографии: получает плашку, потому что на снимке контур
   * сердца не читается.
   */
  onMedia?: boolean;
  className?: string;
}

export function FavoriteButton({ target, slug, name, onMedia, className }: FavoriteButtonProps) {
  const t = useTranslations('favorites');
  const { isFavorite, toggle } = useFavorite(target, slug);

  return (
    <button
      type="button"
      aria-pressed={isFavorite}
      aria-label={isFavorite ? t('toggleLabelActive', { name }) : t('toggleLabel', { name })}
      onClick={(event) => {
        /*
         * Карточка целиком — ссылка (растянутый якорь). Без остановки события
         * нажатие на сердце открывало бы страницу занятия.
         */
        event.preventDefault();
        event.stopPropagation();
        toggle();
      }}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-full',
        'transition-all duration-300 ease-brand',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
        onMedia
          ? 'bg-surface-card/85 shadow-sm backdrop-blur-sm hover:bg-surface-card'
          : 'hover:bg-surface-sunken',
        isFavorite ? 'text-content-accent' : 'text-content-tertiary hover:text-content-accent',
        className,
      )}
    >
      <Heart
        aria-hidden
        className={cn('size-4.5 transition-transform duration-300 ease-brand', isFavorite && 'scale-110')}
        /* Заливка — второй признак состояния помимо цвета: дальтонизм. */
        fill={isFavorite ? 'currentColor' : 'none'}
      />
    </button>
  );
}
