-- AlterTable
ALTER TABLE "User" ADD COLUMN     "corporateAccountId" TEXT;

-- CreateIndex
CREATE INDEX "User_corporateAccountId_idx" ON "User"("corporateAccountId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_corporateAccountId_fkey" FOREIGN KEY ("corporateAccountId") REFERENCES "CorporateAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
