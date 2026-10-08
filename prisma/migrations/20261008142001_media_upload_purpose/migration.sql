/*
  Warnings:

  - A unique constraint covering the columns `[bannerId]` on the table `MediaAsset` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[blogPostId]` on the table `MediaAsset` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[courseId]` on the table `MediaAsset` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[avatarOwnerId]` on the table `MediaAsset` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "avatarOwnerId" TEXT,
ADD COLUMN     "bannerId" TEXT,
ADD COLUMN     "blogPostId" TEXT,
ADD COLUMN     "courseId" TEXT,
ADD COLUMN     "purpose" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_bannerId_key" ON "MediaAsset"("bannerId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_blogPostId_key" ON "MediaAsset"("blogPostId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_courseId_key" ON "MediaAsset"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_avatarOwnerId_key" ON "MediaAsset"("avatarOwnerId");

-- CreateIndex
CREATE INDEX "MediaAsset_bannerId_idx" ON "MediaAsset"("bannerId");

-- CreateIndex
CREATE INDEX "MediaAsset_blogPostId_idx" ON "MediaAsset"("blogPostId");

-- CreateIndex
CREATE INDEX "MediaAsset_courseId_idx" ON "MediaAsset"("courseId");

-- CreateIndex
CREATE INDEX "MediaAsset_avatarOwnerId_idx" ON "MediaAsset"("avatarOwnerId");

-- CreateIndex
CREATE INDEX "MediaAsset_purpose_idx" ON "MediaAsset"("purpose");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "Banner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_blogPostId_fkey" FOREIGN KEY ("blogPostId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_avatarOwnerId_fkey" FOREIGN KEY ("avatarOwnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
