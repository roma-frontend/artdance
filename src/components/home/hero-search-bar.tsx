/**
 * HERO SEARCH BAR — круглая иконка поиска в правом верхнем углу первого экрана
 * с широким 3D-раскрытием через Portal на весь экран.
 */

'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { SearchIcon, XIcon, ArrowRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/ui/button';
import { routes, site } from '@/config';
import { useRouter } from '@/i18n/routing';
import { useIsHydrated } from '@/lib/hooks/use-is-hydrated';
import { cn } from '@/lib/utils';

export function HeroSearchBar({
  initialQuery = '',
  className,
}: {
  initialQuery?: string;
  className?: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const mounted = useIsHydrated();
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    setIsOpen(false);
    router.push(trimmed.length > 0 ? routes.discover({ q: trimmed }) : routes.discover());
  };

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 150);
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsOpen(false);
      };
      window.addEventListener('keydown', onKeyDown);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('keydown', onKeyDown);
      };
    }
  }, [isOpen]);

  return (
    <div className={cn('relative', className)}>
      {/* ── Круглая кнопка поиска в самом правом верхнем углу ── */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        data-cursor-label={t('common.actions.search')}
        aria-label={t('search.heroPlaceholder')}
        className={cn(
          'group/hero-search flex size-13 items-center justify-center rounded-full',
          'border border-accent/50 bg-surface-cinema/85 text-content-on-cinema backdrop-blur-2xl',
          'shadow-[0_8px_32px_rgba(0,0,0,0.7),0_0_24px_var(--accent-glow)]',
          'transition-all duration-300 hover:scale-110 hover:border-accent hover:bg-surface-cinema active:scale-95',
        )}
      >
        <SearchIcon className="size-5.5 text-accent-on-cinema transition-transform duration-300 group-hover/hero-search:rotate-12 group-hover/hero-search:scale-110" />
      </button>

      {/* ── 3D Раскрытие на весь экран через React Portal (без сжатия родителем) ── */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <div
                role="dialog"
                aria-modal="true"
                className="fixed inset-0 z-popover flex items-start justify-center px-4 pt-24 sm:pt-32 bg-surface-cinema/80 backdrop-blur-2xl"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setIsOpen(false);
                }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, rotateX: 25, y: -40 }}
                  animate={{ opacity: 1, scale: 1, rotateX: 0, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, rotateX: -15, y: -25 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  style={{ transformPerspective: 1200 }}
                  className="w-full max-w-4xl sm:max-w-5xl"
                >
                  <form
                    action={routes.discover()}
                    onSubmit={handleSubmit}
                    className={cn(
                      'relative rounded-2xl p-4 sm:p-5',
                      'border border-accent/60 bg-surface-cinema/95 text-content-on-cinema',
                      'shadow-[0_30px_90px_rgba(0,0,0,0.9),0_0_50px_var(--accent-glow)] backdrop-blur-3xl',
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex min-w-0 flex-1 items-center gap-3 px-3">
                        <SearchIcon className="size-5 shrink-0 text-accent" aria-hidden />
                        <span className="sr-only">{t('search.heroPlaceholder')}</span>
                        <input
                          ref={inputRef}
                          type="search"
                          name="q"
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder={t('search.heroPlaceholder')}
                          className="text-body w-full min-w-0 bg-transparent py-2.5 text-content-on-cinema outline-none placeholder:text-content-on-cinema-muted"
                        />
                      </label>

                      <span aria-hidden className="hidden h-8 w-px shrink-0 bg-border-on-cinema sm:block" />

                      {/* Быстрые фильтры */}
                      <ul className="text-caption scrollbar-none flex flex-wrap items-center gap-2 text-content-on-cinema-muted max-sm:order-last max-sm:w-full max-sm:flex-nowrap max-sm:overflow-x-auto">
                        <li className="rounded-full bg-accent-soft px-3 py-1.5 font-semibold whitespace-nowrap text-content-accent">
                          {site.address.city}
                        </li>
                        <li className="rounded-full bg-surface-card/40 px-3 py-1.5 whitespace-nowrap">
                          {t('search.anyDate')}
                        </li>
                        <li className="rounded-full bg-surface-card/40 px-3 py-1.5 whitespace-nowrap">
                          {t('search.anyStyle')}
                        </li>
                      </ul>

                      <div className="flex items-center gap-2 ms-auto">
                        <Button type="submit" size="md" variant="accent" className="gap-1.5">
                          <span>{t('common.actions.explore')}</span>
                          <ArrowRightIcon className="size-4" aria-hidden />
                        </Button>

                        <button
                          type="button"
                          onClick={() => setIsOpen(false)}
                          aria-label={t('common.actions.close')}
                          className="flex size-9 items-center justify-center rounded-full text-content-on-cinema-muted hover:bg-surface-card/50 hover:text-content-on-cinema transition-colors"
                        >
                          <XIcon className="size-4" aria-hidden />
                        </button>
                      </div>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
