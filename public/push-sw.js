/*
 * Service worker сайта: Web Push (C-07) и офлайн-заглушка (A-20). Один файл на оба
 * назначения, а имя прежнее: по нему уже зарегистрированы подписки на push.
 * Без импортов и сборки: лежит в public/, регистрируется с корня сайта, поэтому
 * его область (scope) — весь сайт.
 *
 * Push: сервер шлёт JSON вида { title, body, href, tag }. Ссылка открывается только
 * внутри этого сайта: чужие адреса и некорректные значения заменяются на «/».
 *
 * Офлайн: при сбое сети навигация отдаёт заглушку /<локаль>/offline. Кешируется
 * только она. Страницы и данные не кешируются, поэтому устаревшие брони офлайн не покажутся.
 */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    const parsed = event.data ? event.data.json() : null;
    if (parsed && typeof parsed === 'object') data = parsed;
  } catch {
    data = {};
  }

  const title = typeof data.title === 'string' && data.title ? data.title : 'ArtDance';
  const options = {
    body: typeof data.body === 'string' ? data.body : '',
    tag: typeof data.tag === 'string' && data.tag ? data.tag : undefined,
    data: { href: safeHref(data.href) },
  };

  // Браузер требует показать уведомление на каждый push (userVisibleOnly), поэтому показываем всегда.
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const href = safeHref(event.notification.data && event.notification.data.href);
  event.waitUntil(openOrFocus(new URL(href, self.location.origin).href));
});

/** Путь внутри этого сайта или «/». Чужой origin и некорректные значения отбрасываются. */
function safeHref(value) {
  if (typeof value !== 'string' || value === '') return '/';
  try {
    const url = new URL(value, self.location.origin);
    if (url.origin !== self.location.origin) return '/';
    return url.pathname + url.search + url.hash;
  } catch {
    return '/';
  }
}

/** Фокусирует уже открытую вкладку с этим адресом или открывает новую. */
async function openOrFocus(target) {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of windows) {
    if (client.url === target) return client.focus();
  }
  return self.clients.openWindow(target);
}

/* ───────────────────────── Офлайн-заглушка (A-20) ───────────────────────── */

const OFFLINE_CACHE = 'artdance-offline-v1';
// Локали из src/i18n/config.ts. Скрипт без сборки и импортов, поэтому список повторён здесь.
const LOCALES = ['hy', 'ru', 'en'];
const DEFAULT_LOCALE = 'hy';
// Заглушка ссылается на хешированные файлы сборки: после деплоя её нужно перекешировать.
const OFFLINE_REFRESH_MS = 60 * 60 * 1000;
const lastOfflineRefresh = new Map();

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all(LOCALES.map((locale) => refreshOfflinePage(locale, true))).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Только навигация. API, медиа и POST сюда не попадают и идут в сеть как обычно.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.mode !== 'navigate' || request.method !== 'GET') return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) event.waitUntil(refreshOfflinePage(localeOf(request.url), false));
        return response;
      })
      .catch(() => offlineResponse(request.url)),
  );
});

/**
 * Перекладывает заглушку в кеш. При установке — всегда, при навигации — не чаще раза в час,
 * иначе каждый переход по сайту тянул бы страницу заново.
 */
async function refreshOfflinePage(locale, force) {
  const last = lastOfflineRefresh.get(locale) || 0;
  if (!force && Date.now() - last < OFFLINE_REFRESH_MS) return;
  lastOfflineRefresh.set(locale, Date.now());
  try {
    const response = await fetch(`/${locale}/offline`, { cache: 'reload' });
    if (response.ok) {
      const cache = await caches.open(OFFLINE_CACHE);
      await cache.put(`/${locale}/offline`, response);
    }
  } catch {
    // Сети нет: заглушка останется прежней, и следующая навигация попробует снова.
    lastOfflineRefresh.delete(locale);
  }
}

async function offlineResponse(url) {
  const cache = await caches.open(OFFLINE_CACHE);
  const locale = localeOf(url);
  const page = (await cache.match(`/${locale}/offline`)) || (await cache.match(`/${DEFAULT_LOCALE}/offline`));
  return page || Response.error();
}

/** Локаль из первого сегмента пути; без неё — локаль по умолчанию, как в middleware. */
function localeOf(url) {
  const segment = new URL(url).pathname.split('/')[1];
  return LOCALES.includes(segment) ? segment : DEFAULT_LOCALE;
}
