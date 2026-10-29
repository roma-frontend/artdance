-- AlterTable
ALTER TABLE "SavedSearch" ADD COLUMN "checkedAt" TIMESTAMP(3),
ADD COLUMN "matchedIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "SavedSearch_checkedAt_idx" ON "SavedSearch"("checkedAt");
