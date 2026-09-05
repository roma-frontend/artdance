# Эталон дизайна

`artdance-final.html` — утверждённый прототип из `artdance-deploy`
(**версия 2 сентября 2026**). Скопирован сюда скриптом `npm run design:import`,
чтобы его не искали на рабочем столе и чтобы версия была зафиксирована в
репозитории.

Открывается локально в браузере. Изображения и видео он ищет в `photos/` рядом с
собой, поэтому вне исходной папки медиа не отобразится — это нормально: рабочие
копии лежат в `public/media/seed/` под семантическими именами.

## Что изменилось в версии 02.09.2026

Предыдущая зафиксированная версия — 01.09.2026, 5161 строка. Стало 6005 строк.

| Область | Что изменилось |
|---|---|
| **Hero** | Статичный PNG заменён фоновым видео `dancer-fhd.mp4` (`autoplay muted loop playsinline`) в обёртке шириной 135% с параллаксом. Добавлен «трейл» — до шести затемнённых копий `<video>` поверх основного. Заголовок стал `Move / Different.` с акцентным `<em>`, на экранах шире 1441px фиксируется на 6.5rem |
| **Навигация** | Появились CTA `Book Now` (`.nav-book`) и бургер (`.nav-hamburger`, три полосы → крестик), мобильное меню-панель 280px справа (`.mobile-menu`), затемнение с `backdrop-filter` (`.mobile-overlay`) и кнопка закрытия (`.mobile-close`) |
| **Поиск** | Строка над hero разложена на `.search-pill` и `.search-pill-filters`; чипы сворачиваются по ширине, на 360px строка становится вертикальной |
| **Карусель** | Добавлены кнопки-стрелки (`.scroll-arrow` в `.scroll-arrows`, обёртка `.classes-wrap`), гаснущие на краях списка |
| **Анимации** | Появление секций при скролле: `.reveal`, `.reveal-left`, `.reveal-right`, `.reveal-scale`, поочерёдное `.stagger`. Параллакс изображений в секциях. Свечение под курсором. Полоса прогресса чтения. Удалён `@keyframes pageIn` |
| **Респонсивность** | Точек перелома было 3 (1024 / 768 / 480), стало 5: добавлены `min-width: 1441px` и `max-width: 360px`. Правил было 15, стало около 76. Появились именованные сетки внутренних страниц: `.booking-grid`, `.cart-grid`, `.class-grid` |
| **Переменные** | **Не изменились.** Все 27 CSS-переменных `:root` и обеих тем совпадают с предыдущей версией побайтово — палитра, шрифты, радиусы, `--ease`, `--max-w`, `--pad` те же. Новых переменных не появилось: параметры анимаций заданы литералами в inline-JS |

Что из этого уже отражено в коде:

- 21 новый класс закреплён за компонентами в `src/design/component-manifest.ts`
  (стало 44 компонента вместо 38; добавлены `HeroVideo`, `MobileNavDrawer`,
  `BookingScreen`, `Reveal`, `ScrollProgress`, `PointerGlow`);
- точки перелома `xxs: 360` и `wide: 1441` добавлены в `breakpoint`
  (`src/design/tokens/primitives.ts`), `tokens.css` перегенерирован;
- числа анимаций из inline-JS вынесены в `src/design/motion.ts`;
- политика видео — `videoProcessing` и реестр петель `videoLoopPolicy` в
  `src/config/media-processing.ts`, кодирование — `npm run video:encode`;
- видео учтено в `designVideos` (`design/asset-manifest.ts`) и **сознательно не
  копируется в репозиторий** — см. `docs/00-decision-record.md` §5.

## Что подтверждает эталон

Токены прототипа перенесены в `src/design/tokens/` без расхождений:

| Прототип | Значение | Токен |
|---|---|---|
| `--accent` | `#8b1a2b` | `accent` |
| `--gold` | `#b89a5e` | `metal` |
| `--bg` (light) | `#f6f2ed` | `surface-canvas` |
| `--bg` (dark) | `#0d0b09` | `surface-canvas` (dark) |
| `--card` | `#ffffff` | `surface-card` |
| `--border` | `#e8e2da` | `border-default` |
| `--success` / `--warning` | `#2d7a4f` / `#c4841d` | `success` / `warning` |
| `--ff-display` / `--ff-body` | Playfair Display / DM Sans | `font-display` / `font-sans` |
| `--max-w` | `1320px` | `.page-container` |
| `--ease` | `cubic-bezier(.16,1,.3,1)` | `ease-brand` |
| `--r-sm…xl` | 6 / 10 / 16 / 24px | `rounded-sm…xl` |

