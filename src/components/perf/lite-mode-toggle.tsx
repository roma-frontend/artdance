'use client';

import { LeafIcon, ZapIcon, MonitorSmartphoneIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useLiteMode } from '@/lib/perf/lite-mode';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { value: 'auto' as const, icon: MonitorSmartphoneIcon },
  { value: 'off' as const, icon: ZapIcon },
  { value: 'on' as const, icon: LeafIcon },
] as const;

export function LiteModeToggle({ className }: { className?: string }): React.ReactNode {
  const t = useTranslations('common.perf');
  const { mode, setMode } = useLiteMode();

  return (
    <div
      role="group"
      aria-label={t('liteModeLabel')}
      className={cn(
        'inline-flex items-center rounded-full border border-border-default bg-surface-card p-1 shadow-sm',
        className,
      )}
    >
      {OPTIONS.map(({ value, icon: Icon }) => {
        const active = mode === value;
        const label =
          value === 'auto' ? t('liteAuto') : value === 'on' ? t('liteOn') : t('liteOff');
        const title =
          value === 'auto'
            ? t('liteAutoHint')
            : value === 'on'
              ? t('liteOnHint')
              : t('liteOffHint');
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            aria-label={label}
            title={title}
            onClick={() => setMode(value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption font-semibold transition-colors',
              active
                ? 'bg-accent text-accent-contrast shadow-sm'
                : 'text-content-secondary hover:bg-surface-sunken hover:text-content-primary',
            )}
          >
            <Icon className="size-4" aria-hidden />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
