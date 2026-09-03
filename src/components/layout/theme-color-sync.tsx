/**
 * THEME COLOR SYNC — цвет интерфейса браузера следует за выбранной темой.
 *
 * `<meta name="theme-color">` с медиа-запросом (см. `viewport` в layout) умеет
 * следить только за СИСТЕМНОЙ настройкой. У нас же тема может быть выбрана
 * вручную и переживает перезагрузку — и в этом случае адресная строка Safari
 * остаётся светлой над тёмной страницей, что читается как незагруженный экран.
 *
 * Поэтому после явного выбора мету переписываем: находим тег без медиа-запроса
 * (или создаём его) и ставим фактический цвет канвы. Значение берётся из
 * вычисленного стиля, а не из карты токенов, — тогда источник правды остаётся
 * один, и цвет не разойдётся с темой при правке токенов.
 *
 * Компонент ничего не рендерит: это побочный эффект, а не разметка.
 */

'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';

const META_NAME = 'theme-color';

export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!resolvedTheme) return;

    /*
     * Замер на следующем кадре, а не сразу.
     *
     * Атрибут `data-theme` ставит `next-themes` в своём эффекте, и порядок
     * эффектов не гарантирует, что к моменту нашего он уже на месте: первая
     * версия читала предыдущий цвет канвы и мета отставала на одно
     * переключение. Кадр отделяет «состояние сменилось» от «стили пересчитаны».
     */
    const frame = window.requestAnimationFrame(() => {
      const canvas = window
        .getComputedStyle(document.documentElement)
        .getPropertyValue('--surface-canvas')
        .trim();
      if (canvas.length === 0) return;

      /*
       * Теги с `media` оставляем в покое: они обслуживают случай «тема не
       * выбрана». Управляем только безусловным.
       */
      let meta = document.querySelector<HTMLMetaElement>(`meta[name="${META_NAME}"]:not([media])`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = META_NAME;
        document.head.append(meta);
      }
      meta.content = canvas;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [resolvedTheme]);

  return null;
}
