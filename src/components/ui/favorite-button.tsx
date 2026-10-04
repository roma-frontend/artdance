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
import { useRef } from 'react';
import { toast } from 'sonner';

import { useFavorite, type FavoriteTarget } from '@/lib/client/favorites';
import { cn } from '@/lib/utils';
import { toggleFavoriteAction } from '@/server/actions/favorites';

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
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Серверный toggle — best-effort: гость получает UNAUTHORIZED (игнор),
  // снятый с публикации — откатываем локальную отметку.
  const toggleOnServer = async () => {
    if (target === 'event') return;
    try {
      const res = await toggleFavoriteAction({ target: target as 'class' | 'instructor' | 'venue' | 'product', slug });
      if (res?.serverError && res.serverError.code !== 'UNAUTHORIZED') {
        toggle(); // откат локально — сервер не сохранил
      }
    } catch {
      // сеть — оставляем optimistic
    }
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-pressed={isFavorite}
      aria-label={isFavorite ? t('toggleLabelActive', { name }) : t('toggleLabel', { name })}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const next = toggle();
        void toggleOnServer();
        // haptics
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate(next ? [18] : [10]); } catch {}
        }
        // Restart only the decorative response, never replay it on hydration.
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          const button = buttonRef.current;
          button?.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
          button?.querySelector('svg')?.animate(
            [{ transform: 'scale(1)' }, { transform: `scale(${next ? 1.25 : 0.9})`, offset: 0.4 }, { transform: 'scale(1)' }],
            { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
          );
          if (next) button?.querySelector('[data-favorite-ring]')?.animate(
            [{ transform: 'scale(0.65)', opacity: 0.55 }, { transform: 'scale(1.3)', opacity: 0 }],
            { duration: 420, easing: 'ease-out' },
          );
        }
        if (next) toast.success(t('added'), { description: name });
        else toast(t('removed'), { description: name });
      }}
      className={cn(
        'favorite-motion relative inline-flex size-9 items-center justify-center rounded-full',
        'transition-[background-color,color,scale] duration-normal ease-brand',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
        onMedia
          ? 'bg-surface-card/85 shadow-sm backdrop-blur-sm hover:bg-surface-card'
          : 'hover:bg-surface-sunken',
        isFavorite ? 'text-content-accent' : 'text-content-tertiary hover:text-content-accent',
        className,
      )}
    >
      <span aria-hidden data-favorite-ring className="pointer-events-none absolute inset-0 rounded-full border border-current opacity-0" />
      <Heart
        aria-hidden
        className="size-4.5"
        fill={isFavorite ? 'currentColor' : 'none'}
      />
    </button>
  );
}
