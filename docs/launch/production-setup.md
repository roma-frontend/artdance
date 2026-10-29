# Production-окружение: домен, Cloudflare, Vercel, env (шаг 0.5 / задача 8.5)

Собрано как последовательность действий: что открыть, что вписать, чем
проверить. Всё, кроме создания аккаунтов, делается за один вечер. Ссылки на
аккаунты — в списке «кто заводит» внизу.

---

## 1. Домен и DNS (шаг 0.5) — ~30 минут + ожидание

1. Зарегистрировать `artdance.am` у аккредитованного регистратора `.am`
   (например, `nic.am` либо через реселлера). Регистратор — заказчик, аккаунт
   остаётся у него.
2. Сменить nameservers домена на Cloudflare:
   - Создать аккаунт Cloudflare → Add site → `artdance.am` (free-план
     достаточен).
   - Cloudflare выдаст два nameserver'а вида `xxx.ns.cloudflare.com` —
     вписать их в панели регистратора.
3. Подождать делегирование (от минут до 24 часов; у `.am` обычно быстро).
4. DNS-записи в Cloudflare добавить, когда будет известен адрес Vercel
   (шаг 2): сначала достаточно `A`/`CNAME` заглушки.

Проверка: `dig NS artdance.am` (или `nslookup -type=NS artdance.am`) отвечает
cloudflare-неймами.

## 2. Vercel: проект и прод-домен — ~20 минут

1. Создать аккаунт Vercel (или использовать существующий) и импортировать
   репозиторий `roma-frontend/artdance`. Framework: Next.js — определится
   сам, ничего настраивать не надо.
2. Домен: Project → Settings → Domains → добавить `artdance.am` и
   `www.artdance.am`:
   - apex `artdance.am` → Vercel предложит запись `A 76.76.21.21` (или свой
     текущий anycast — следовать подсказке панели);
   - `www` → `CNAME cname.vercel-dns.com`.
   - Записи создать в Cloudflare (шаг 1.4). **Прокси Cloudflare для apex
     A-записи**: если Vercel ругается на валидацию домена — временно
     поставить «DNS only» (серое облако), после валидации можно вернуть
     прокси; SSL-режим Cloudflare — Full (strict).
3. Проверка: `https://artdance.am` и `https://www.artdance.am` отвечают
   200, сертификат валиден.

## 3. Переменные окружения прода — по списку `.env.example`

Project → Settings → Environment Variables → Production. Обязательные
(без них деплой упадёт на старте со списком недостающего — это проверка
`src/config/env.ts`):

| Ключ                                  | Откуда                                   |
| ------------------------------------- | ---------------------------------------- |
| `DATABASE_URL`, `DIRECT_DATABASE_URL` | Supabase (см. ниже)                      |
| `AUTH_SECRET`                         | сгенерировать: `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL`                 | `https://artdance.am`                    |
| `NEXT_PUBLIC_APP_ENV`                 | `production`                             |
| `NEXT_PUBLIC_DEFAULT_LOCALE`          | `hy`                                     |

По мере включения сервисов добавлять: `R2_*` (шаг 0.4), ключи банка
(`PAYMENT_PROVIDER` + реквизиты, шаг 0.6), `RESEND_API_KEY`/`EMAIL_FROM`
(письма), SMS-провайдер (шаг 0.7), `SENTRY_*`, `TURNSTILE_*`,
`RATE_LIMIT_REDIS_*` (Upstash — см. задачу 8.5).

Каждая переменная — с деплоем; менять «на живую» нельзя: значения
`NEXT_PUBLIC_*` зашиваются в бандл при сборке.

## 4. База данных прода (Supabase)

1. Создать проект Supabase (регион Frankfurt — ближайший к Армении из
   доступных).
2. Из Project Settings → Database взять:
   - connection string с пулером → `DATABASE_URL`;
   - прямое подключение (порт 5432, без pooler) → `DIRECT_DATABASE_URL`
     (нужно миграциям: `prisma migrate deploy`).
3. Применить миграции:

```bash
DATABASE_URL="…" DIRECT_DATABASE_URL="…" npm run db:deploy
```

Демо-сид (`npm run db:seed`) на прод не запускать: он создаёт демо-аккаунты с общим паролем из репозитория. Правило — в [node-deployment.md](node-deployment.md).

**Первый деплой на пустую базу:** строки `ContentBlock` главной для `hy`, `ru`, `en` может не быть. В этом случае главная отдаёт контент из кода (фоллбэк `loadFallbackHomeContent`) и пишет предупреждение в лог; сборка на пустой базе не проверена: CI выполняет миграции и `db:seed` до `npm run build`. Заведите строку в админке, чтобы главная показывала контент из CMS (см. `docs/04-security-and-infrastructure.md`, §1.17).

4. Включить PITR/бэкапы в панели Supabase (paid-план) — это ответ на пункт
   8.6 «бэкапы»: база на Vendor backup + еженедельный ручной экспорт
   `pg_dump` в начале.

## 5. Настройки платформы, которые легко забыть

- **Supabase → Auth → URL Configuration**: не используется (аутентификация
  своя, Better Auth) — но добавить `https://artdance.am` в allowed-origins
  стоит, если когда-нибудь включите Magic links.
- **Cloudflare → Speed → Auto Minify**: выключить (Next сам минифицирует;
  двойная минификация ломает hydration в редких случаях).
- **Cloudflare → Rules**: кеширование статики Next берёт на себя через
  заголовки; правило «Cache Everything» для `/` **не** создавать.
