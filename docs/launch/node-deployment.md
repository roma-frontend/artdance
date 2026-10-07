# Node.js-деплой за Cloudflare

## Схема

Для альтернативного запуска непосредственно на Workers нужен Workers Paid:
Free ограничивает CPU до 10 мс и отклоняет `limits.cpu_ms` с кодом `100328`.
Cloudflare-сборка использует Webpack, Prisma edge-клиент и binding `HYPERDRIVE`
из `wrangler.jsonc`. Hyperdrive `artdance-db` создан без кеширования SQL-ответов.
Node.js-сборка продолжает использовать обычный Prisma-клиент и `DATABASE_URL`.

После включения Workers Paid выполнить `npm run deploy:cf`, затем проверить
`/hy`, `/en` и `/ru`. Preview/deploy загружают локальное окружение и передают
`DATABASE_URL` только в окружение процесса для локальной настройки Hyperdrive;
строку подключения не добавлять в `wrangler.jsonc`. Runtime-секреты Worker
по-прежнему должны быть настроены отдельно. `NEXT_PUBLIC_APP_URL` при сборке
должен совпадать с фактическим production-origin.

Workers не поддерживает нативный sharp: загрузку и обработку фотографий нужно
вынести в совместимый сервис. Отложенный импорт sharp предотвращает падение
страниц при загрузке OG-метаданных, но не делает upload-конвейер совместимым.

Cloudflare DNS/CDN → HTTPS reverse proxy / балансировщик хостинга → `next start`.
PostgreSQL остаётся отдельной БД; медиа production хранятся в R2.

### Медиа на R2, приложение на Vercel

- Бакет: `artdance`; публичная база: `https://pub-3a0600ebdb9946a09619fd872274be49.r2.dev`.
- На Vercel в Preview и Production задать `NEXT_PUBLIC_MEDIA_CDN_URL` и
  `R2_PUBLIC_BASE_URL` равными публичной базе, `R2_BUCKET=artdance`, а также
  `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` для новых загрузок.
  Имена `R2_BUCKET_NAME` и `R2_PUBLIC_URL` приложение не использует.
- `npm run media:r2:sync` загружает фото и видео из `public/media` под ключами
  `media/...`, а видео-исходники из `manual/generated-style-videos` под
  `originals/generated-style-videos/...`. Секреты и JSON-файлы заданий не загружаются.
- `npm run media:r2:check` проверяет публичную доступность, размер и MIME каждого файла.
  Реестр `design/media-r2-manifest.json` позволяет запускать проверку без локальных копий.
- `media:check` проверяет изображения прямо из R2, включая отпечатки и бюджеты;
  `video:check` проверяет комплектность и бюджеты видео по реестру R2.
- CORS для публичного чтения: `npx wrangler r2 bucket cors set artdance --file scripts/r2-cors.json --force`.
- `.vercelignore` исключает локальное медиа и артефакты Workers из загрузки Vercel.
  Локальные фото и видео удалены после проверки всех объектов R2.
  После замены CDN-переменных нужен новый build.
Это **не** Cloudflare Pages и **не** Workers: `wrangler.jsonc` и `deploy:cf`
относятся к альтернативному OpenNext-пути и для этого запуска не используются.
Нативный sharp, загрузка фотографий, OG-шрифты, SSR, API и ISR работают на Node.js.

## Настройки Node.js-сервиса

- Node.js: версия из `.nvmrc` (минимум 22.12).
- Корень: корень этого репозитория.
- Install command: `npm ci` (с devDependencies для сборки и optionalDependencies для sharp).
- Build command: `npm run build`.
- Start command: `npm run start -- --hostname 0.0.0.0`.
- Порт: переменная `PORT`, задаваемая хостингом; Next её поддерживает.
- Liveness: `GET /api/health`, ожидается 200.
- Readiness: `GET /api/health?deep=1`, ожидается 200 и `checks.database.ok=true`.
- Сохранять `public/`, `src/design/og-fonts/`, `.next/`, `node_modules/`,
  package.json и конфигурационные файлы. Не переносить Windows node_modules на Linux:
  установка и сборка выполняются на целевой ОС, иначе sharp не загрузится.
- Начать с одного процесса и доступного для записи `.next/cache` для ISR.
  Несколько инстансов требуют общего кеша и координации revalidation.

`npm run build` сначала запускает `env:check`, потом Prisma generate и Next build.
Проверка не создаёт секреты, не применяет миграции и не маскирует отсутствие БД.

## Окружение: две отдельные группы

Секреты не коммитить, не класть в NEXT_PUBLIC_* и не передавать в Docker ARG.
На хостинге использовать защищённые Build secrets / runtime secrets.

