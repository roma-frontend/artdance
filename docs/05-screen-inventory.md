# Карта экранов

Что и в каком файле создавать, какие данные нужны, какая политика кеша.
Компоненты каждого экрана — в `src/design/component-manifest.ts`.

> Страницы, которых нет и в этом списке (SEO-хабы направлений и районов, расписание,
> QR-пропуск, заявка инструктора, CMS-lite, KPI-кокпит и другие) — в
> `docs/07-feature-backlog.md` §1.

Прототип содержит **8 экранов**. Продукту нужно больше: прототип показывает
счастливый путь и не содержит кабинетов, авторизации и админки. Ниже — полный
список; экраны из прототипа помечены «есть в макете».

## Публичная часть

| Маршрут | Файл | Есть в макете | Кеш | Данные |
|---|---|---|---|---|
| `/` | `app/[locale]/page.tsx` | ✅ home | `catalog` 180s | трендовые занятия, топ-инструкторы, площадки, товары, события, отзывы, счётчики |
| `/discover` | `app/[locale]/discover/page.tsx` | ✅ discover | `catalog` | занятия с фильтрами из URL, курсорная пагинация |
| `/classes/[slug]` | `app/[locale]/classes/[slug]/page.tsx` | ✅ class | `catalog` | занятие, инструктор, площадка, ближайшие сессии, отзывы, похожие |
| `/styles` | `app/[locale]/styles/page.tsx` | — | `catalog` | ✅ перечень 18 направлений: плитки тех, где есть занятия, и полный список текстом |
| `/styles/[style]` | `app/[locale]/styles/[style]/page.tsx` | — | `catalog` | ✅ SEO-хаб направления (A-01): описание из i18n, занятия, преподаватели, залы, соседние направления. 18 страниц × 3 локали; в индекс попадают только направления с предложением |
| `/instructors` | `app/[locale]/instructors/page.tsx` | — | `catalog` | инструкторы с фильтрами |
| `/instructors/[slug]` | `app/[locale]/instructors/[slug]/page.tsx` | ✅ instructor | `catalog` | профиль, опыт, тарифы, занятия, доступность, отзывы |
| `/studios` | `app/[locale]/studios/page.tsx` | — | `catalog` | площадки, карта |
| `/studios/[slug]` | `app/[locale]/studios/[slug]/page.tsx` | — | `catalog` | площадка, залы, оснащение, календарь |
| `/events` | `app/[locale]/events/page.tsx` | — | `catalog` | предстоящие события |
| `/events/[slug]` | `app/[locale]/events/[slug]/page.tsx` | — | `catalog` | событие, места, регистрация |
| `/shop` | `app/[locale]/shop/page.tsx` | ✅ shop | `catalog` | товары, категории, фильтры |
| `/shop/[slug]` | `app/[locale]/shop/[slug]/page.tsx` | — | `catalog` | товар, варианты, галерея, остатки |
| `/pricing` | `app/[locale]/pricing/page.tsx` | — | `content` | `orderedSubscriptionPlans` из конфига |
| `/about`, `/contact`, `/faq`, `/help` | соответствующие `page.tsx` | — | `content` | ✅ текст из i18n, числа из бизнес-правил; у `/contact` — server action с капчей |
| `/blog`, `/blog/[slug]` | `app/[locale]/blog/**` | — | `content` | посты. Не сделано: модели записей в схеме нет, публикации — часть CMS-lite (A-17). Ссылка убрана из подвала, пока раздела нет |
| `/become-instructor`, `/list-your-studio` | `app/[locale]/**` | — | `content` | ✅ лендинги привлечения; комиссия, выплаты и окна отмены из `commission` / `payout` / `venue` |
| `/gift-cards` | `app/[locale]/gift-cards/page.tsx` | — | `content` | ✅ номиналы из `promotions.giftCard`; покупка — вместе с магазином (фаза 4) |
| `/legal/*` | `app/[locale]/legal/[slug]/page.tsx` | — | `legal` 24h | ✅ шесть документов из `config/legal.ts`, статус `draft` до проверки юристом (8.2) |

## Бронирование и оформление

Все — `no-store`.

