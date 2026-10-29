-- Таксономия дисциплин (DS-01): DanceSport и Social как верхний уровень над стилями каталога.
--
-- Только добавления: существующие таблицы и колонки не меняются, новые таблицы пусты до вставки
-- справочника ниже. Справочник совпадает с константами src/domain/dancesport.ts: спортивные стили
-- (BALLROOM, LATIN, TANGO) из standardDisciplines и latineDisciplines; социальные (TANGO, BACHATA,
-- SALSA, KIZOMBA и семь «прочих») из socialCoreStyles и socialOtherStyles. При изменении констант
-- нужна новая миграция, а не правка этой.

DO $$ BEGIN
  CREATE TYPE "DanceDisciplineKind" AS ENUM ('DANCESPORT', 'SOCIAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "DanceDiscipline" (
  "id" TEXT NOT NULL,
  "kind" "DanceDisciplineKind" NOT NULL,
  "slug" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DanceDiscipline_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DanceDiscipline_kind_key" ON "DanceDiscipline"("kind");
CREATE UNIQUE INDEX IF NOT EXISTS "DanceDiscipline_slug_key" ON "DanceDiscipline"("slug");

CREATE TABLE IF NOT EXISTS "DanceStyleDiscipline" (
  "style" "DanceStyle" NOT NULL,
  "disciplineId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DanceStyleDiscipline_pkey" PRIMARY KEY ("style", "disciplineId")
);

CREATE INDEX IF NOT EXISTS "DanceStyleDiscipline_disciplineId_idx"
  ON "DanceStyleDiscipline"("disciplineId");

DO $$ BEGIN
  ALTER TABLE "DanceStyleDiscipline"
    ADD CONSTRAINT "DanceStyleDiscipline_disciplineId_fkey"
    FOREIGN KEY ("disciplineId") REFERENCES "DanceDiscipline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "DanceDiscipline" ("id", "kind", "slug", "sortOrder", "updatedAt") VALUES
  ('discipline_dancesport', 'DANCESPORT', 'dancesport', 0, CURRENT_TIMESTAMP),
  ('discipline_social', 'SOCIAL', 'social', 1, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

INSERT INTO "DanceStyleDiscipline" ("style", "disciplineId") VALUES
  ('BALLROOM', 'discipline_dancesport'),
  ('LATIN', 'discipline_dancesport'),
  ('TANGO', 'discipline_dancesport'),
  ('TANGO', 'discipline_social'),
  ('BACHATA', 'discipline_social'),
  ('SALSA', 'discipline_social'),
  ('KIZOMBA', 'discipline_social'),
  ('ARMENIAN_FOLK', 'discipline_social'),
  ('WEDDING_DANCE', 'discipline_social'),
  ('AFRO', 'discipline_social'),
  ('FLAMENCO', 'discipline_social'),
  ('HEELS', 'discipline_social'),
  ('JAZZ', 'discipline_social'),
  ('CONTEMPORARY', 'discipline_social')
ON CONFLICT DO NOTHING;
