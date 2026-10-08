# План внедрения upload в админке (все сущности — файл, не ссылка)

> Запросил: все что создается в админке должно иметь input для upload (не ссылка из интернета). Логика берется из `Desktop/online-shop` (четкая реализация, много опций). Продолжение — из дома. Файл — единственный источник плана.

## 1. Контекст и цель

- Сейчас `artdance` уже грузит файлами `instructors/venues/rooms/classes/products/events` через `PhotoUploader → POST /api/media/upload (FormData file+kind+altText+ownerId) → validateUpload + sharp(inspect/process) → R2 (AWS SigV4, без SDK) → MediaAsset`.
- Разрывы (текстовый `kind:'text'` вместо загрузки): `BlogPost.coverKey+coverAlt`, `Banner.imageKey`, `Course.coverKey`, `CourseLesson.videoAssetId`, `User.avatarKey` (+ `ProductCategory/Review.photoAssetIds` как строки). `mediaOwners` покрывает только 6 сущностей, `storage.ts: mediaPaths` без путей `blogCover/banner/courseCover/avatar`.
- Цель: все создаваемое в админке получает **upload-input** (single или gallery), строки-URL остаются только как deprecated-зеркало один релиз. Логика бэка/валидации/доставки/тестов переносится из `Desktop/online-shop`.

## 2. Что переносим из online-shop (референс: `C:\Users\namel\Desktop\online-shop`)

- `src/hooks/useUpload.ts` — `useUpload(endpoint)` → `FormData file → fetch → {publicUrl} + uploading`.
- UI-паттерны: **gallery** (`products` — `grid-cols-4` превью, чекбоксы `✓/+`, `✕`, bulk `Select All/Delete Selected/Delete All`, `onDrop/onDragOver/setDragActive`, скрытый `input[type=file] multiple accept="image/*"` + `fileRef.click()`, цикл `for(f of files){await upload(f)}`) и **single-cover** (`categories/brands/promotions` — `border-dashed aspect-video/square` кнопка, preview+`✕`).
- Валидация сервер: `ALLOWED_MIME Set(jpeg/png/webp/avif(+gif admin)) + file.size + !file + R2 env guard` (`src/app/api/upload/route.ts:9,61,65` — `10MB admin`, `review-upload:5MB`), `checkAdminRateLimit 100/60s` vs public `5/60s`.
- Шарп: `rotate().resize({maxDim, fit:inside, withoutEnlargement}).webp({quality effort4})`, GIF passthrough, `try/catch→fallback original`, best-effort thumb `400px q72` sibling `key-thumb`.
- Хранение R2 `S3Client forcePathStyle`, ключи `products/<uuid>` без расширения, `CacheControl immutable`, доставка `/api/r2-image?url=` прокси + `/api/r2-media?key=&url=` с `Range/206/ETag`, `toThumbUrl` rewrite `-thumb`, `buildImageUrl` indirection (обход `402 r2.dev`), нормализация `convex/lib/imageUrl`.
- Orphan GC: `ListObjectsV2 + imageReferences + regex html + whitelist hero/poster + 7д grace + dry-run/apply`.

## 3. Фазы (порядок важен, каждая заканчивается зеленым CI)

### Фаза 1 — Модель (additive-only, CI не падает)

- Расширить `prisma/schema.prisma:1541 MediaAsset` полями `bannerId/blogPostId/courseId/avatarOwnerId String? @relation … @unique где уместно + @@index`, `Course.coverKey`/`Banner.imageKey`/`BlogPost.coverKey` оставить deprecated на 1 релиз (двойное чтение).
- `src/config/media.ts: mediaPaths` добавить `blogCover/banner/courseCover/avatar`, `src/components/admin/media-section.tsx:mediaOwners`, `src/lib/media/storage.ts: storageKeyFor`.
- Проверка: `npx prisma validate && prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` → после `migrate deploy` должен быть 0.

### Фаза 2 — Инфраструктура загрузки

- `src/config/security.ts: uploadPolicies` — `bannerImage/blogCover/courseCover/avatar(2MB)/courseVideo(512MB)` (`maxPerEntity 1` для single, `12` для gallery).
- `src/lib/security/uploads.ts: validateUpload/exceedsDeclaredSize/safeObjectName` — добавить новые `kind`, `maxPerEntity` и `gif` policy (остается `isAnimated→reject` в `ingest.ts`).
- `src/lib/media/storage.ts` — `storageKeyFor` + `putMediaObject` (уже `CORP/CORS`), добавить `buildImageUrl→/api/r2-image` прокси если `R2_PUBLIC_URL=r2.dev`, `src/app/api/media/upload/route.ts:40 ownerFields` → `bannerId/blogPostId/courseId/userId`, оставить `requireCapability('media.upload')` + `checkRateLimit('mediaUpload',30/600)`.

