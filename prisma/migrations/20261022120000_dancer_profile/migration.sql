-- Профиль танцора: ответы онбординга.
--
-- Инструктору нужно знать, с чего начинать с новым клиентом. Раньше это было
-- негде записать: у пользователя нет ни одного поля об уровне, и профиль
-- приходилось читать из произвольного био (которого чаще всего нет).
--
-- Уровень — обязателен и имеет ровно три значения: «любой уровень» и
-- «профессиональный» в самооценке новичка невозможны, поэтому свой enum,
-- а не переиспользование `SkillLevel` (там уровень задаёт инструктор занятию).

CREATE TYPE "DancerLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateTable
CREATE TABLE "DancerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" "DancerLevel" NOT NULL,
    "styles" "DanceStyle"[] DEFAULT ARRAY[]::"DanceStyle"[],
    "goal" TEXT,
    "note" TEXT,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DancerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DancerProfile_userId_key" ON "DancerProfile"("userId");

-- CreateIndex
CREATE INDEX "DancerProfile_level_idx" ON "DancerProfile"("level");

-- AddForeignKey
ALTER TABLE "DancerProfile" ADD CONSTRAINT "DancerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