- **Vercel → Deployment Protection**: выключить для прода (иначе страницы
  будут за логином Vercel).
- **Домен в коде**: `NEXT_PUBLIC_APP_URL=https://artdance.am` — от него
  зависят OG-карточки, sitemap и письма.

## 6. Smoke-тест прода после первого деплоя

| Проверка               | Как                                                         |
| ---------------------- | ----------------------------------------------------------- |
| Главная на трёх языках | `/hy`, `/ru`, `/en` — 200, тексты правильные                |
| 404 и error            | несуществующий адрес — своя страница, не стек               |
| Регистрация и вход     | создать аккаунт, письмо пришло (если Resend включён)        |
| Роль читается          | после входа в шапке кабинет, не кнопка «войти»              |
| Health                 | `/api/health` — `{"status":"ok",...}`                       |
| Заголовки безопасности | DevTools → Network → документ: CSP, X-Frame-Options         |
| Скорость               | Lighthouse из `lighthouserc.json` (a11y ≥ 0.95, SEO ≥ 0.95) |
| Sitemap                | `/sitemap.xml` содержит `https://artdance.am/...`           |

## Кто что заводит (аккаунты заказчика)

| Сервис            | Зачем                | Аккаунт                              |
| ----------------- | -------------------- | ------------------------------------ |
| Регистратор `.am` | домен                | заказчик                             |
| Cloudflare        | DNS, SSL             | заказчик (можно делегировать доступ) |
| Supabase          | БД                   | заказчик                             |
| Vercel            | хостинг              | разработчик + заказчик (read)        |
| Upstash           | Redis для rate limit | заказчик                             |
| Resend            | письма               | разработчик                          |
| Sentry            | ошибки               | разработчик                          |

Правило: всё, что живёт после ухода разработчика (домен, БД, хостинг) —
на аккаунтах заказчика; доступ разработчика — приглашением, отзывным.

## Отдача медиа через origin (Zscaler-совместимость)

Корпоративные прокси (Zscaler) на части компьютеров режут прямые cross-site
запросы к `*.r2.dev` ответом 403: иконки PWA, постеры и видео то открываются,
то нет в зависимости от сети. Поэтому медиа отдаётся через origin:

* прямые загрузки браузера (видео, постеры-атрибуты, иконки PWA, лого, PDF)
  получают относительные `/media-proxy/<ключ>` — `mediaProxyUrl` в proxy-режиме;
* Vercel — `vercel.json` рерайт `/media-proxy/:path*` → `https://${R2_PUBLIC_URL}/:path*`;
* Cloudflare — `src/proxy.ts` сам забирает объект у R2 (GET/HEAD, Range);
* `next/image` оставлен на абсолютных R2-URL: браузер их не видит (оптимизатор
  фетчит источник на сервере), а относительные пути оптимизатор отклоняет
  (`INVALID_IMAGE_OPTIMIZE_REQUEST`), поэтому `NEXT_PUBLIC_MEDIA_CDN_URL`
  обязателен для сборки на обеих платформах.

Обязательные переменные окружения для сборки/рантайма:

| Платформа | Переменная | Значение |
| --- | --- | --- |
| Vercel (build) | `NEXT_PUBLIC_MEDIA_CDN_URL` | `https://pub-…r2.dev` (абсолютные src для оптимизатора) |
| Vercel (build) | `NEXT_PUBLIC_MEDIA_PROXY_ORIGIN` | `true` |
| Vercel (server) | `R2_PUBLIC_URL` | `https://pub-…r2.dev` (текущий бакет) |
| Cloudflare (build) | `NEXT_PUBLIC_MEDIA_CDN_URL` | `https://pub-…r2.dev` (уже в `wrangler.jsonc`) |
| Cloudflare (build) | `NEXT_PUBLIC_MEDIA_PROXY_ORIGIN` | `true` (уже в `wrangler.jsonc`) |
| Cloudflare (runtime) | `R2_PUBLIC_URL` | `https://pub-…r2.dev` (уже в `wrangler.jsonc`) |

Путь `/media-proxy/<ключ>` маппится на ключ R2 1:1, включая seed-префикс `media/`.
В dev (без флага `NEXT_PUBLIC_MEDIA_PROXY_ORIGIN`) и видео, и картинки ходят на
R2 напрямую — у локального сервера нет ни ревайта, ни edge-прокси.

## Контент из админки: ссылки подвала и города

Ссылки подвала и гео-страницы управляются из админки, как и остальные ресурсы:

* **Ссылки подвала** — ресурс `footer-links` (`/admin/footer-links`). Набор
  колонок, порядок, адреса и флаг модуля — данные; тексты ссылок остаются
  ключами i18n (`labelKey`, пример `footer.about`), так что переводы живут там
  же, где у всего остального интерфейса. Пустая таблица откатывается на
  статический `footerNavGroups` из `navigation.ts` — первый деплой не бывает
  без подвала. Изменения видны через `revalidate` (тег `content:footer`).
* **Города и районы** — ресурсы `cities` и `districts` (`/admin/cities`,
  `/admin/districts`). Публичные страницы `/cities`, `/cities/[city]`,
  `/cities/[city]/[district]` читают город и районы из БД (тег `geo:cities`),
  координаты известных городов — из `domain/geo`, вновь добавленных — из формы.
  Пустая таблица откатывается на статический список.

Миграции применяются обычным `prisma migrate deploy`. Города и ссылки подвала на
проде заводят в админке: пока таблицы пусты, работают статические списки.
