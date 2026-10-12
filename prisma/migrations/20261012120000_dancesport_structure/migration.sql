-- DanceSport programs, lesson formats, competition categories and registrations.

DO $$ BEGIN
  CREATE TYPE "DanceSportProgram" AS ENUM ('STANDARD', 'LATINE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DanceSportDiscipline" AS ENUM (
    'SLOW_WALTZ', 'TANGO_STANDARD', 'VIENNESE_WALTZ', 'SLOW_FOXTROT', 'QUICKSTEP',
    'SAMBA', 'CHACHACHA', 'RUMBA', 'PASODOBLE', 'JIVE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LessonType" AS ENUM ('GROUP', 'PRIVATE', 'PAIR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CompetitionRegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "InstructorProfile"
  ADD COLUMN IF NOT EXISTS "danceSportDisciplines" "DanceSportDiscipline"[] NOT NULL DEFAULT ARRAY[]::"DanceSportDiscipline"[];

ALTER TABLE "ClassPass"
  ADD COLUMN IF NOT EXISTS "purchaseKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "ClassPass_purchaseKey_key" ON "ClassPass"("purchaseKey");

ALTER TABLE "PriceOption"
  ADD COLUMN IF NOT EXISTS "lessonType" "LessonType" NOT NULL DEFAULT 'PRIVATE';

ALTER TABLE "DanceClass"
  ADD COLUMN IF NOT EXISTS "danceSportDiscipline" "DanceSportDiscipline",
  ADD COLUMN IF NOT EXISTS "lessonType" "LessonType" NOT NULL DEFAULT 'GROUP';

ALTER TABLE "Course"
  ADD COLUMN IF NOT EXISTS "danceSportDiscipline" "DanceSportDiscipline";

ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "lessonType" "LessonType" NOT NULL DEFAULT 'GROUP';

ALTER TABLE "AthleteProfile"
  ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3);

ALTER TABLE "Event"
  ADD COLUMN IF NOT EXISTS "danceSportDiscipline" "DanceSportDiscipline",
  ADD COLUMN IF NOT EXISTS "federation" TEXT,
  ADD COLUMN IF NOT EXISTS "registrationOpenAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "registrationCloseAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "participationConditions" TEXT;

CREATE TABLE IF NOT EXISTS "CompetitionCategory" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "ageGroup" TEXT NOT NULL,
  "minAge" INTEGER,
  "maxAge" INTEGER,
  "program" "DanceSportProgram" NOT NULL,
  "discipline" "DanceSportDiscipline",
  "conditions" TEXT,
  "entryFee" INTEGER,
  "maxEntries" INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompetitionCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CompetitionRegistration" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "athleteProfileId" TEXT NOT NULL,
  "partnerAthleteProfileId" TEXT,
  "partnerName" TEXT,
  "status" "CompetitionRegistrationStatus" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompetitionRegistration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CompetitionCategory_eventId_isActive_sortOrder_idx"
  ON "CompetitionCategory"("eventId", "isActive", "sortOrder");
CREATE INDEX IF NOT EXISTS "CompetitionCategory_program_discipline_idx"
  ON "CompetitionCategory"("program", "discipline");
CREATE UNIQUE INDEX IF NOT EXISTS "CompetitionRegistration_eventId_categoryId_athleteProfileId_key"
  ON "CompetitionRegistration"("eventId", "categoryId", "athleteProfileId");
CREATE INDEX IF NOT EXISTS "CompetitionRegistration_eventId_status_idx"
  ON "CompetitionRegistration"("eventId", "status");
CREATE INDEX IF NOT EXISTS "CompetitionRegistration_athleteProfileId_createdAt_idx"
  ON "CompetitionRegistration"("athleteProfileId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "ClassPass"
    ADD CONSTRAINT "ClassPass_purchaserId_fkey"
    FOREIGN KEY ("purchaserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CompetitionCategory"
    ADD CONSTRAINT "CompetitionCategory_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CompetitionRegistration"
    ADD CONSTRAINT "CompetitionRegistration_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CompetitionRegistration"
    ADD CONSTRAINT "CompetitionRegistration_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "CompetitionCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CompetitionRegistration"
    ADD CONSTRAINT "CompetitionRegistration_athleteProfileId_fkey"
    FOREIGN KEY ("athleteProfileId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CompetitionRegistration"
    ADD CONSTRAINT "CompetitionRegistration_partnerAthleteProfileId_fkey"
    FOREIGN KEY ("partnerAthleteProfileId") REFERENCES "AthleteProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
