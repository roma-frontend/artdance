# Эталон дизайна

`artdance-final.html` — утверждённый прототип из `artdance-deploy`
(1 сентября 2026). Скопирован сюда скриптом `npm run design:import`, чтобы его
не искали в `Downloads` и чтобы версия была зафиксирована в репозитории.

Открывается локально в браузере. Изображения он ищет в `photos/` рядом с собой,
поэтому вне исходной папки картинки не отобразятся — это нормально: рабочие копии
лежат в `public/media/seed/` под семантическими именами.

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
`#D6162B` из брендгайда как `signal` (живая доступность, urgency, ошибки).
Обоснование — `docs/02-brand-system.md`.

## Найденные в эталоне дефекты

Не воспроизводить при переносе.

| Дефект | Где | Что делать |
|---|---|---|
| Битая картинка: у `<img>` потерян префикс `photos/` | экран checkout, позиция «Training Apparel Set» | использовать `<Media>`, путь из данных |
| ~~hero — PNG 1,9 MB~~ | `hero-dancer` | ✅ закрыто: 1888 KB → 56 KB WebP, 1672×941 (`npm run media:optimize`) |
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
