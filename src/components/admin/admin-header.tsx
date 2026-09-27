'use client';

/**
 * ADMIN HEADER — клиентская липкая шапка админки.
 *
 * Переключает состояние тени при скролле страницы.
 */

import { type ReactNode, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

export function AdminHeader({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-header border-b bg-surface-card/95 backdrop-blur-md transition-[border-color,box-shadow] duration-normal ease-brand',
        scrolled
          ? 'border-border-strong shadow-md shadow-black/20'
          : 'border-border-default shadow-none',
      )}
    >
      {children}
    </header>
  );
}
