-- CreateEnum
CREATE TYPE "ReviewQueueStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "SmsDispatch" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewQueueEntry" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReviewQueueStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "ReviewQueueEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsDispatch_createdAt_idx" ON "SmsDispatch"("createdAt");

-- CreateIndex
CREATE INDEX "ReviewQueueEntry_status_createdAt_idx" ON "ReviewQueueEntry"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewQueueEntry_kind_subject_key" ON "ReviewQueueEntry"("kind", "subject");
