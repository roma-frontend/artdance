'use client';

/**
 * Синхронизация избранного.
 *
 * Проблема «сердечко закрашено, а в /account/favorites пусто» и
 * «чужое избранное видно другому пользователю» — один корень:
 * предыдущая версия работала один раз (ran=true) и больше не
 * синхронизировалась при смене пользователя.
 *
 * Исправление:
 * 1) Следим за `session.user.id`, а не запускаемся один раз.
 * 2) При входе/смене пользователя сервер — источник правды:
 *    `syncServerFavorites(serverKeys)` заменяет локальные ключи
 *    серверными (сохраняя только `event:*` — он локальный).
 *    Так чужое не остаётся на этом браузере.
 * 3) Гостевые отметки (до входа) мержим через `mergeGuestFavoritesAction`,
 *    затем перезапрашиваем сервер и делаем точную синхронизацию.
 * 4) При выходе полностью чистим `localStorage`.
 */

import { useEffect, useRef } from 'react';

import { authClient } from '@/lib/auth/auth-client';
import { readGuestFavorites, SERVER_FAVORITE_TARGETS } from '@/lib/client/favorites';
import { mergeGuestFavoritesAction } from '@/server/actions/favorites';

export function FavoritesSync() {
  const { data: session, isPending } = authClient.useSession();
  const prevUserId = useRef<string | null | undefined>(undefined);
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id ?? null;

  useEffect(() => {
    if (isPending) return;

    const currentId = sessionUserId;
    const prev = prevUserId.current;

    // Первая инициализация — просто запомнить.
    if (prev === undefined) {
      prevUserId.current = currentId;
      // Если уже залогинен на момент монтирования — сразу синхронизировать.
      if (currentId) {
        void syncForUser();
      }
      return;
    }

    // Выход: был залогинен, стал гостем.
    if (prev !== null && currentId === null) {
      prevUserId.current = null;
      void import('@/lib/client/favorites').then((m) => m.resetFavoritesOnSignOut());
      return;
    }

    // Вход или смена пользователя (A -> B без промежуточного null тоже ловим).
    if (currentId !== null && prev !== currentId) {
      prevUserId.current = currentId;
      void syncForUser();
      return;
    }
  }, [isPending, sessionUserId]);

  return null;
}

async function syncForUser(): Promise<void> {
  // Гостевые серверные ключи до синхронизации — кандидаты для мержа.
  const guestItems = readGuestFavorites().filter((i) => SERVER_FAVORITE_TARGETS.has(i.target)) as Array<{
    target: 'class' | 'instructor' | 'venue' | 'product';
    slug: string;
  }>;

  let serverKeys: string[] = [];
  try {
    const favRes = await fetch('/api/favorites', { cache: 'no-store' });
    if (favRes.ok) {
      const favData = (await favRes.json().catch(() => null)) as { keys?: string[] } | null;
      serverKeys = Array.isArray(favData?.keys) ? favData.keys : [];
    }
  } catch {
    // Сеть недоступна — не трогаем локальное, чтобы не стереть в offline.
    return;
  }

  // Нет гостевых — сразу точная синхронизация с сервером (удаляет чужой мусор).
  if (guestItems.length === 0) {
    const { syncServerFavorites } = await import('@/lib/client/favorites');
    syncServerFavorites(serverKeys);
    return;
  }

  // Есть гостевые — мержим, затем берём свежий список с сервера как истину.
  try {
    const result = await mergeGuestFavoritesAction({ items: guestItems });
    if (!result?.serverError) {
      try {
        const favRes2 = await fetch('/api/favorites', { cache: 'no-store' });
        if (favRes2.ok) {
          const d2 = (await favRes2.json().catch(() => null)) as { keys?: string[] } | null;
          if (Array.isArray(d2?.keys)) serverKeys = d2.keys;
        }
      } catch {}
    }
  } catch {}

  const { syncServerFavorites } = await import('@/lib/client/favorites');
  syncServerFavorites(serverKeys);
}
