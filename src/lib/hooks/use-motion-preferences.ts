/**
 * Системные настройки движения и трафика.
 *
 * Реализовано через `useSyncExternalStore`, а не через `useEffect` + `setState`.
 * Причины две, и обе практические:
 *
 * 1. `matchMedia` — это внешний источник состояния. Эффект, который читает его и
 *    вызывает `setState`, даёт каскадный рендер: React уже отрисовал кадр с
 *    неверным значением. `useSyncExternalStore` отдаёт верное значение сразу.
 * 2. Пользователь может переключить «уменьшить движение» на ходу — в системных
 *    настройках или в режиме энергосбережения. Подписка это подхватывает,
 *    однократный эффект — нет.
 *
 * Серверное значение — «показывать статичный кадр». На сервере предпочтения
 * неизвестны, и безопасный ответ здесь один: не запускать движение.
 */

'use client';

import { useSyncExternalStore } from 'react';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const REDUCED_DATA = '(prefers-reduced-data: reduce)';

type NetworkInformation = { saveData?: boolean; effectiveType?: string };

function connection(): NetworkInformation | undefined {
  return (navigator as Navigator & { connection?: NetworkInformation }).connection;
}

/** Подписка на обе медиа-настройки и на изменение типа соединения. */
function subscribe(onChange: () => void): () => void {
  const queries = [window.matchMedia(REDUCED_MOTION), window.matchMedia(REDUCED_DATA)];
  for (const query of queries) query.addEventListener('change', onChange);

  const network = connection() as (NetworkInformation & EventTarget) | undefined;
  network?.addEventListener?.('change', onChange);

  return () => {
    for (const query of queries) query.removeEventListener('change', onChange);
    network?.removeEventListener?.('change', onChange);
  };
}

function getSnapshot(): boolean {
  if (window.matchMedia(REDUCED_MOTION).matches) return true;
  if (window.matchMedia(REDUCED_DATA).matches) return true;

  const network = connection();
  if (network?.saveData === true) return true;
  if (network?.effectiveType === '2g' || network?.effectiveType === 'slow-2g') return true;

  return false;
}

/** На сервере и до гидратации — статичный кадр. */
function getServerSnapshot(): boolean {
  return true;
}

/**
 * `true`, если пользователь просил не тратить трафик или не показывать движение:
 * автовоспроизведение, параллакс и трейл в этом случае не запускаются.
 */
export function usePrefersStillImage(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Только настройка движения — для параллакса и появления секций. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => true,
  );
}
