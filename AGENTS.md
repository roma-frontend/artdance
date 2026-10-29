<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Загрузка медиа (upload contract)

- Маршрут: `POST /api/media/upload` (multipart). Первой строкой `requireCapability('media.upload')`, затем `checkRateLimit('mediaUpload')` (30 запросов за 600 с, `src/config/business.ts`).
- Политики по ролям: `uploadPolicies` в `src/config/security.ts`. Тип, размер и расширение проверяет `validateUpload` (`src/lib/security/uploads.ts`) до разбора содержимого. Видео как роль изображения отклоняется заранее: sharp его не читает.
- Разбор: `processImage` (`src/lib/media/ingest.ts`) делает ре-энкод (EXIF снимается), отклоняет анимацию, кодирует в форматы из `mediaProcessing.outputFormats` и пресета роли.
- Ключи: `mediaPaths.<роль>(ownerId, fileId)` + расширение мастера. Варианты: `variantKey` (`src/config/media-processing.ts`), вид `<base>-<width>.<format>`.
- Одиночные роли: upsert по владельцу среди живых строк (`deletedAt: null`); корзинная строка удерживает уникальный слот.
- Приватные документы — только `putPrivateObject` (`R2_PRIVATE_BUCKET`). `putMediaObject` пишет в публичный бакет. Вложения поддержки сейчас пишутся через `putMediaObject`: известное расхождение, решение владельца не принято.
- Доставка: `/media-proxy/<ключ>` (`src/proxy.ts`) без проверки доступа; прямой R2 URL — через `mediaUrl`.
- Чтение: `mediaSelect`, `toMediaRef`, `firstMediaRef`, `galleryRefs` (`src/server/queries/media.ts`). Одиночные связи — `liveSingleMedia`; to-one связи не принимают `where`.
- Тесты: `src/app/api/media/upload/route.test.ts`, `src/lib/security/uploads.test.ts`, `src/config/media-processing.test.ts`, `src/server/queries/media.test.ts`.
