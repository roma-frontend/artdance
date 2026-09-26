'use client';

/**
 * LOCALE SWITCHER — кнопка языка рядом с иконками избранного/магазина.
 *
 * Pill с кодом текущей локали (ENG/РУС/ՀԱՅ), при клике — список трёх языков.
 * Сохраняет путь и query, пишет куку ARTDANCE_LOCALE.
 *
 * ВАЖНО: смена языка — через hard navigation (window.location), а не через
 * next-intl router.replace. Причина — next-themes 0.4.6 рендерит <script> для
 * блокирующего применения темы до первой отрисовки. При клиентском переходе
 * между локалями ([locale]/layout перемонтируется) React 19 видит <script>
 * внутри клиентского компонента и ругается:
 *   "Encountered a script tag while rendering React component..."
 * Hard reload рендерит страницу заново с сервера — скрипт отрабатывает один раз,
 * ошибки нет, а middleware всё равно выставит куку по префиксу URL.
 *
 * Два режима:
 *  • header — pill + popover (управляется React state, без imperative DOM)
 *  • sheet  — три плитки в MobileMenuSheet
 */

import { CheckIcon, GlobeIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { localeMeta, locales, type Locale } from '@/i18n/config';
import { usePathname } from '@/i18n/routing';
import { cn } from '@/lib/utils';

type Variant = 'header' | 'sheet';

function useLocaleHrefBuilder() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (next: Locale) => {
    const search = searchParams.toString();
    const base = `/${next}${pathname === '/' ? '' : pathname}`;
    return search ? `${base}?${search}` : base;
  };
}

export function LocaleSwitcher({
  variant = 'header',
  solid,
}: {
  variant?: Variant;
  solid?: boolean;
}) {
  return (
    <Suspense fallback={<LocaleSwitcherFallback variant={variant} solid={solid} />}>
      <LocaleSwitcherInner variant={variant} solid={solid} />
    </Suspense>
  );
}

function LocaleSwitcherFallback({ variant }: { variant?: Variant; solid?: boolean }) {
  // Скелет для Suspense — пока не смонтирован searchParams
  if (variant === 'sheet') {
    return <div className="rounded-xl border border-border-default bg-surface-card p-3 h-24" aria-hidden />;
  }
  return <span className="inline-flex h-9 w-20 rounded-full border border-transparent" aria-hidden />;
}

function LocaleSwitcherInner({
  variant = 'header',
  solid,
}: {
  variant?: Variant;
  solid?: boolean;
}) {
  const t = useTranslations('nav');
  const locale = useLocale() as Locale;
  const buildHref = useLocaleHrefBuilder();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const switchTo = (next: Locale) => {
    if (next === locale) return;
    const href = buildHref(next);
    window.location.assign(href);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (variant === 'sheet') {
    return (
      <div className="rounded-xl border border-border-default bg-surface-card p-3">
        <p className="text-eyebrow mb-2 text-content-secondary">{t('language')}</p>
        <div className="grid grid-cols-3 gap-2">
          {locales.map((code) => {
            const meta = localeMeta[code];
            const active = code === locale;
            return (
              <a
                key={code}
                href={buildHref(code)}
                aria-current={active ? 'true' : undefined}
                aria-label={`${meta.nativeName} (${meta.shortLabel})`}
                onClick={(e) => {
                  e.preventDefault();
                  switchTo(code);
                }}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-3 text-center transition-colors duration-normal ease-brand',
                  active
                    ? 'border-accent bg-accent-soft text-content-accent'
                    : 'border-border-default bg-surface-raised text-content-primary hover:border-accent hover:text-content-accent',
                )}
              >
                <span className="text-label font-bold tracking-wide">{meta.shortLabel}</span>
                <span className="text-caption leading-none">{meta.nativeName}</span>
                {active && <CheckIcon className="mt-0.5 size-3.5" aria-hidden />}
              </a>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={t('language')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold tracking-wide',
          'transition-colors duration-normal ease-brand',
          solid
            ? 'border-border-default bg-surface-card text-content-secondary hover:border-accent hover:bg-accent-soft hover:text-content-accent'
            : 'border-border-on-cinema text-content-on-cinema-muted hover:border-border-on-cinema hover:text-content-on-cinema',
        )}
      >
        <GlobeIcon className="size-3.5" aria-hidden />
        <span aria-hidden>{localeMeta[locale].shortLabel}</span>
        <span className="sr-only">
          {t('language')}: {localeMeta[locale].nativeName}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-40 min-w-44 rounded-xl border border-border-default bg-surface-card p-1 shadow-lg"
        >
          {locales.map((code) => {
            const meta = localeMeta[code];
            const active = code === locale;
            return (
              <a
                key={code}
                href={buildHref(code)}
                role="menuitemradio"
                aria-checked={active}
                onClick={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  switchTo(code);
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  active
                    ? 'bg-accent-soft text-content-accent'
                    : 'text-content-primary hover:bg-surface-raised',
                )}
              >
                <span className="flex flex-col">
                  <span className="font-semibold">{meta.nativeName}</span>
                  <span className="text-caption text-content-tertiary">
                    {meta.shortLabel} · {meta.bcp47}
                  </span>
                </span>
                {active && <CheckIcon className="size-4 shrink-0 text-content-accent" aria-hidden />}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