| Маршрут | Файл | Есть в макете | Ключевое |
|---|---|---|---|
| `/instructors/[slug]/book` | `app/[locale]/instructors/[slug]/book/page.tsx` | ✅ booking | календарь, слоты, место, сводка, `SlotHold` |
| `/studios/[slug]/book` | `app/[locale]/studios/[slug]/book/page.tsx` | — | аренда зала, `venue.minRentalMinutes` |
| `/booking/[holdId]/confirm` | `app/[locale]/booking/[holdId]/confirm/page.tsx` | — | подтверждение до оплаты, таймер удержания |
| `/cart` | `app/[locale]/cart/page.tsx` | ✅ cart | позиции, промокод, пересчёт на сервере |
| `/checkout/[step]` | `app/[locale]/checkout/[step]/page.tsx` | ✅ checkout | 4 шага из `checkoutSteps` |
| `/checkout/result/[orderNumber]` | `.../result/[orderNumber]/page.tsx` | — | success / pending / failed |

## Аутентификация

`no-store`, ослабленная CSP на `/sign-in` и `/sign-up`.

`/sign-in` · `/sign-up` · `/forgot-password` · `/reset-password/[token]` ·
`/verify-email/[token]` — ни одного нет в макете. Оформляются в брендовой
типографике: тёмная кинематографичная половина экрана + форма на ivory.

## Кабинеты

| Раздел | Префикс | Роль | Экраны |
|---|---|---|---|
| Клиент | `/account` | CUSTOMER | обзор, брони, заказы, избранное, отзывы, подписка, настройки |
| Инструктор | `/studio` | INSTRUCTOR | дашборд, расписание, доступность, занятия, заявки, доходы, профиль |
| Площадка | `/venue` | VENUE_OWNER | дашборд, залы, календарь, доходы |
| Админ | `/admin` | ADMIN / SUPPORT | заказы, брони, каталог, инструкторы, площадки, пользователи, выплаты, промо, модерация, отчёты, audit log, настройки |

Точные пути — в `src/config/routes.ts`. Ни одного из этих экранов нет в макете:
дизайн кабинетов делается на основе дизайн-системы, отдельным этапом.

## Служебные

| Маршрут | Файл | Готово |
|---|---|---|
| `/api/health` | `app/api/health/route.ts` | ✅ |
| `/api/search` | `app/api/search/route.ts` | ✅ подсказки поиска: лимит частоты, коды ошибок, `no-store` |
| `robots.txt` | `app/robots.ts` | ✅ |
| `sitemap.xml` | `app/sitemap.ts` | ✅ одна запись на страницу с `alternates.languages` |
| `**/opengraph-image` | `app/[locale]/**/opengraph-image.tsx` | ✅ карточки ссылок для соцсетей (A-23). Своя в каждом публичном сегменте: наследования у файлового соглашения нет, покрытие проверяет `sitemap.test.ts`. Кадр пережимается в JPEG (`sharp`), потому что движок отрисовки не читает WebP; шрифты — `src/design/og-fonts/` |
| 404 | `app/[locale]/not-found.tsx` | ✅ |
| Ошибка раздела | `app/[locale]/error.tsx` | ✅ |
| Критическая ошибка | `app/global-error.tsx` | ✅ |
| Загрузочные состояния | `app/[locale]/admin/loading.tsx`, `app/[locale]/account/loading.tsx`, `<Suspense>` в `/discover` | ✅ Скелеты повторяют геометрию финального блока (`SkeletonCard/List/Table`), обратная связь на нажатую ссылку — `LinkPending` через `useLinkStatus`. В корне локали `loading.tsx` НЕ ставится: он обернул бы Suspense'ом статически пререндеренные маршруты, и первым кадром главной стал бы скелет (§2e конвенций) |

---

## Что каждый экран обязан иметь

Прототип показывает только состояние «всё хорошо и данные есть». Продуктовый
экран без этих четырёх состояний не считается готовым:

1. **Загрузка** — `loading.tsx` или `<Suspense>` со skeleton.
2. **Пусто** — `<EmptyState>` с призывом к действию, а не белый экран.
3. **Ошибка** — `error.tsx` раздела, текст из `errors.*`.
4. **Нет доступа** — для приватных: редирект на вход с `redirectTo`.

Плюс на каждой публичной странице:

- `generateMetadata` с title/description из `seo.*` и canonical + hreflang;
- JSON-LD по типу сущности (`seo.structuredData`);
- корректные `sizes` через `<Media preset=...>`;
- `priority` только на LCP-изображении экрана.

## Порядок данных на сервере

```
page.tsx (RSC)
  → server query из src/server/queries/*.ts   ← кеш и теги здесь
  → передача в компоненты как props           ← компоненты не знают про БД
```

Мутации — server actions в `src/server/actions/*.ts`, первая строка — гвард,
затем rate limit, затем Zod-валидация, затем операция, затем `revalidateTag` и
`recordAudit`.
