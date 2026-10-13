'use client';

/**
 * Ленивый хост CommandPalette.
 *
 * Палитра нужна далеко не каждому просмотру, а `cmdk` в её составе — это
 * заметный чанк в гидратации каждой публичной страницы. Хост слушает горячие
 * клавиши лёгким слушателем и монтирует саму палитру (и грузит её чанк)
 * только по первому нажатию `>`/`?` или на админ-маршруте, где она часть
 * рабочего места оператора, а не украшение.
 *
 * После монтирования палитра сама владеет клавиатурой: слушатель хоста
 * снимается, чтобы одно нажатие не обрабатывалось дважды.
 */

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import { usePathname } from '@/i18n/routing';
import { isAdminPath } from '@/config/routes';

const LazyCommandPalette = dynamic(() => import('./command-palette').then((m) => m.CommandPalette), {
  ssr: false,
});

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

export function CommandPaletteLazy() {
  const pathname = usePathname();
  const isAdmin = isAdminPath(pathname);
  const [mounted, setMounted] = useState(false);
  const [initialOpen, setInitialOpen] = useState(false);

  useEffect(() => {
    if (mounted) return;
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const isPaletteKey = event.key === '>' || (event.key === '?' && isAdmin);
      if (!isPaletteKey) return;
      event.preventDefault();
      setInitialOpen(true);
      setMounted(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mounted, isAdmin]);

  /* Админ-раздел: палитра часть рабочего процесса — монтируем по пути, без клика. */
  if (!mounted && !isAdmin) return null;
  return <LazyCommandPalette initialOpen={initialOpen} />;
}
