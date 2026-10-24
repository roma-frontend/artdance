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
| `/api/catalog/[section]`, `/api/catalog/[section]/[slug]` | GET | публичный |
| `/api/content/faq` | GET | публичный, `?locale=`, без кэша |
| `/api/content/help` | GET | публичный, `?locale=`, без кэша |
| `/api/content/about` | GET | публичный, `?locale=`, без кэша |
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

## Что мобильному клиенту пока не хватает

1. **Словари ошибок.** Сервер отдаёт `messageKey`, а не текст. Нужен либо перевод ключей в
   приложении (армянский и русский), либо поле `message` в ответе.
2. **Проверка bearer-токена.** Не подтверждена живым тестом (см. выше).
3. **Единый контракт ответов.** Часть маршрутов отдаёт `{ snapshot }`, часть `{ booking }`,
   формат удобно документировать в одном месте (сейчас только код).
4. **Кабинет клиента в приложении.** Экраны есть для броней, заказов, избранного, подписки,
   кошелька и рефералов. Избранное можно добавлять и убирать (POST `/api/account/favorites`),
   в карточке каталога есть сердечко. Строка «Мои данные» открывает веб-страницу `/account/data`
   (экспорт и удаление). Не сделаны: отзывы (нет веб-маршрута), уведомления (на вебе заглушка).
   Админка в приложение не переносится.
5. **Оплата.** После оплаты приложение открывает ссылку провайдера в браузере и предлагает
   перейти к броням. Статус оплаты в приложении не подтверждается: его выставляет вебхук или
   reconcile. При возврате приложения на передний план (`AppState` → `active`) заказы, брони и
   корзина перезагружаются (`useAppActive`). Deep link для возврата из браузера не описан.
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

## Что НЕ переносим в приложение

- Расчёт комиссий, выплат, минимальных сборов, ранжирование (`src/domain/money.ts` в части
  комиссий, `src/domain/ranking.ts`). Порядок выдачи и доли исполнителей решает сервер.
- Проверку доступности, удержание мест и списание абонемента (`src/server/booking/**`).
- Проверку ролей и capability (`src/lib/auth/capabilities.ts`).

Приложение показывает результат этих операций и отображает ошибки, но не решает сам.
