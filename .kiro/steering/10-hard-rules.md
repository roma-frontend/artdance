# Жёсткие правила

Главное правило: **в коде нет абсолютных значений и текстов.** Всё объявлено
в своём месте. Это не про стиль — это про стоимость изменений: «поменяйте окно
отмены с 24 на 12 часов» должно быть одной строкой, а не поиском по проекту.

Нарушения ниже — ошибки ESLint, а не замечания на ревью.

| Нельзя | Надо |
|---|---|
| `style={{ color: '#8B1A2B' }}` | `className="text-accent"` |
| `<h2>Найдите свой танец</h2>` | `<h2>{t('discover.title')}</h2>` |
| `href="/instructors/anna"` | `href={routes.instructor(slug)}` |
| `import Link from 'next/link'` | `import { Link } from '@/i18n/routing'` |
| `process.env.RESEND_API_KEY` | `getServerEnv().RESEND_API_KEY` |
| `if (hoursUntil < 24)` | `if (hoursUntil < booking.freeCancellationHours)` |
| `price * 0.15` | `splitCommission(price, 'CLASS_BOOKING')` |
| `revalidateTag('instructors')` | `revalidateTag(cacheTags.instructors())` |
| `<img>` / прямой `next/image` | `<Media preset="instructorCard" />` |
| импорт `design/tokens/primitives` | семантический токен или Tailwind-утилита |

Литералы легальны только в: `src/config/**`, `src/design/tokens/**`, `src/i18n/**`,
`src/domain/enums.ts`, `scripts/**`, `prisma/**`. Там они и есть содержимое.

## Тексты

Ключ добавляется в `src/i18n/messages/en.ts` (эталон структуры) — TypeScript сразу
покажет отсутствие ключа в `ru.ts` и `hy.ts`. Ключи описывают смысл:
`cta.bookNow`, не `cta.redButton`.

Числа и даты не вставляются в строку — только через плейсхолдеры и `formats`:

```ts
t('common.counts.spotsLeft', { count: 8 })   // «осталось 8 мест»
format.number(price, 'price')                // «12 000 ֏»
format.dateTime(startsAt, 'bookingStamp')    // «сб, 7 сент., 18:00»
```

## Деньги

- Целые драмы (`type Money = number`). `money()` бросает на нецелом значении.
- Округление только через функции `src/domain/money.ts`. Скидка на заказ
  распределяется `distributeProportionally()` — сумма частей равна целому.
- Ставки комиссии и НДС **пишутся в БД в момент операции**
  (`Booking.lateCancellationRate`, `Order.vatRate`). Изменение конфига не должно
  переписывать историю: спор решается по зафиксированным условиям.

## Авторизация

- Каждый `'use server'` экспорт — публичный HTTP-эндпоинт. Первая строка —
  гвард из `@/lib/auth/guards`.
- Личность только из серверной сессии. `userId` в аргументах — это пожелание
  клиента, не идентификация.
- `proxy.ts` только перенаправляет неаутентифицированных. Cookie можно подделать.

## Платежи и бронирование

- Только через `getPaymentProvider()`. Импорт конкретного адаптера в
  бизнес-логике — ошибка ревью.
- **Redirect клиента не является доказательством оплаты.** Бронь подтверждается
  после `getPayment()` или проверенного webhook.
- Каждый webhook пишется в `WebhookEvent` с уникальным `(provider, eventId)`.
- Слот удерживается через `SlotHold`; гонку решает уникальный индекс в БД,
  а не код приложения.
- Доступность слотов не кешируется (`dataRevalidate.availability = 0`):
  устаревший ответ означает двойную бронь.

## Кеш

Приватный маршрут обязан попасть в `privatePaths` (`src/config/cache.ts`) и
получить `no-store`. Ошибка в эту сторону — выдача чужого заказа из CDN.
В `headers()` приватные правила идут ПЕРЕД каталогом: Next применяет первое
совпадение.

## Перед завершением задачи

```
npm run verify
```

Токены, переводы, типы, линтер, тесты. Тесты обязательны для денежных расчётов,
правил бронирования, комиссий, возвратов и парсинга webhook.
