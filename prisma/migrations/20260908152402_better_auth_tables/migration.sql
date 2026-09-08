/*
  Warnings:

  - You are about to drop the column `passwordHash` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `attempts` on the `VerificationToken` table. All the data in the column will be lost.
  - You are about to drop the column `consumedAt` on the `VerificationToken` table. All the data in the column will be lost.
  - You are about to drop the column `purpose` on the `VerificationToken` table. All the data in the column will be lost.
  - You are about to drop the column `tokenHash` on the `VerificationToken` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `VerificationToken` table. All the data in the column will be lost.
  - You are about to drop the `OauthAccount` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updatedAt` to the `Session` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `VerificationToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `value` to the `VerificationToken` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "OauthAccount" DROP CONSTRAINT "OauthAccount_userId_fkey";

-- DropForeignKey
ALTER TABLE "VerificationToken" DROP CONSTRAINT "VerificationToken_userId_fkey";

-- DropIndex
DROP INDEX "VerificationToken_identifier_purpose_idx";

-- DropIndex
DROP INDEX "VerificationToken_tokenHash_key";

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "passwordHash";

-- AlterTable
ALTER TABLE "VerificationToken" DROP COLUMN "attempts",
DROP COLUMN "consumedAt",
DROP COLUMN "purpose",
DROP COLUMN "tokenHash",
DROP COLUMN "userId",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "value" TEXT NOT NULL;

-- DropTable
DROP TABLE "OauthAccount";

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "password" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_issuer_accountId_key" ON "Account"("issuer", "accountId");

-- CreateIndex
CREATE INDEX "VerificationToken_identifier_idx" ON "VerificationToken"("identifier");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
