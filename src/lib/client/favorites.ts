'use client';

/**
 * ИЗБРАННОЕ ГОСТЯ — набор отметок в `localStorage`.
 *
 * Почему избранное работает до входа. Сердечко, которое на нажатие отвечает
 * «сначала войдите», — это стена ровно в тот момент, когда человек впервые
 * захотел что-то сделать. Отметка стоит нам одну строку в браузере, поэтому
 * гость отмечает сразу, а при входе набор переносится в `Favorite` в базе — тем
 * же движением, что и корзина гостя (задача 4.1 плана).
 *
 * Почему `useSyncExternalStore`, а не `useState` + `useEffect`. `localStorage` —
 * внешний источник состояния, и он общий для всех кнопок на странице: отметив
 * занятие в карточке, пользователь обязан увидеть закрашенное сердце и в блоке
 * «похожие». Со локальным состоянием у каждой кнопки была бы своя копия правды.
 * Плюс правило `react-hooks/set-state-in-effect` в проекте запрещает второй
 * вариант — и запрещает справедливо, см. `use-motion-preferences.ts`.
 *
 * События `storage` тоже слушаются: две открытые вкладки не должны показывать
 * разное избранное.
 */

import { useCallback, useSyncExternalStore } from 'react';

/** Ключ в `localStorage`. Стиль тот же, что у ключа темы. */
const STORAGE_KEY = 'ARTDANCE_FAVORITES';

/** Тип сущности. Совпадает с `Favorite.targetType` в схеме. */
export type FavoriteTarget = 'class' | 'instructor' | 'venue' | 'event' | 'product';

/** Ключ отметки. Тип обязателен: слаги уникальны внутри раздела, а не между ними. */
export function favoriteKey(target: FavoriteTarget, slug: string): string {
  return `${target}:${slug}`;
}

/**
 * Подписчики на изменение набора.
 *
 * Нужны потому, что запись в `localStorage` из своей же вкладки не вызывает
 * событие `storage` — браузер оповещает только другие вкладки. Без своей шины
 * кнопка, по которой нажали, не перерисовалась бы.
 */
const listeners = new Set<() => void>();

/**
 * Снимок в виде строки, а не `Set`.
 *
 * `useSyncExternalStore` сравнивает снимки по ссылке и уходит в бесконечный
 * рендер, если каждый вызов создаёт новый объект. Строка сравнивается по
 * значению, поэтому «ничего не изменилось» действительно означает то же самое.
 */
let snapshot: string | null = null;

function read(): string {
  if (snapshot !== null) return snapshot;
  try {
    snapshot = window.localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    /** Приватный режим Safari бросает на любой доступ к хранилищу. */
    snapshot = '';
  }
  return snapshot;
}

function write(keys: readonly string[]): void {
  snapshot = keys.join(',');
  try {
    window.localStorage.setItem(STORAGE_KEY, snapshot);
  } catch {
    /* Отметка не сохранится между сессиями, но в текущей работать будет. */
  }
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    snapshot = null;
    onChange();
  };
  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/** Набор на сервере пуст: сервер про браузерное хранилище не знает. */
function serverSnapshot(): string {
  return '';
}

function parse(raw: string): readonly string[] {
  return raw.length === 0 ? [] : raw.split(',');
}

/**
 * Отмечена ли сущность и как это переключить.
 *
 * Первый клиентский кадр совпадает с серверным (набор пуст) и наполняется после
 * гидратации: иначе React ругался бы на расхождение разметки, а пользователь
 * видел бы мигание сердца.
 */
export function useFavorite(target: FavoriteTarget, slug: string): {
  isFavorite: boolean;
  toggle: () => boolean;
} {
  const key = favoriteKey(target, slug);
  const raw = useSyncExternalStore(subscribe, read, serverSnapshot);
  const isFavorite = parse(raw).includes(key);

  const toggle = useCallback(() => {
    const current = parse(read());
    const next = current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key];
    write(next);
    return next.includes(key);
  }, [key]);

  return { isFavorite, toggle };
}

/**
 * Весь набор отметок гостя — для переноса в аккаунт при входе.
 *
 * Возвращает разобранные пары, а не строки: серверному действию нужны тип и
 * слаг по отдельности, и разбирать формат хранения на сервере означало бы знать
 * о нём в двух местах.
 */
export function readGuestFavorites(): ReadonlyArray<{ target: FavoriteTarget; slug: string }> {
  return parse(read()).flatMap((key) => {
    const separator = key.indexOf(':');
    if (separator <= 0) return [];
    return [
      {
        target: key.slice(0, separator) as FavoriteTarget,
        slug: key.slice(separator + 1),
      },
    ];
  });
}

/** Очистка после успешного переноса в аккаунт. */
export function clearGuestFavorites(): void {
  write([]);
}
