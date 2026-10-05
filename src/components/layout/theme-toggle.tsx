/**
 * THEME TOGGLE — больше не рендерит кнопки.
 *
 * Переключатели темы и лёгкого режима теперь живут в `SiteHeader`
 * (`header-theme-toggle.tsx` / `header-lite-toggle.tsx`) — рядом с языком
 * и CTA, а не отдельной плавающей колонкой. Этот модуль оставлен как
 * no-op для обратной совместимости импорта из `SiteChrome`.
 */

export function ThemeToggle(): null {
  return null;
}
