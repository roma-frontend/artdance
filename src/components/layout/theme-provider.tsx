/**
 * THEME PROVIDER — выбор светлой и тёмной темы.
 *
 * Тонкая обёртка над `next-themes`. Своя реализация здесь была бы хуже ровно в
 * одном месте, и это место — первый кадр.
 *
 * Тема пользователя известна только браузеру (localStorage) или системе
 * (`prefers-color-scheme`). Сервер о ней не знает, поэтому у любой SSR-страницы
 * есть три варианта:
 *   • читать cookie — тогда страница перестаёт быть статической, и весь каталог
 *     теряет отдачу с CDN;
 *   • применить тему после гидратации — тогда пользователь с тёмной темой видит
 *     вспышку светлого экрана на каждой навигации (именно так в прототипе:
 *     `localStorage` читается в конце страницы);
 *   • выставить атрибут блокирующим inline-скриптом до первой отрисовки.
 *
 * Третий вариант — единственный без компромиссов, и `next-themes` существует
 * ровно для него: он вставляет этот скрипт сам и отслеживает смену системной
 * настройки на ходу. CSP проекта допускает inline-скрипты осознанно
 * (см. `src/config/security.ts`), так что дополнительных послаблений не нужно.
 *
 * Страница без JavaScript темы не лишается: `tokens.css` содержит
 * `@media (prefers-color-scheme: dark) { :root:not([data-theme]) { … } }`, и до
 * первого выбора тема просто следует за системой.
 */

'use client';

import { ThemeProvider as NextThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';

import { colorSchemes } from '@/design/tokens';

/** Ключ в localStorage. Совпадает с именем cookie-локали по стилю, а не по случайности. */
const STORAGE_KEY = 'ARTDANCE_THEME';

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      /* Пишем в `data-theme`, потому что на него настроены все токены. */
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      themes={[...colorSchemes]}
      storageKey={STORAGE_KEY}
      /*
       * Отключаем переходы на момент переключения: иначе одновременно
       * анимируются цвета фона, текста, границ и теней у каждого элемента на
       * странице — это заметная просадка кадров на длинной странице.
       */
      disableTransitionOnChange
    >
      {children}
    </NextThemeProvider>
  );
}