### Фаза 3 — Общие UI-компоненты

- Новый `src/hooks/useUpload.ts` (копия `online-shop:useUpload`, парам. endpoint).
- Новый `src/components/form/file-dropzone.tsx` (режимы `gallery`/`single`, dragActive, `grid` vs `dashed`).
- Модифицировать `src/components/form/photo-uploader.tsx:38` — добавить dragActive, bulk-toolbar, `router.refresh()` после успеха, поддержка новых `kind`.
- Создать `src/components/form/single-image-uploader.tsx` для `kind:'image'` single-полей (обертка над PhotoUploader с `maxPerEntity=1`).

### Фаза 4 — Подключение всех админ-ресурсов

- `src/config/admin.ts:1045 BlogPost: coverKey kind:'text'` → `kind:'image' uploadKind:blogCover owner:blogPostId`; `Banner` добавить в `AdminResource` (сейчас вне админки, `banners/service.ts`); `Course coverKey kind:'image'`; `CourseLesson` добавить `videoAssetId` upload; `User` admin `avatarKey`.
- `src/app/[locale]/admin/[resource]/[id]/page.tsx: ownsMedia(resource)` автоподхват `MediaSection` для gallery; для single-cover — рендер в `AdminForm` по `kind:'image'`. Чтение: сначала `MediaAsset[owner]=id`, fallback на `row.coverKey` строку (как сейчас `src/server/queries/blog.ts:95 boot`).

### Фаза 5 — Тесты и CI-страж

- Расширить `src/lib/security/uploads.test.ts` (новые kinds, `TOO_MANY_FILES` с `1`, `gif` reject), `src/lib/media/ingest.test.ts` (thumb sibling), добавить `src/app/api/media/upload/route.test.ts` (аналог `online-shop/r2-image.test.ts: 401/400/429/413/unsupported/too_many`) и `src/components/form/photo-uploader.test.tsx` (drag-drop, sequential halt on first fail).
- `npm run media:check/video:check/design:check` — считать `blog/banner/course MediaAsset` вместо строкового `storageKey`.

### Фаза 6 — Доставка, GC, доки

- Добавить `src/app/api/r2-image/route.ts` + `src/app/api/r2-media/route.ts` (Range+ETag), `src/lib/thumb.ts:toThumbUrl`, `convex/r2Actions:auditOrphans` для `/admin/cleanup` dry-run, обновить `scripts/optimize-media.ts` для баннеров/блога, доки `docs/09-helpers-catalog.md` + `AGENTS.md` секция upload-contract.

## 4. Риски и инварианты

- `MediaAsset.storageKey @unique` — одна запись на файл, иначе `delete` уносит чужой файл. `storageKey` генерируется `safeObjectName(file.name, randomUUID())` (расширение только, без имени).
- Курсора `public/media` по-прежнему `not in git` (`.gitignore: /public/media/`), артефакты `R2` проверяются `media:check` + `media-r2-manifest`.
- До внедрения 6 сущностей уже покрыты — регрессию ловит `848` юнит-тестов + `npm run typecheck/lint/i18n:check/design:check`.

## 5. Команды для возобновления (из дома)

```bash
git pull
# фаза 1
npx prisma validate
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
# проверки
npm run typecheck && npm test && npm run i18n:check && npm run design:check
```

## 6. Источники

- `artdance`: `prisma/schema.prisma:254,778,1984,2044,1541` · `src/config/admin.ts:1045,1093` · `src/components/admin/media-section.tsx:24` · `src/components/form/photo-uploader.tsx:38` · `src/app/api/media/upload/route.ts:40` · `src/lib/media/storage.ts:48` · `src/lib/media/ingest.ts:44` · `src/lib/security/uploads.ts:20` · `src/server/queries/blog.ts:95`.
- `online-shop`: `src/hooks/useUpload.ts:4` · `src/app/api/upload/route.ts:9,40` · `src/app/api/review-upload/route.ts:16` · `src/lib/optimizeImage.ts:8` · `src/lib/thumb.ts:9` · `convex/r2Actions.ts:46` · `src/app/admin/products/add/page.tsx:88` · `src/app/admin/categories/add/page.tsx:25`.
