# Каталог компонентов сверх макета

`src/design/component-manifest.ts` описывает блоки, которые есть в утверждённом
прототипе. Их 38, и ими нельзя собрать продукт: в макете нет ни одной формы, ни
одной таблицы, ни одного диалога, ни одного состояния загрузки.

Здесь — остальное. Для каждого компонента зафиксированы путь, роль, обязательные
состояния и то, откуда он берёт значения. Ни один не придумывает свои цвета,
отступы, тексты и лимиты.

**Правило переноса.** Когда начинается волна, компонент из этого документа
добавляется в `component-manifest.ts` со своим `wave` — иначе
`npm run design:status` его не увидит, и готовность будет считаться неверно.

---

## 1. Формы

Формы — самая большая дыра между макетом и продуктом. Их в прототипе три
(поиск, рассылка, промокод), а в продукте — больше тридцати.

| Компонент | Путь (`src/`) | Состояния | Берёт из |
|---|---|---|---|
| `FormField` | `components/form/form-field.tsx` | `idle`, `invalid`, `disabled`, `required` | `validation.*` |
| `FieldError` | `components/form/field-error.tsx` | — | `validation.*`, `errors.*` |
| `Input` | `components/ui/input.tsx` | `default`, `focus`, `invalid`, `disabled`, `readonly`, `with-prefix` | токены `radius`, `border` |
| `Textarea` | `components/ui/textarea.tsx` | + `counter`, `over-limit` | `limits.text.*` |
| `Select`, `Combobox` | `components/ui/select.tsx`, `combobox.tsx` | `closed`, `open`, `searching`, `empty`, `selected`, `multi` | `danceStyles`, `levels` |
| `Checkbox`, `RadioGroup`, `Switch` | `components/ui/*.tsx` | `off`, `on`, `indeterminate`, `disabled`, `invalid` | — |
| `PhoneInput` | `components/form/phone-input.tsx` | `empty`, `partial`, `valid`, `invalid` | `site.phoneCountryCode`, `lib/phone.ts` |
| `OtpInput` | `components/form/otp-input.tsx` | `empty`, `filling`, `verifying`, `wrong`, `expired`, `cooldown` | `security.otp` |
| `PasswordField` | `components/form/password-field.tsx` | + `strength`, `breached`, `visible` | `security.password` |
| `DatePicker`, `DateRangePicker` | `components/form/date-picker.tsx` | `empty`, `selected`, `range`, `disabled-date`, `beyond-horizon` | `booking.maxAdvanceDays`, `localeMeta.firstDayOfWeek` |
| `RatingInput` | `components/form/rating-input.tsx` | `empty`, `hover`, `selected`, `submitting` | `reviews.minRating/maxRating` |
| `PhotoUploader` | `components/form/photo-uploader.tsx` | `idle`, `dragover`, `uploading`, `done`, `too-large`, `wrong-type`, `limit-reached` | `limits.upload.*`, `lib/security/uploads.ts` |
| `AddressPicker` | `components/form/address-picker.tsx` | `empty`, `district-selected`, `pin-placed`, `out-of-radius` | `domain/geo.ts`, `booking.travelRadiusKm` |
| `ConsentCheckbox` | `components/form/consent-checkbox.tsx` | `unchecked`, `checked`, `required-error`, `minor-requires-guardian` | `config/legal.ts` |
| `FormActions` | `components/form/form-actions.tsx` | `idle`, `submitting`, `saved`, `error`, `dirty` | `common.actions` |

### Контракт формы

Одна схема Zod на форму, один источник текстов ошибок, одна точка отправки.

```ts
// components/form/form-field.tsx
interface FormFieldProps {
  name: string;
  /** Ключ i18n, не текст. */
  labelKey: string;
  hintKey?: string;
  required?: boolean;
  children: ReactNode;
}
```

Правила:

- сообщение об ошибке приходит из `validation.*` по коду Zod-ошибки, а не
  задаётся в схеме строкой: одна схема обслуживает три языка;
- `aria-invalid` и `aria-describedby` навешивает `FormField`, а не поле — иначе
  их забудут в половине форм;
- сабмит блокируется на время отправки самим `FormActions`, дважды отправленная
  форма не должна создавать две брони;
- ошибка сервера рендерится в том же `FieldError`, что и клиентская, по имени
  поля из ответа.

---

## 2. Данные и таблицы

Нужны для админки и кабинетов (фазы 6–7). В макете отсутствуют полностью.

