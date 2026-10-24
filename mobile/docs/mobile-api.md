# API веба для мобильного клиента

Что мобильное приложение может вызывать у веба, как устроена авторизация и чего не хватает.
Описание построено по коду `src/app/api/**` и `src/lib/auth/guards.ts` в корне репозитория.

## Авторизация

- Вход: `POST /api/auth/sign-in/email` и `POST /api/auth/sign-up/email` (Better Auth).
  Ответ содержит заголовок `set-auth-token`, его мобильное приложение сохраняет в
  `expo-secure-store` (`src/lib/session.ts`) и отправляет как `Authorization: Bearer`.
- Текущий пользователь: `GET /api/auth/get-session`. Выход: `POST /api/auth/sign-out`.
- На сервере личность берётся только из сессии (`getCaller`), аргумент `userId` клиента не
  принимается. Заблокированный пользователь (`isActive: false`) теряет доступ сразу.
- Анонимная корзина и бронь с холда передают id заголовком `x-anonymous-id`
  (формат: `[A-Za-z0-9_-]{8,64}`).

Bearer-токен проверен на живом стенде: вход демо-клиентом выдаёт `set-auth-token`, а запросы
к `/api/account/*` с этим токеном отвечают 200, без токена и с неверным токеном — 401.

## Группы маршрутов

| Маршрут | Методы | Доступ |
|---|---|---|
| `/api/catalog/[section]`, `/api/catalog/[section]/[slug]` | GET | публичный, `?q=&sort=&page=&pageSize=`; `q` ищет во всех разделах |
| `/api/content/faq` | GET | публичный, `?locale=`, без кэша |
| `/api/content/help` | GET | публичный, `?locale=`, без кэша |
| `/api/content/about` | GET | публичный, `?locale=`, без кэша |
| `/api/content/gift-cards` | GET | `?locale=`, без кэша; `FEATURE_DISABLED`, если выключен `shop` |
| `/api/content/pricing` | GET | `?locale=`, без кэша; разделы `plans` и `classPasses` отдаются `null`, если выключены модули |
| `/api/content/become-instructor` | GET | публичный, `?locale=`, без кэша |
| `/api/content/list-your-studio` | GET | публичный, `?locale=`, без кэша |
| `/api/content/legal` | GET | публичный, `?locale=`, без кэша |
| `/api/content/legal/[slug]` | GET | публичный, `?locale=`, без кэша; `NOT_FOUND` для неизвестного слага |
| `/api/content/blog` | GET | публичный, `?locale=&category=&q=`, без кэша; только опубликованные статьи |
| `/api/content/blog/[slug]` | GET | публичный, `?locale=`, без кэша; `NOT_FOUND` для неизвестного или неопубликованного слага |
| `/api/content/contact` | GET | публичный, `?locale=`, без кэша |
| `/api/contact` | POST | публичный, лимит `contactForm`, капча; `{ delivered }`, `VALIDATION_FAILED` с `field`, `CAPTCHA_FAILED` (422) |
| `/api/search` | GET | публичный, лимит частоты |
| `/api/booking` | POST | сессия или `anonymousId` |
| `/api/booking/hold` | POST | сессия или `anonymousId` |
| `/api/booking/[id]/cancel`, `/reschedule`, `/pay` | POST | сессия |
| `/api/booking/recurring` | POST | сессия |
| `/api/booking/pass/verify`, `/pass/[id]/qr` | GET/POST | владелец абонемента |
| `/api/cart` | GET, POST, PATCH, DELETE, PUT | сессия или `anonymousId` |
| `/api/cart/variant-id` | GET | публичный |
| `/api/favorites` | GET | сессия, ключи избранного; запись только через server action, HTTP-маршрута нет |
| `/api/waitlist`, `/api/waitlist/claim` | POST | сессия |
| `/api/payments/intent`, `/api/payments/reconcile` | POST | сессия |
| `/api/account/export`, `/api/account/delete` | GET, POST | сессия |
| `/api/account/bookings` | GET | сессия, только свои брони (до 50) |
| `/api/account/orders` | GET | сессия, только свои заказы (до 50) |
| `/api/account/favorites` | GET, POST | сессия, плоский список с видом записи; POST переключает избранное `{ target, slug }` → `{ isFavorite }`, лимит `search` |
| `/api/account/subscription` | GET | сессия, тумблер `subscriptions` (иначе `FEATURE_DISABLED`) |
| `/api/account/wallet` | GET | сессия, тумблер `wallet` (иначе `FEATURE_DISABLED`) |
| `/api/account/referrals` | GET | сессия, тумблер `referrals`; код заводится при первом запросе |
| `/api/media/upload` | POST | сессия, роль по правилам загрузки |
| `/api/account/bookings/[id]` | GET | сессия, только своя бронь |
| `/api/account/orders/[orderNumber]` | GET | сессия, только свой заказ |
| `/api/account/dancer-profile` | GET, PUT | сессия; PUT ограничен лимитом `dancerProfile` |
| `/api/account/notifications` | GET, PUT | сессия; PUT ограничен лимитом `notificationPrefs` |
| `/api/account/reviews` | POST | сессия, лимит `reviewSubmit` |
| `/api/account/password/forgot` | POST | лимит `passwordReset`, капча (`assertCaptcha`) |
| `/api/account/password/reset` | POST | лимит `passwordReset` |
| `/api/booking/sessions` | GET | лимит `availability`; сессия читается, если передана |
| `/api/content/cities` | GET | публичный |
| `/api/content/styles`, `/api/content/styles/[slug]` | GET | публичный |
| `/api/events/[slug]/register` | POST | сессия читается, лимит `contactForm` |
| `/api/gift-cards/redeem` | POST | лимит `contactForm` |
| `/api/instructor-applications` | POST | лимит `contactForm` |
| `/api/studio/availability` | GET, POST | роль `INSTRUCTOR`; POST — операции расписания (`op`) |
| `/api/ics/[bookingId]` | GET | владелец брони |
| `/api/availability` | GET | публичный, лимит частоты |
| `/api/entitlements` | GET | сессия |
| `/api/saved-searches` | GET, POST, DELETE | сессия |
| `/api/admin/**`, `/api/webhooks/**`, `/api/cron/**`, `/api/telegram/**` | — | **не для мобильного клиента** |

