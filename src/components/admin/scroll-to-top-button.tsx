'use client';

/**
 * SCROLL TO TOP BUTTON — кнопка быстрого возврата к началу экрана в админке.
 *
 * Показывается плавно при прокрутке более 400px.
 */

import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 400);
    }

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className={cn(
        'fixed bottom-6 right-6 z-sticky size-10 rounded-full p-0 shadow-lg backdrop-blur-md transition-all duration-normal ease-brand',
        'border-border-strong bg-surface-card/95 hover:border-accent hover:text-content-accent',
        visible ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-4 opacity-0 pointer-events-none',
      )}
    >
      <ArrowUp className="size-4" />
    </Button>
  );
}