| Компонент | Путь | Состояния | Заметки |
|---|---|---|---|
| `DataTable` | `components/data/data-table.tsx` | `loading`, `rows`, `empty`, `error`, `selection`, `bulk-action-pending` | Сортировка и фильтры в URL. Sticky-заголовок, выбор строк, видимость колонок, компактный режим |
| `BulkActionBar` | `components/data/bulk-action-bar.tsx` | `hidden`, `visible`, `confirming`, `blocked-by-guardrail` | Лимит из `security.guardrails.maxBulkActionItems`; действия из `approvalRequiredActions` требуют второго админа |
| `Pagination` | `components/data/pagination.tsx` | `first`, `middle`, `last`, `single` | `limits.pagination` |
| `LoadMore` | `components/data/load-more.tsx` | `idle`, `loading`, `end` | Курсорная, `infiniteScrollBatch` |
| `FilterBar`, `FilterChip`, `AppliedFilters` | `components/data/*` | `collapsed`, `expanded`, `applied`, `cleared` | Состояние в URL: ссылка обязана быть пересылаемой |
| `SortSelect` | `components/data/sort-select.tsx` | — | Варианты из `discover.sort` |
| `Stat`, `StatGrid` | `components/data/stat.tsx` | `value`, `loading`, `no-data`, `trend-up/down` | KPI-кокпит (A-16) |
| `Timeline` | `components/data/timeline.tsx` | `empty`, `items`, `expanded` | История брони, audit log |
| `DiffView` | `components/data/diff-view.tsx` | — | `before`/`after` из `AuditLog` — читаемо, а не JSON |
| `StatusBadge` | `components/data/status-badge.tsx` | по всем enum-статусам | **Единственное место**, где статус превращается в цвет и текст: `BookingStatus`, `OrderStatus`, `PaymentStatus`, `PayoutStatus`, `ModerationStatus` |
| `PriceBreakdown` | `components/data/price-breakdown.tsx` | `customer`, `instructor`, `admin` | В инструкторском виде показывает комиссию и сумму к выплате |
| `ExportButton` | `components/data/export-button.tsx` | `idle`, `preparing`, `ready`, `too-large` | Через `toCsv`, защита от formula injection уже есть |
| `CsvImportDialog` | `components/data/csv-import-dialog.tsx` | `pick`, `mapping`, `preview`, `errors`, `applying`, `done` | Построчные ошибки, ничего не применяется частично |

`StatusBadge` обязателен: как только статус красится по месту, в проекте
появляется пять разных наборов цветов для одного и того же `CANCELLED`.

---

## 3. Навигация, оверлеи, обратная связь

| Компонент | Путь | Состояния | Заметки |
|---|---|---|---|
| `Dialog` | `components/ui/dialog.tsx` | `closed`, `open`, `confirming` | Radix. Ловушка фокуса, `Esc`, возврат фокуса на триггер |
| `Sheet` | `components/ui/sheet.tsx` | `closed`, `open`, `dragging` | Фильтры и бронирование на мобильном |
| `Popover`, `Tooltip`, `DropdownMenu` | `components/ui/*.tsx` | — | Tooltip не несёт критичной информации: на touch его нет |
| `Tabs`, `Accordion` | `components/ui/*.tsx` | — | Accordion — база FAQ (+ JSON-LD) |
| `Toaster` + `useToast` | `components/ui/toaster.tsx` | `success`, `error`, `warning`, `loading`, `action` | `aria-live="polite"`, ошибка — `assertive`. Один провайдер на приложение |
| `ConfirmDialog` | `components/ui/confirm-dialog.tsx` | `idle`, `pending`, `error` | Для необратимых действий: отмена брони, удаление, возврат |
| `Breadcrumbs` | `components/layout/breadcrumbs.tsx` | — | + `BreadcrumbList` JSON-LD |
| `CommandPalette` | `components/layout/command-palette.tsx` | `closed`, `open`, `searching`, `no-results` | `Cmd/Ctrl+K`: публичный поиск и админ-навигация |
| `BottomNav` | `components/layout/bottom-nav.tsx` | `hidden`, `visible`, `active-tab` | Мобильная навигация, safe-area insets, только в PWA-режиме |
| `StickyActionBar` | `components/layout/sticky-action-bar.tsx` | `hidden`, `visible`, `disabled` | «Забронировать» и «В корзину» на мобильном: цена + CTA всегда на экране |
| `AnnouncementBar` | `components/layout/announcement-bar.tsx` | `hidden`, `visible`, `dismissed` | Из `Banner` (CMS-lite), закрытие в cookie |
| `LocaleSwitcher` | `components/layout/locale-switcher.tsx` | — | Сохраняет текущий путь и query, пишет выбор в cookie |
| `CurrencySwitcher` | `components/layout/currency-switcher.tsx` | — | Только отображение; списание всегда в AMD, и это должно быть написано |
| `CookieConsent` | `components/layout/cookie-consent.tsx` | `hidden`, `banner`, `preferences`, `accepted`, `rejected` | Аналитика и карты не загружаются до согласия — иначе баннер бессмысленен |
| `ScrollProgress`, `SectionNav` | `components/layout/*` | — | Длинные страницы: правила, справка, профиль |

