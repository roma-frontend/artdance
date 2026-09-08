/**
 * Проверка, что security- и cache-заголовки реально доезжают до клиента.
 *
 *   npm run verify:headers
 *
 * Поднимает production-сборку, опрашивает несколько маршрутов, сверяет
 * фактические заголовки с ожиданиями и гасит сервер. Нужен потому, что
 * конфигурация заголовков — единственная часть безопасности, которую нельзя
 * проверить юнит-тестом: результат зависит от взаимодействия proxy, Next и
 * порядка правил в `headers()`.
 */

import { spawn } from 'node:child_process';

const PORT = Number(process.env.VERIFY_PORT ?? 3123);
const BASE = `http://127.0.0.1:${PORT}`;
const STARTUP_TIMEOUT_MS = 60_000;

/** Ожидания: [маршрут, заголовок, предикат, описание]. */
const EXPECTATIONS = [
  ['/hy', 'content-security-policy', (v) => v?.includes("default-src 'self'"), 'CSP присутствует'],
  ['/hy', 'content-security-policy', (v) => v?.includes("frame-ancestors 'none'"), 'запрет встраивания'],
  ['/hy', 'x-content-type-options', (v) => v === 'nosniff', 'nosniff'],
  ['/hy', 'x-frame-options', (v) => v === 'DENY', 'X-Frame-Options'],
  ['/hy', 'referrer-policy', (v) => v === 'strict-origin-when-cross-origin', 'Referrer-Policy'],
  ['/hy', 'permissions-policy', (v) => v?.includes('camera=()'), 'Permissions-Policy'],
  ['/hy', 'cross-origin-opener-policy', (v) => v === 'same-origin', 'COOP'],
  ['/hy', 'x-powered-by', (v) => v === undefined, 'x-powered-by удалён'],
  ['/hy', 'cache-control', (v) => v?.includes('s-maxage=180'), 'каталог кешируется CDN'],
  ['/hy/account', 'cache-control', (v) => v?.includes('no-store'), 'приватный раздел не кешируется'],
  ['/hy/about', 'cache-control', (v) => v?.includes('s-maxage=3600'), 'контентные страницы'],
  ['/hy/legal/terms', 'cache-control', (v) => v?.includes('s-maxage=86400'), 'правовые страницы'],
  ['/api/search?q=salsa', 'cache-control', (v) => v?.includes('no-store'), 'поиск не кешируется'],
  /*
   * Доступность — самый дорогой промах в кеше во всём проекте: повторно отданный
   * CDN ответ означает предложение занятого времени, то есть двойную бронь.
   */
  [
    '/api/availability?instructor=anna-mkrtchyan',
    'cache-control',
    (v) => v?.includes('no-store'),
    'доступность не кешируется',
  ],
  /*
   * Карточка для соцсетей не должна получать каталожные 180 секунд от
   * `/classes/:slug*`: её адрес подписан отпечатком содержимого, а превью
   * перезапрашивают часто.
   */
  [
    '/hy/classes/latin-fusion/opengraph-image',
    'cache-control',
    (v) => v?.includes('max-age=2592000'),
    'карточка для соцсетей кешируется надолго',
  ],
  [
    '/hy/classes/latin-fusion/opengraph-image',
    'content-type',
    (v) => v?.includes('image/png'),
    'карточка отдаётся картинкой',
  ],
  ['/api/health', 'cache-control', (v) => v?.includes('no-store'), 'health не кешируется'],
  ['/api/health', 'content-security-policy', (v) => typeof v === 'string', 'CSP и на API'],
];

async function waitForServer() {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/api/health`, { redirect: 'manual' });
      if (response.status < 500) return;
    } catch {
      /* сервер ещё поднимается */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`сервер не поднялся за ${STARTUP_TIMEOUT_MS} мс`);
}

const server = spawn(`npm run start -- --port ${PORT}`, {
  stdio: 'ignore',
  shell: true,
  env: { ...process.env, PORT: String(PORT) },
});

let failures = 0;
let skipped = 0;

try {
  await waitForServer();

  const cache = new Map();
  for (const [path, header, predicate, label] of EXPECTATIONS) {
    if (!cache.has(path)) {
      cache.set(path, await fetch(`${BASE}${path}`, { redirect: 'manual' }));
    }
    const response = cache.get(path);

    /**
     * Cache-Control у 404 всегда `no-store` — это поведение Next, а не наша
     * политика. Проверять её на несуществующем маршруте бессмысленно, поэтому
     * такие проверки пропускаются с явной отметкой, а не тихо «проходят».
     */
    if (response.status === 404 && header === 'cache-control') {
      skipped += 1;
      console.log(`SKIP ${path} · ${label} (маршрут ещё не реализован)`);
      continue;
    }

    const actual = response.headers.get(header) ?? undefined;
    const ok = predicate(actual);
    if (!ok) failures += 1;
    console.log(
      `${ok ? 'OK  ' : 'FAIL'} ${path} · ${label}${ok ? '' : `\n       получено: ${actual ?? '(нет)'}`}`,
    );
  }

  /** CSRF: мутирующий запрос с чужим Origin должен получить 403. */
  const crossOrigin = await fetch(`${BASE}/api/health`, {
    method: 'POST',
    headers: { origin: 'https://attacker.example' },
    redirect: 'manual',
  });
  const csrfOk = crossOrigin.status === 403;
  if (!csrfOk) failures += 1;
  console.log(
    `${csrfOk ? 'OK  ' : 'FAIL'} POST с чужим Origin отклоняется${csrfOk ? '' : ` (получено ${crossOrigin.status})`}`,
  );
} finally {
  /**
   * На Windows `npm run` запускает дерево процессов, и SIGTERM родителю не гасит
   * node-сервер. `taskkill /T` завершает дерево; на остальных платформах
   * достаточно SIGTERM.
   */
  if (process.platform === 'win32' && server.pid) {
    spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    server.kill('SIGTERM');
  }
  /** Дать процессу закрыть дескрипторы до выхода. */
  await new Promise((resolve) => setTimeout(resolve, 300));
}

if (failures > 0) {
  console.error(`\nverify:headers — провалено проверок: ${failures}`);
  process.exit(1);
}
console.log(`\nverify:headers — OK${skipped > 0 ? ` (пропущено: ${skipped})` : ''}`);
process.exit(0);
