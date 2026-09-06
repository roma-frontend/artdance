# ArtDance

Маркетплейс танцевальных услуг для Армении: занятия, инструкторы, аренда
площадок, онлайн-курсы и магазин экипировки. Три языка, локальные платежи в драмах,
четыре роли пользователей.

## Документы

| | |
|---|---|
| [Решения по проекту](./docs/00-decision-record.md) | какая смета и брендгайд выбраны, стек и обоснование отклонений |
| [Коммерческое предложение](./docs/01-commercial-proposal.md) | смета, три варианта объёма, окупаемость |
| [Брендовая система](./docs/02-brand-system.md) | палитра, типографика, реконсиляция гайда и прототипа |
| [Правила разработки](./docs/03-conventions.md) | где что лежит, что запрещено, открытые вопросы |
| [Безопасность и инфраструктура](./docs/04-security-and-infrastructure.md) | что перенято из builder-studio / office / online-shop и почему |
| [Карта экранов](./docs/05-screen-inventory.md) | все маршруты, файлы, данные, политика кеша |
| [План реализации](./docs/06-implementation-plan.md) | порядок работ от старта до запуска |
| [Бэклог возможностей](./docs/07-feature-backlog.md) | страницы и фичи сверх макета, монетизация, что добавить в схему до первой миграции |
| [Каталог компонентов](./docs/08-component-catalog.md) | 85 компонентов, которых нет в прототипе: формы, таблицы, оверлеи, состояния |
| [Каталог хелперов](./docs/09-helpers-catalog.md) | сигнатуры всех служебных модулей: время, доступность, поиск, SEO, кеш, уведомления |
| [Полировка и качество](./docs/10-polish-and-quality.md) | движение, доступность, скорость, мобильные детали, чек-лист готовности экрана |
| [Эталон дизайна](./design/reference/README.md) | утверждённый прототип, сверка токенов, найденные дефекты |

## Стек

Next.js 16 (App Router) · React 19 · TypeScript 6 · Tailwind CSS 4 · next-intl 4 ·
Prisma 7 + PostgreSQL · Zod 4 · Vitest 3

## Запуск

```bash
cp .env.example .env.local     # заполнить обязательные переменные
npm install
npm run db:generate           # сгенерировать Prisma Client
npm run dev                   # http://localhost:3000/hy
```

Приложение не запустится с неполным `.env.local`: схема окружения валидируется на
старте (`src/config/env.ts`). Это сделано намеренно — лучше упасть при деплое, чем
на платеже клиента.

## Деплой

Хостинг запускает только `install` и `build`, поэтому `npm run build` сам вызывает
`prisma generate`: сгенерированный клиент (`src/generated/`) не хранится в
репозитории, Prisma 7 не создаёт его на `postinstall`, а кеш сборки на Vercel
сохраняет `node_modules`, но не исходники. Генерация не требует базы: блок
`datasource` в `prisma.config.ts` объявляется только при наличии URL, иначе
`generate` падал бы на разрешении переменной, ничего не пытаясь подключить.

`.env.local` в репозиторий не попадает — переменные задаются в панели хостинга
отдельно для Production и Preview. Без этих сборка падает:

| | |
|---|---|
| `NEXT_PUBLIC_APP_URL` | абсолютный адрес деплоя |
| `NEXT_PUBLIC_APP_ENV` | `production` / `preview` |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | `hy` |
| `DATABASE_URL` | пререндер страниц оформления читает серверное окружение |
| `AUTH_SECRET` | ≥32 символов |

`NEXT_PUBLIC_*` подставляются на этапе сборки, а не рантайма: добавление
переменной требует нового деплоя, не перезапуска. `DIRECT_DATABASE_URL` нужна
миграциям — при её отсутствии Prisma берёт `DATABASE_URL`, но применять миграции
через pooler нельзя: Migrate требует advisory locks.

## Команды

| | |
|---|---|
| `npm run dev` | dev-сервер |
| `npm run build` | production-сборка: `prisma generate` + `next build`, включает проверку типов |
| `npm run verify` | **полная проверка перед коммитом**: токены, переводы, медиа, типы, линтер, тесты |
| `npm run verify:quick` | только типы и линтер |
| `npm run verify:headers` | поднимает сборку и сверяет фактические CSP, security-заголовки, кеш и CSRF |
| `npm run perf:budget` | бюджет веса по gzip: JS-бандл и статические ассеты (после `build`) |
| `npm run design:import` | импорт утверждённого прототипа и его изображений |
| `npm run design:status` | какие компоненты готовы, какие классы макета не покрыты |
| `npm run media:optimize` | пережать ассеты `public/media/seed` и обновить сгенерированный манифест |
| `npm run media:check` | проверить, что медиа оптимизировано и укладывается в бюджет (входит в `verify`) |
| `npm run tokens:build` | перегенерировать `src/styles/tokens.css` из TypeScript-токенов |
| `npm run i18n:check` | сверить каталоги переводов между локалями |
| `npm run db:migrate` | создать и применить миграцию |
| `npm run db:seed` | заполнить БД начальными данными |
| `npm run db:studio` | Prisma Studio |
| `npm test` | тесты |

## Структура

```
src/
  app/[locale]/       страницы (App Router), локаль в URL
  app/api/health/     liveness и readiness для мониторинга
  app/global-error.tsx последний рубеж: свои html/body, инлайновые стили
  components/ui/      компоненты дизайн-системы
  config/             ★ все настройки: env, routes, бизнес-правила, тарифы,
                        фичи, capabilities, security, cache
  design/tokens/      ★ дизайн-токены: primitives → semantic → CSS
  domain/             словари, деньги, бизнес-ошибки
  i18n/               локали и каталоги сообщений (hy / ru / en)
  lib/
    auth/             гварды авторизации и capability-модель
    media/            конвейер изображений: EXIF, ре-энкод, blur, бюджет
    payments/         абстракция платёжных провайдеров
    security/         rate limit, загрузки, webhook-подписи, Turnstile, экспорт
    audit.ts          журнал действий с before/after
    db.ts             Prisma Client (singleton)
  styles/             globals.css + генерируемый tokens.css
  proxy.ts            весь edge-слой безопасности: CSP, CSRF, rate limit, локали
instrumentation.ts    startup-хуки, ветвление по рантайму
prisma/               schema.prisma (59 моделей) + миграции + seed
scripts/               генератор токенов, проверка переводов, оптимизация медиа,
                      бюджет веса, проверка заголовков на живом сервере
docs/                 решения, смета, бренд, конвенции, безопасность
```

★ — слои, где значения объявляются. Во всём остальном коде нет ни цветов, ни
текстов, ни путей-строк, ни бизнес-констант. Подробности — в
[правилах разработки](./docs/03-conventions.md).

## Безопасность

Реализовано и проверено автоматически: CSP и security-заголовки, CSRF через
`Origin`, rate limiting с fail-closed в production, capability-RBAC с временными
грантами, audit log с маскировкой PII, валидация загрузок, проверка подписи
webhook, защита экспортов от formula injection, кеш-политика с явным списком
приватных маршрутов.

`npm run verify:headers` поднимает production-сборку и сверяет фактические
заголовки и отклонение cross-origin запроса — эту часть невозможно проверить
юнит-тестом. Подробности и список того, что осталось сделать —
в [документе по безопасности](./docs/04-security-and-infrastructure.md).