Единственное решение, принятое сверх прототипа, — роль электрического красного
`#6E1422` из брендгайда как `signal` (живая доступность, urgency, ошибки).
Обоснование — `docs/02-brand-system.md`.

## Найденные в эталоне дефекты

Не воспроизводить при переносе.

| Дефект | Где | Что делать |
|---|---|---|
| **Видео 21,6 МБ на первом экране** | `hero-loop` | Кодировать по `videoProcessing.heroLoop`: ≤ 1,2 МБ, ≤ 8 с, 1280px, av1/vp9/h264, без звука. Отдавать с CDN |
| **`autoplay` без `poster` и `preload`** | `.hero-video-main` | Постер обязателен, `preload="none"`, автозапуск подавляется при reduced-motion, Save-Data и 2G |
| **Трейл до шести копий `<video>`** | `.hero-ghosts` | До семи потоков 1080p одновременно. Ограничить `ghostTrailMax = 3` и включать от 1024px |
| **Нет кнопки паузы у видео** | hero | WCAG 2.2.2: движение дольше 5 с требует управления |
| **`prefers-reduced-motion` не учтён** | весь макет | Движения стало втрое больше. `reducedMotionDisables` в `src/design/motion.ts` |
| **`min-height: 100vh`** | `.hero` | `100dvh`, иначе первый экран дёргается при появлении адресной строки |
| **`display: … !important`** | `.booking-grid`, `.cart-grid`, `.class-grid` | Перебивание inline-стилей макета. Сетка задаётся один раз |
| **Фильтры исчезают на 360px** | `.search-pill-filters` | `display:none !important` без альтернативы → уводить в `Sheet` |
| Кнопки карусели без имени | `.scroll-arrow` | `aria-label` + `aria-controls` |
| Битая картинка: у `<img>` потерян префикс `photos/` | экран checkout, позиция «Training Apparel Set» | использовать `<Media>`, путь из данных |
| ~~hero — PNG 1,9 MB~~ | `hero-dancer` | ✅ закрыто: 1888 KB → 56 KB WebP, 1672×941. Теперь это **постер** видео и по-прежнему LCP-элемент |
| ~~editorial — PNG 1,5 MB~~ | `editorial-rhythm` | ✅ закрыто: 1469 KB → 38 KB WebP |
| Три файла-дубля в `photos/` | см. `unusedSourceFiles` в манифесте | не переносить |
| Hover-only элементы | `Quick Add`, `♡` | на touch показывать всегда |
| Эмодзи вместо иконок | `🔍 🛒 ♡ 👤 📍 📅 🕐 ⚡ 🔒` | `lucide-react` + `aria-label` |
| Звёзды рейтинга без альтернативы | все карточки | `a11y.ratingStars` |
| Нет пустых, загрузочных и ошибочных состояний | все списки | `EmptyState`, `loading.tsx`, `error.tsx` |
| `--text3` на ivory даёт контраст ниже 4.5:1 | вспомогательный текст | `content-secondary` |

## Структура прототипа

Восемь экранов в одном файле, переключаются функцией `go(id)`:
`home`, `class`, `instructor`, `discover`, `shop`, `booking`, `cart`, `checkout`.
Разбор по секциям и соответствие компонентам — `src/design/component-manifest.ts`.

## Обновление эталона

```
npm run design:import -- --source "путь\к\новой\версии"
```

Скрипт перезапишет HTML и изображения и проверит манифест: неучтённый файл или
пропавший исходник дадут ошибку, а не молча разойдутся с кодом.

После импорта обязателен второй шаг:

```
npm run media:optimize
```

Он пережимает импортированные файлы тем же конвейером, что обрабатывает загрузки
пользователей (`src/lib/media/ingest.ts`), и обновляет
`design/seed-media.generated.ts` — реальные размеры и blur-плейсхолдеры.
`npm run media:check` в составе `verify` не даст закоммитить непережатый файл.
