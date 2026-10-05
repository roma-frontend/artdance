'use client';

import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';

import { useIsHydrated } from '@/lib/hooks/use-is-hydrated';
import { cn } from '@/lib/utils';

const CYCLE = ['light', 'dark', 'system'] as const;
type ThemeChoice = (typeof CYCLE)[number];

const ICONS = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
} as const;

const LABEL_KEYS = {
  light: 'switchToLight',
  dark: 'switchToDark',
  system: 'switchToSystem',
} as const;

function isThemeChoice(value: string | undefined): value is ThemeChoice {
  return value !== undefined && (CYCLE as readonly string[]).includes(value);
}

export function HeaderThemeToggle({ solid }: { solid: boolean }) {
  const t = useTranslations('common.theme');
  const { theme, setTheme } = useTheme();
  const hydrated = useIsHydrated();

  const current: ThemeChoice = hydrated && isThemeChoice(theme) ? theme : 'system';
  const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length]!;
  const Icon = ICONS[current];
  const label = t(LABEL_KEYS[next]);

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      data-slot="header-theme-toggle"
      data-theme-choice={current}
      className={cn(
        'relative inline-flex size-9 items-center justify-center rounded-full border',
        'transition-colors duration-normal ease-brand',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
        solid
          ? 'border-border-default bg-surface-card text-content-secondary hover:border-accent hover:bg-accent-soft hover:text-content-accent'
          : 'border-white/10 bg-white/5 text-content-on-cinema-muted backdrop-blur-md hover:border-border-on-cinema hover:bg-white/10 hover:text-content-on-cinema',
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
