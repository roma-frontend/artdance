# Stripe Dashboard: настройка для оплаты картой

Документ описывает, что нужно сделать в Stripe Dashboard, чтобы оплата картой (CARD) работала через Stripe Checkout Session.

## 1. Ключи API

Dashboard → Developers → API keys.

- Скопируйте **Secret key** (`sk_live_...` для продакшена, `sk_test_...` для тестов).
- Значение записывается в переменную `STRIPE_SECRET_KEY` в Vercel (Project → Settings → Environment Variables) и в локальный `.env.local`.
- Publishable key (`pk_...`) в текущей интеграции не используется, но `STRIPE_PUBLISHABLE_KEY` есть в `.env.example`.

Секретный ключ не должен попадать в git и в чаты.

## 2. Webhook endpoint

Dashboard → Developers → Webhooks → Add endpoint.

- **Endpoint URL:** `https://<ваш-домен>/api/webhooks/payments/stripe`
  - Пример: `https://artdance.am/api/webhooks/payments/stripe`
  - Для тестов можно использовать Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/payments/stripe`
- **Events to send** (отметьте именно эти события):
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`
  - `checkout.session.expired`
  - `payment_intent.succeeded` (нужно для уже созданных PaymentIntent)
  - `payment_intent.payment_failed` (нужно для уже созданных PaymentIntent)
- Сохраните endpoint. Откройте его → **Signing secret** (`whsec_...`) → скопируйте в `STRIPE_WEBHOOK_SECRET` в Vercel.

Без `STRIPE_WEBHOOK_SECRET` приложение отвечает ошибкой на webhook, и оплата не подтверждается через webhook. Страница результата заказа всё равно проверяет статус через API Stripe (`reconcile`).

## 3. Переменные окружения в Vercel

Проверьте, что заданы:

| Переменная | Значение |
| --- | --- |
| `STRIPE_SECRET_KEY` | Secret key (live или test) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret конкретного endpoint |
| `PAYMENT_PROVIDER` | Провайдер, согласно настройке в `src/config/env.ts` |
| `NEXT_PUBLIC_APP_URL` | Публичный домен сайта (используется для `success_url` и `cancel_url`) |

После изменения переменных сделайте redeploy.

## 4. Настройки аккаунта (Dashboard → Settings)

- **Business details / Public details:** название, адрес, контакты, поддержка. Они показываются на странице Stripe Checkout.
- **Payment methods:** включите карты, которые нужны (Visa, Mastercard). Для Checkout Session используются методы, доступные в аккаунте и для валюты заказа.
- **Currencies:** проверьте, что валюта заказа поддерживается Stripe. Код сейчас передаёт валюту заказа в `price_data.currency`. Если Stripe не принимает `amd`, оплата падает на создании сессии, и нужно решить вопрос с валютой отдельно.
- **Account activation:** в live-режиме аккаунт должен быть активирован (юридические данные, банковский счёт), иначе платежи не проходят.

## 5. Проверка перед запуском

1. В **test mode** создайте заказ с CARD, оплатите тестовой картой `4242 4242 4242 4242` (любая дата в будущем, любой CVC).
2. В Dashboard → Developers → Webhooks → выбранный endpoint → Recent deliveries: события должны иметь статус 2xx.
3. Dashboard → Payments: платёж виден со статусом Succeeded.
4. Страница результата заказа показывает оплачено, статус заказа PAID.
5. Отмена на странице Stripe (кнопка назад) возвращает на страницу результата, заказ остаётся неоплаченным.
6. Повторите в **live mode** с небольшой суммой и отмените возврат (refund) в Dashboard.

## 6. Частые ошибки

- **Signature failed в Recent deliveries:** неверный `STRIPE_WEBHOOK_SECRET` (взят signing secret другого endpoint или test-режима).
- **Ошибка `STRIPE_SECRET_KEY missing` / `STRIPE_WEBHOOK_SECRET / key missing`:** переменная не задана в окружении Vercel.
- **Оплата прошла, заказ не PAID:** проверьте список событий endpoint (нет `checkout.session.completed`) и Recent deliveries.
- **Сессия истекла:** Checkout Session живёт 24 часа по умолчанию; после истечения клиент создаёт новую оплату.
