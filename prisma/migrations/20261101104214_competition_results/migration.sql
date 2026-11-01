-- CreateEnum
CREATE TYPE "CompetitionPlace" AS ENUM ('GOLD', 'SILVER', 'BRONZE', 'FINALIST', 'PARTICIPANT');

-- CreateTable
CREATE TABLE "CompetitionResult" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "place" "CompetitionPlace" NOT NULL,
    "recordedById" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionResult_registrationId_key" ON "CompetitionResult"("registrationId");

-- CreateIndex
CREATE INDEX "CompetitionResult_place_idx" ON "CompetitionResult"("place");

-- AddForeignKey
ALTER TABLE "CompetitionResult" ADD CONSTRAINT "CompetitionResult_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "CompetitionRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