---

## 4. Время, деньги, единицы

Место, где чаще всего появляется хардкод, и место, где он дороже всего стоит.

| Компонент | Путь | Заметки |
|---|---|---|
| `DateTimeText` | `components/ui/date-time-text.tsx` | Рендерит `<time datetime>`, формат из `formats`, зона — `site.timeZone`. Прямой `toLocaleString` в компонентах запрещён |
| `RelativeTime` | `components/ui/relative-time.tsx` | «2 часа назад». Считается на клиенте после гидрации, на сервере — абсолютная дата: иначе рассинхрон разметки |
| `CountdownTimer` | `components/ui/countdown-timer.tsx` | Удержание слота (`holdTtlMinutes`), окно листа ожидания, старт события. Состояния: `running`, `warning`, `expired` |
| `Duration` | `components/ui/duration.tsx` | «90 минут» из `durationsMinutes` |
| `CapacityMeter` | `components/ui/capacity-meter.tsx` | Заполненность группы. Цвет по `lowStockThreshold`, текстовая альтернатива обязательна |
| `Money` / `Price` | `components/ui/price.tsx` | Уже в манифесте. Добавить вариант `withConverted` для второй валюты справкой |
| `DiscountTag` | `components/ui/discount-tag.tsx` | Процент или сумма — из `DiscountType`, не из строки |
| `AddToCalendarButton` | `components/ui/add-to-calendar-button.tsx` | `.ics` + ссылки Google/Outlook. Снижает неявки |
| `ShareButton` | `components/ui/share-button.tsx` | Web Share API, фоллбэк — WhatsApp, Telegram, копирование. Основной канал распространения в регионе |
| `QrCode` | `components/ui/qr-code.tsx` | Пропуск на занятие, подарочная карта. Генерация на сервере, токен подписан и короткоживущий |
| `CopyButton` | `components/ui/copy-button.tsx` | Номер заказа, промокод, реферальная ссылка |

---

## 5. Медиа и карты

| Компонент | Путь | Состояния | Заметки |
|---|---|---|---|
| `Gallery` | `components/media/gallery.tsx` | `single`, `grid`, `lightbox-open` | Клавиатура, свайп, счётчик, `Esc` |
| `Lightbox` | `components/media/lightbox.tsx` | `open`, `zoomed`, `loading` | Ловушка фокуса, ссылка на изображение для шаринга |
| `VideoPlayer` | `components/media/video-player.tsx` | `poster`, `loading`, `playing`, `error`, `data-saver` | Постер вместо автозагрузки, без звука по умолчанию, субтитры для курсов |
| `Avatar`, `AvatarGroup` | `components/ui/avatar.tsx` | `image`, `initials`, `verified` | Инициалы как фоллбэк, а не серый силуэт |
| `StaticMapImage` | `components/media/static-map-image.tsx` | — | В листингах — картинка карты, а не JS-карта. Экономит секунду загрузки и деньги на Maps API |
| `MapView` | `components/media/map-view.tsx` | `loading`, `ready`, `no-results`, `denied-geolocation` | Загружается только после клика или согласия; кластеризация пинов |
| `NoiseOverlay` | `components/fx/noise-overlay.tsx` | — | Брендовая зернистость на тёмных секциях. CSS-градиент, не картинка |
| `Reveal` | `components/fx/reveal.tsx` | `hidden`, `revealed`, `reduced-motion` | Появление по `IntersectionObserver`, тайминги из токенов |

---

## 6. Состояния и ошибки

| Компонент | Путь | Заметки |
|---|---|---|
| `EmptyState` | `components/ui/empty-state.tsx` | Уже в манифесте. Нужны варианты: `no-results` (сбросить фильтры), `nothing-yet` (создать), `not-available` (альтернативы) |
| `ErrorState` | `components/ui/error-state.tsx` | Текст из `errors.*`, кнопка «повторить», код инцидента Sentry для поддержки |
| `Skeleton` | `components/ui/skeleton.tsx` | Повторяет геометрию финального блока, иначе после загрузки прыгает вёрстка |
| `SkeletonCard`, `SkeletonList`, `SkeletonTable` | `components/ui/skeleton-*.tsx` | По одному на каждый тип карточки |
| `Spinner` | `components/ui/spinner.tsx` | Только для действий короче секунды, для остального — skeleton |
| `AccessDenied` | `components/ui/access-denied.tsx` | «Не хватает прав» ≠ «не найдено»: разные тексты, разные действия |
| `MaintenanceNotice` | `components/ui/maintenance-notice.tsx` | Платежи недоступны — сказать заранее, а не на шаге оплаты |
| `SlotConflictNotice` | `components/booking/slot-conflict-notice.tsx` | «Слот только что заняли» + 3 альтернативы. Самая частая ошибка в бронировании, и она должна быть не тупиком |

