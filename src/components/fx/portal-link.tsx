/**
 * PORTAL LINK — ссылка карточки, которая открывает страницу пролётом камеры.
 *
 * Карточка помечает себя `data-portal-card`, а блок с обложкой —
 * `data-portal-media`: окно пролёта вырастает из координат обложки и несёт её
 * уже загруженный кадр (`currentSrc`). Нет разметки — летит вся карточка.
 *
 * Cmd/Ctrl/Shift/средняя кнопка — обычное поведение ссылки (новая вкладка).
 * Вне `PortalTransitionProvider` — обычная ссылка.
 */

'use client';

import type { ComponentProps, MouseEvent } from 'react';

import { usePortalTransition } from '@/components/fx/portal-transition';
import { Link } from '@/i18n/routing';

type PortalLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
  href: string;
  /**
   * `card` — в пролёт уходит вся карточка целиком (рамка, подписи, стрелка), а
   * не только её кадр. Для плиток, где надпись — часть образа (лента стилей).
   */
  flight?: 'media' | 'card';
};

export function PortalLink({ href, onClick, flight = 'media', ...props }: PortalLinkProps) {
  const portal = usePortalTransition();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !portal) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

    const link = event.currentTarget;
    const card = link.closest<HTMLElement>('[data-portal-card]') ?? link;
    const media = card.querySelector<HTMLElement>('[data-portal-media]') ?? card;
    const img = media.querySelector('img');

    event.preventDefault();
    if (flight === 'card') {
      portal.triggerPortal(card.getBoundingClientRect(), img?.currentSrc || img?.src || '', href, card);
      return;
    }
    portal.triggerPortal(media.getBoundingClientRect(), img?.currentSrc || img?.src || '', href);
  };

  return <Link href={href} onClick={handleClick} {...props} />;
}