Административные маршруты и вебхуки клиенту не предназначены: админка требует
capability-проверки (`requireCapability`), вебхуки подписаны провайдером, cron — секрет.

## Формат ошибок

Доменные ошибки возвращаются как:

```json
{ "error": "VALIDATION_FAILED", "messageKey": "validation.required", "params": {}, "field": "holdId" }
```

Коды HTTP задаёт `httpStatusFor(code)` из `src/domain/errors.ts`. Лимит частоты даёт `429`
с `RATE_LIMITED` и `params.seconds`. Текст для пользователя берётся из словарей по
`messageKey`, а не из сервера: мобильное приложение должно переводить ключи своими строками
или запросить словарь, иначе в интерфейсе окажется ключ вместо текста.

## Формы успешных ответов

Успешный ответ — JSON-объект, данные лежат под ключом сущности. В проверенных маршрутах массивов верхнего уровня нет.

| Маршрут | Ответ |
|---|---|
| `GET /api/account/bookings` | `{ bookings: [...] }` |
| `GET /api/account/bookings/[id]` | `{ booking }` |
| `GET /api/account/orders` | `{ orders: [...] }` |
| `POST /api/account/orders` | `{ order: { id, orderNumber, total } }`, 201 |
| `GET /api/account/orders/[orderNumber]` | объект заказа без обёртки (см. маршрут) |
| `GET /api/account/favorites` | `{ items }` |
| `POST /api/account/favorites` | `{ isFavorite }` |
| `GET /api/favorites` | `{ keys }` |
| `POST /api/booking` | `{ booking: { id, reference, totalPrice, startsAt, endsAt } }`, 201 |
| `POST /api/booking/hold` | `{ hold: { id, startsAt, endsAt, expiresAt, extensions, ttlMinutes } }`, 201 |
| продление брони-холда (`/api/booking/hold`) | `{ hold: { id, startsAt, endsAt, expiresAt, extensions } }`, 200 |
| `POST /api/booking/[id]/cancel` | `{ booking, fee, refund, outcome, credited }` |
| `POST /api/booking/[id]/reschedule` | `{ booking, priceDifference, remaining, durationMinutes }` |
| `POST /api/waitlist/claim` | `{ hold: { id, expiresAt } }`, 201 |
| `/api/cart` (все методы) | `{ snapshot }` |
| `GET /api/content/cities` | `{ cities }` |
| `GET /api/saved-searches` | `{ items }`; создание возвращает запись, 201 |
| `POST /api/account/password/forgot` | `{ sent: true }` |
| `/api/account/delete` | `{ ok: true, deletionRequestedAt, graceDays }` или `{ ok: true, cancelled: true }` |
| `POST /api/booking/pass/verify` | `{ ok: true, ... }` или `{ ok: false, reason }` |

Ошибки в этих маршрутах идут в формате из раздела «Формат ошибок», кроме `{ ok: false, reason }` у проверки пропуска. Ключ `snapshot` означает корзину, `booking` — одну бронь, `bookings` и `orders` — списки. Тело ответа 429 содержит `params.seconds`.