---

## 7. Продуктовые блоки под фичи из бэклога

| Компонент | Для чего | Фича |
|---|---|---|
| `WeekTimetable` | Недельная сетка расписания города | A-02 |
| `WeekStrip` | Мобильный выбор дня полосой | A-02 |
| `PassBalanceCard` | Остаток занятий в пакете, срок действия | B-01 |
| `RecurringPicker` | «Каждый вторник, 8 недель» + предпросмотр всех дат и конфликтов | B-02 |
| `WalletBalance`, `WalletHistory` | Баланс и книга операций | B-03, B-04 |
| `ReferralPanel` | Ссылка, приглашённые, начисления | B-05 |
| `CheckInScanner` | Сканер QR, офлайн-очередь на плохой связи | A-07 |
| `PlanComparisonTable` | Сравнение тарифов, `highlighted`, годовая скидка | `/pricing` |
| `FaqAccordion` | + `FAQPage` JSON-LD | `/faq` |
| `TrustSignals` | Верификация, число броней, скорость ответа, «топ-рейтинг» | D-02, D-07 |
| `ContactRevealGate` | Контакты только после оплаты, с объяснением почему | D-01 |
| `ApplicationWizard` | Многошаговая заявка исполнителя с сохранением черновика | A-15 |
| `DisputeThread` | Переписка по спору с вложениями | D-08 |
| `ContentBlockRenderer` | Рендер блоков главной из админки по типу блока | A-17 |
| `PrintLayout` | Счёт и пропуск: печатные стили, без навигации | A-13 |

---

## 8. Пять контрактов, которые стоит зафиксировать сразу

Эти компоненты используются десятками мест. Переделывать их потом дорого.

```ts
// 1. Единственная точка форматирования статуса.
type StatusKind = 'booking' | 'order' | 'payment' | 'payout' | 'moderation';
interface StatusBadgeProps { kind: StatusKind; value: string }
// цвет берётся из карты kind→value→BadgeVariant, текст — из i18n status.*

// 2. Таблица: сортировка и страница живут в URL, не в состоянии.
interface DataTableProps<T> {
  rows: readonly T[];
  columns: readonly ColumnDef<T>[];
  total: number;
  emptyStateKey: string;
  selection?: { selected: readonly string[]; onChange(ids: readonly string[]): void };
  bulkActions?: readonly BulkAction[];   // проверяются против capabilities
  density?: 'comfortable' | 'compact';
}

// 3. Тост: без свободного текста.
interface ToastInput {
  variant: 'success' | 'error' | 'warning' | 'info';
  messageKey: string;
  values?: Record<string, string | number>;
  action?: { labelKey: string; onClick(): void };
}

// 4. Обратный отсчёт: считает сервер, отображает клиент.
interface CountdownTimerProps {
  expiresAt: string;              // ISO из ответа сервера
  warningAtSeconds?: number;
  onExpire?(): void;              // освободить слот и вернуть к выбору времени
}

// 5. Загрузка файлов: тип решает лимиты, компонент их не знает.
interface PhotoUploaderProps {
  kind: 'avatar' | 'instructorGallery' | 'venueGallery' | 'productImage' | 'document';
  max?: number;
  onUploaded(assets: readonly UploadedAsset[]): void;
}
```

---

## 9. Оценка

| Группа | Компонентов | Часы |
|---|---:|---:|
| Формы | 15 | 46 |
| Данные и таблицы | 13 | 54 |
| Навигация и оверлеи | 15 | 40 |
| Время, деньги, единицы | 11 | 26 |
| Медиа и карты | 8 | 32 |
| Состояния и ошибки | 8 | 18 |
| Продуктовые блоки | 15 | по фичам из `07-feature-backlog.md` |
| | **85** | **216** |

216 часов — это компоненты фаз 1, 2, 6 и 7 в сумме, а не дополнительная работа
сверх сметы: без них перечисленные фазы не собираются. Документ нужен, чтобы эти
часы не выяснились в середине фазы 6.
