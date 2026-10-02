-- Один семантический CMS-блок должен существовать на каждой локали.
-- Глобальная уникальность key делала вторую локаль невозможной.
DROP INDEX IF EXISTS "ContentBlock_key_key";

CREATE UNIQUE INDEX "ContentBlock_key_locale_key"
ON "ContentBlock"("key", "locale");
