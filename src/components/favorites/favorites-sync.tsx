'use client';

/**
 * Синхронизация избранного.
 *
 * 1) Подтягивает ключи с сервера, чтобы у залогиненного сердце было закрашено
 *    и после перезагрузки (иначе localStorage пуст и карточка выглядит неотмеченной).
 * 2) Переносит гостевые отметки, накопленные до входа, через `mergeGuestFavoritesAction`.
 *    Клиентский localStorage серверу недоступен, поэтому хук `after` в auth.ts туда
 *    не дотянется — перенос делается здесь.
 */

import { useEffect, useRef } from 'react';

import { hydrateServerFavorites, overwriteFavorites, readGuestFavorites } from '@/lib/client/favorites';
import { mergeGuestFavoritesAction } from '@/server/actions/favorites';

export function FavoritesSync() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    let cancelled = false;
    (async () => {
      try {
        try {
          const favRes = await fetch('/api/favorites', { cache: 'no-store' });
          if (favRes.ok) {
            const favData = (await favRes.json().catch(() => null)) as { keys?: string[] } | null;
            if (favData?.keys?.length) hydrateServerFavorites(favData.keys);
          }
        } catch {}

        const items = readGuestFavorites();
        const filtered = items.filter(
          (i) => i.target === 'class' || i.target === 'instructor' || i.target === 'venue' || i.target === 'product',
        ) as Array<{ target: 'class' | 'instructor' | 'venue' | 'product'; slug: string }>;
        if (filtered.length === 0) return;

        const sessionRes = await fetch('/api/auth/get-session', { cache: 'no-store' });
        if (!sessionRes.ok) return;
        const data = (await sessionRes.json().catch(() => null)) as { user?: { id?: string } } | null;
        if (!data?.user?.id) return;
        if (cancelled) return;

        const result = await mergeGuestFavoritesAction({ items: filtered });
        if (cancelled) return;
        if (!result?.serverError) {
          // Перезаписываем локальный набор серверными ключами — иначе `clear` стёр бы и hydrate
          try {
            const favRes2 = await fetch('/api/favorites', { cache: 'no-store' });
            if (favRes2.ok) {
              const d2 = (await favRes2.json().catch(() => null)) as { keys?: string[] } | null;
              if (d2?.keys) overwriteFavorites(d2.keys);
              else overwriteFavorites([]);
            } else {
              // fallback — просто очищаем гостевые из локального набора
              const { clearGuestFavorites } = await import('@/lib/client/favorites');
              clearGuestFavorites();
            }
          } catch {
            const { clearGuestFavorites } = await import('@/lib/client/favorites');
            clearGuestFavorites();
          }
        }
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
