'use client';

import { LeafIcon, SparklesIcon, ZapIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { useLiteMode } from '@/lib/perf/lite-mode';
import { cn } from '@/lib/utils';

type LiteValue = 'auto' | 'on' | 'off';

const ICONS: Record<LiteValue, React.ComponentType<{ className?: string }>> = {
  auto: SparklesIcon,
  on: LeafIcon,
  off: ZapIcon,
};

export function HeaderLiteToggle({ solid }: { solid: boolean }) {
  const t = useTranslations('common.perf');
  const { mode, enabled, setMode } = useLiteMode();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const currentIcon = ICONS[mode as LiteValue] ?? SparklesIcon;

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

  const options: { value: LiteValue; label: string; hint: string }[] = [
    { value: 'auto', label: t('liteAuto'), hint: t('liteAutoHint') },
    { value: 'off', label: t('liteOff'), hint: t('liteOffHint') },
    { value: 'on', label: t('liteOn'), hint: t('liteOnHint') },
  ];

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={t('liteModeLabel')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={t('liteModeLabel')}
        data-slot="header-lite-toggle"
        data-lite-active={enabled ? '' : undefined}
        className={cn(
          'relative inline-flex size-9 items-center justify-center rounded-full border',
          'transition-colors duration-normal ease-brand',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
          solid
            ? enabled
              ? 'border-accent bg-accent text-accent-contrast shadow-sm'
              : 'border-border-default bg-surface-card text-content-secondary hover:border-accent hover:bg-accent-soft hover:text-content-accent'
            : enabled
              ? 'border-white/20 bg-accent text-accent-contrast shadow-sm'
              : 'border-white/10 bg-white/5 text-content-on-cinema-muted backdrop-blur-md hover:border-border-on-cinema hover:bg-white/10 hover:text-content-on-cinema',
        )}
      >
        {(() => {
          const Icon = currentIcon;
          return <Icon className="size-4" aria-hidden />;
        })()}
        {enabled && (
          <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-metal ring-2 ring-surface-card" aria-hidden />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-40 w-72 rounded-xl border border-border-default bg-surface-card p-1 shadow-lg"
        >
          {options.map((opt) => {
            const active = mode === opt.value;
            const Icon = ICONS[opt.value];
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setMode(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  active ? 'bg-accent-soft text-content-accent' : 'text-content-primary hover:bg-surface-raised',
                )}
              >
                <span
                  className={cn(
                    'grid size-7 shrink-0 place-items-center rounded-full border',
                    active ? 'border-accent bg-accent text-accent-contrast' : 'border-border-default bg-surface-raised',
                  )}
                >
                  <Icon className="size-3.5 shrink-0" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-semibold leading-none">{opt.label}</span>
                  <span className="text-caption leading-tight text-content-tertiary [overflow-wrap:anywhere]">{opt.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