| Переменная | Build | Runtime | Значение |
|---|---|---|---|
| NEXT_PUBLIC_APP_URL | обязательно | то же значение | реальный HTTPS-домен сайта, не pages.dev |
| NEXT_PUBLIC_APP_ENV | production | production | preview только для отдельного preview-сервиса |
| NEXT_PUBLIC_DEFAULT_LOCALE | hy | hy | либо ru/en |
| NEXT_PUBLIC_FEATURE_* | все используемые | те же | true/false согласно .env.example |
| DATABASE_URL | секрет, обязательно | секрет, обязательно | доступный PostgreSQL pooler с актуальной схемой |
| AUTH_SECRET | секрет, ≥32 символов | тот же секрет | сохранять между деплоями, иначе сессии перестанут работать |
| AUTH_TRUSTED_ORIGINS | при необходимости | при необходимости | точный HTTPS-origin сайта и разрешённых preview |
| NEXT_PUBLIC_MEDIA_CDN_URL | если R2/CDN используется | то же | публичный адрес медиа |

Любые NEXT_PUBLIC_* (включая Turnstile, аналитику и CDN) фиксируются при сборке.
Изменение требует новой сборки, а не одного рестарта процесса.
`wrangler.jsonc.vars` не передаёт эти настройки Node.js-хостингу.

Сборка читает каталог из PostgreSQL для generateStaticParams и OG-карточек.
Нужна **реальная доступная база**, не фиктивный URL. Ошибки подключения/TLS или
неприменённые миграции надо исправить в БД/окружении, а не отключать валидацию.
`npm run env:check` проверяет формат конфигурации, но не доступность БД.

## Подготовка базы

Перед сборкой новой версии отдельно применить проверенные миграции:

```bash
npm run db:deploy
```

Для миграций задать `DIRECT_DATABASE_URL` (прямое подключение или session pooler).
Не использовать transaction pooler для Prisma Migrate. Команда меняет БД:
в production выполнять как осознанный release-шаг после backup и проверки миграций.
`db:seed:clean`, `db:clean` и reset-команды на production не запускать.
Существующие реальные данные не заменять демо-сидом.

## Что ещё нужно для работающих production-функций

Одних DATABASE_URL/AUTH_SECRET достаточно для базовой валидации, но не для всех
интеграций. Полный список — `.env.example` и `src/config/env-report.ts`.

- `RATE_LIMIT_REDIS_URL` + `RATE_LIMIT_REDIS_TOKEN`: без распределённого limiter
  production отклоняет чувствительные операции (fail closed). Не отключать защиту.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
  `R2_PUBLIC_BASE_URL`: загрузки фото в production; локальный диск не заменяет R2.
- `RESEND_API_KEY`, `EMAIL_FROM`: письма подтверждения/восстановления.
- Turnstile: публичный site key при сборке, secret key в runtime.
- Реальные ключи выбранного payment provider, callback/webhook на HTTPS-домен.
  `mock` не означает готовность принимать платежи.
- `CRON_SECRET` и внешний scheduler: перенести расписания из `vercel.json`,
  вызывая соответствующие POST /api/cron/* с `Authorization: Bearer <CRON_SECRET>`.
  На Node-хостинге vercel.json само по себе расписания не создаёт.

## Cloudflare

1. DNS A/CNAME направить на Node.js-хостинг и включить proxy, когда origin готов.
2. На origin нужен TLS-сертификат; SSL/TLS Cloudflare — **Full (strict)**, не Flexible.
3. Не включать Cache Everything для HTML, `/api/*`, авторизации, кабинетов,
   checkout и бронирования. Не кешировать POST, ответы с Set-Cookie и `no-store`.
   Для начала кешировать только статические ассеты; Next сам обслуживает ISR.
4. Не менять CSP/security headers на CDN; не включать преобразование JS/Rocket Loader.
5. Прокси должен сохранять Host, HTTPS forwarded headers, query string и cookies.
   Origin закрыть от произвольного прямого трафика и поддельных forwarded headers
   средствами хостинга/reverse proxy. Ограничение размера upload не меньше политики
   приложения, streaming не буферизовать без необходимости.
6. Проверить DNS/auth/payment callbacks на настоящем домене. Переезд на другой
   origin URL требует обновления NEXT_PUBLIC_APP_URL и пересборки.

## Проверка после сборки и запуска

```bash
npm run env:check
npm run typecheck
npm test
npm run build
npm run verify:headers
npm run start -- --hostname 0.0.0.0
```

На реальном домене проверить `/hy`, `/ru`, `/en`, каталог, поиск, OG-картинку,
`/_next/image`, вход/выход, загрузку фото и тестовый checkout выбранного провайдера.
Readiness должна быть 200; private/API-ответы должны сохранять no-store.
Не считать успешную сборку доказательством доступности R2, Redis, email или платежей.
