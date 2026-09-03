/**
 * THEME TOGGLE — плавающая кнопка переключения темы.
 *
 * Три состояния по кругу: светлая → тёмная → системная. Третье — не излишество:
 * без него пользователь, который один раз нажал кнопку, навсегда отвязан от
 * системной настройки и не может вернуться к «как в системе». В прототипе
 * состояний два, и вернуться нельзя.
 *
 * Что здесь важнее вида:
 *
 * • **Кнопка называет следующее действие, а не текущее состояние.** «Switch to
 *   dark» понятно без догадок; иконка одна и та же для зрячего и для
 *   скринридера, потому что подпись приходит из i18n, а не из эмодзи.
 * • **До гидратации рисуется системная иконка.** Настоящее значение живёт в
 *   `localStorage`, сервер его не знает, и любая другая иконка в первом кадре
 *   означала бы рассинхрон разметки.
 * • **Hero и editorial остаются тёмными в обеих темах** — это `surface-cinema`,
 *   отдельная роль, а не тема. Кнопка на них не влияет и не должна.
 */

'use client';

import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';

import { useIsHydrated } from '@/lib/hooks/use-is-hydrated';
import { cn } from '@/lib/utils';

/** Порядок обхода. Системная — последняя, чтобы к ней всегда можно было вернуться. */
const CYCLE = ['light', 'dark', 'system'] as const;
type ThemeChoice = (typeof CYCLE)[number];

const ICONS = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
} as const;

/**
 * Отдельный ключ на каждый вариант, а не «Переключить на {тема}».
 *
 * Подстановка названия темы в шаблон требует падежа: по-русски «включить
 * тёмнУЮ», по-английски «switch to dark». Собирать фразу из частей — надёжный
 * способ получить «Переключить на Тёмная» в одном из трёх языков.
 */
const LABEL_KEYS = {
  light: 'switchToLight',
  dark: 'switchToDark',
  system: 'switchToSystem',
} as const;

function isThemeChoice(value: string | undefined): value is ThemeChoice {
  return value !== undefined && (CYCLE as readonly string[]).includes(value);
}

export function ThemeToggle() {
  const t = useTranslations('common.theme');
  const { theme, setTheme } = useTheme();
  const hydrated = useIsHydrated();

  /* До гидратации выбор неизвестен — показываем нейтральное «как в системе». */
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
      data-slot="theme-toggle"
      data-theme-choice={current}
      className={cn(
        'fixed right-6 bottom-6 z-sticky grid size-13 place-items-center rounded-full',
        'border-3 border-surface-card bg-accent text-content-on-accent shadow-lg',
        'transition-transform duration-slow ease-brand',
        'hover:scale-110 hover:rotate-30',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
      )}
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );
}