## Что мобильному клиенту пока не хватает

1. **Словари ошибок.** Сервер отдаёт `messageKey`, а не текст. Перевод по словарю приложения делает
   `readServerMessage` (`src/lib/server-message.ts`). Подключено к выгрузке данных, экранам подписки,
   кошелька, рефералов, бронирований, избранного, заказов, корзине, бронированию и пропуску, карточке
   каталога (избранное и корзина), обращению через контакт, блогу, подарочным картам, тарифам,
   лендингам для инструкторов и владельцев площадок. Регистрация сопоставляет код better-auth
   `USER_ALREADY_EXISTS*` с текстом занятого адреса. Загрузка списка каталога и страницы FAQ, помощи,
   «о нас», юридических документов общая: маршруты не отдают `messageKey` при ошибке.
2. **Проверка bearer-токена.** Подтверждена живым тестом (см. выше), отдельного пункта нет.
3. **Единый контракт ответов.** Формы описаны выше. Часть маршрутов не отдаёт `messageKey` при ошибке: `/api/payments/reconcile`, `/api/booking/pass/*`, `/api/saved-searches`, `/api/cart/variant-id`, `/api/account/orders/[orderNumber]`; в `/api/booking/recurring` — только для доменных ошибок.
4. **Кабинет клиента в приложении.** Экраны есть для броней, заказов, избранного, подписки,
   кошелька и рефералов. Избранное можно добавлять и убирать (POST `/api/account/favorites`),
   в карточке каталога есть сердечко. Строка «Мои данные» открывает веб-страницу `/account/data`
   (экспорт и удаление). Билет с QR открывается из списка броней (`GET /api/booking/pass/{id}/qr`); у отменённой брони QR скрыт.
   Расписание (`app/schedule.tsx`) берёт `/api/catalog/classes?sort=newest&pageSize=20`, как веб.
   Аренда площадок на вебе выключена («скоро»), в приложении её нет.
   Лендинги (соревнования, социальные танцы, атлеты, федерации, партнёры, спонсорство, реклама,
   корпоратив) открываются в браузере из кабинета.
   Отзывы (`POST /api/account/reviews`) и уведомления (`/api/account/notifications`) подключены.
   Админка в приложение не переносится.
5. **Оплата.** После оплаты приложение открывает ссылку провайдера в браузере и предлагает
   перейти к броням. Статус оплаты в приложении не подтверждается: его выставляет вебхук или
   reconcile. При возврате приложения на передний план (`AppState` → `active`) заказы, брони и
   корзина перезагружаются (`useAppActive`). Запросы оплаты передают `fromApp: true`: страница результата получает `?app=1` и показывает кнопку `artdance://account/bookings` или `artdance://account/orders/{номер}`.
6. **Ошибки входа.** `INVALID_EMAIL_OR_PASSWORD` (или 401) показывается как «неверный email
   или пароль», `ACCOUNT_LOCKED` как блокировка, остальное как общая ошибка.
7. **Промокод в корзине.** `POST /api/cart` с неверным кодом отвечает `VALIDATION_FAILED` и
   статусом 422 (на этом пути `PROMO_INVALID` не используется). Клиент проверяет `CartError.status === 422`
   и показывает текст под полем. Остальные ошибки идут в общий алерт. Алерт на вебе не работает,
   поэтому ожидаемые ошибки показываются inline.
8. **Сброс пароля и капча.** `POST /api/account/password/forgot` на проде требует Turnstile-токен
   (при заданном `TURNSTILE_SECRET_KEY`), иначе `CAPTCHA_FAILED` (422). В приложении нет виджета
   Turnstile, капчу в обход сервера не отключаем. При `CAPTCHA_FAILED` экран показывает
   сообщение и кнопку «Открыть на сайте», которая открывает веб-страницу `/forgot-password`.
   В dev без секрета запрос проходит и возвращает `{ sent: true }`.
   Так же устроен `POST /api/contact`: при `CAPTCHA_FAILED` экран контактов показывает адрес поддержки и кнопку «Открыть на сайте» (`/contact`).

## Что НЕ переносим в приложение

- Расчёт комиссий, выплат, минимальных сборов, ранжирование (`src/domain/money.ts` в части
  комиссий, `src/domain/ranking.ts`). Порядок выдачи и доли исполнителей решает сервер.
- Проверку доступности, удержание мест и списание абонемента (`src/server/booking/**`).
- Проверку ролей и capability (`src/lib/auth/capabilities.ts`).

Приложение показывает результат этих операций и отображает ошибки, но не решает сам.
