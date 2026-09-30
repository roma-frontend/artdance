-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'ATHLETE';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "athleteProfileId" TEXT,
ADD COLUMN     "splitParticipants" INTEGER;

-- CreateTable
CREATE TABLE "InstructorTariff" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricePerHour" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'AMD',
    "commissionRate" DECIMAL(5,4),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorTariff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wdsfId" TEXT,
    "category" TEXT,
    "clubName" TEXT,
    "rank" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdSlot" (
    "id" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "bannerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WdsfEvent" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "city" TEXT,
    "country" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "url" TEXT,
    "rawPayload" JSONB,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WdsfEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstructorTariff_instructorId_isActive_idx" ON "InstructorTariff"("instructorId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "InstructorTariff_instructorId_name_key" ON "InstructorTariff"("instructorId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AthleteProfile_userId_key" ON "AthleteProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AthleteProfile_wdsfId_key" ON "AthleteProfile"("wdsfId");

-- CreateIndex
CREATE UNIQUE INDEX "AdSlot_slotKey_key" ON "AdSlot"("slotKey");

-- CreateIndex
CREATE INDEX "AdSlot_slotKey_isActive_idx" ON "AdSlot"("slotKey", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "WdsfEvent_externalId_key" ON "WdsfEvent"("externalId");

-- CreateIndex
CREATE INDEX "WdsfEvent_startsAt_idx" ON "WdsfEvent"("startsAt");

-- CreateIndex
CREATE INDEX "Booking_athleteProfileId_idx" ON "Booking"("athleteProfileId");

-- AddForeignKey
ALTER TABLE "InstructorTariff" ADD CONSTRAINT "InstructorTariff_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "InstructorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_athleteProfileId_fkey" FOREIGN KEY ("athleteProfileId") REFERENCES "AthleteProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteProfile" ADD CONSTRAINT "AthleteProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdSlot" ADD CONSTRAINT "AdSlot_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "Banner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

