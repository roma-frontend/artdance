/*
 * Service worker для Web Push (C-07). Без импортов и сборки: лежит в public/,
 * регистрируется с корня сайта, поэтому его область (scope) — весь сайт.
 *
 * Сервер шлёт JSON вида { title, body, href, tag }. Ссылка открывается только внутри
 * этого сайта: чужие адреса и некорректные значения заменяются на «/».
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
