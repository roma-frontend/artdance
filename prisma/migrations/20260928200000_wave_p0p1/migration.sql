-- DropIndex
DROP INDEX IF EXISTS "ClassSession_classId_startsAt_key";

-- DropIndex
DROP INDEX IF EXISTS "Course_slug_key";

-- DropIndex
DROP INDEX IF EXISTS "CourseLesson_courseId_slug_key";

-- DropIndex
DROP INDEX IF EXISTS "DanceClass_slug_key";

-- DropIndex
DROP INDEX IF EXISTS "Event_slug_key";

-- DropIndex
DROP INDEX IF EXISTS "InstructorProfile_slug_key";

-- DropIndex
DROP INDEX IF EXISTS "InstructorProfile_userId_key";

-- DropIndex
DROP INDEX IF EXISTS "Product_slug_key";

-- DropIndex
DROP INDEX IF EXISTS "ProductCategory_slug_key";

-- DropIndex
DROP INDEX IF EXISTS "ProductVariant_sku_key";

-- DropIndex
DROP INDEX IF EXISTS "PromoCode_code_key";

-- DropIndex
DROP INDEX IF EXISTS "Venue_slug_key";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "checkInAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "checkedInById" TEXT,
ADD COLUMN IF NOT EXISTS "consentVersion" TEXT,
ADD COLUMN IF NOT EXISTS "requestExpiresAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "seriesId" TEXT,
ADD COLUMN IF NOT EXISTS "source" TEXT;

-- AlterTable
ALTER TABLE "ClassSession" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CourseLesson" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DanceClass" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "InstructorProfile" ADD COLUMN IF NOT EXISTS "specializations" TEXT[],
ADD COLUMN IF NOT EXISTS "acceptanceRate" DECIMAL(5,4),
ADD COLUMN IF NOT EXISTS "boostedUntil" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "rankingScore" DECIMAL(6,3),
ADD COLUMN IF NOT EXISTS "responseTimeMinutes" INTEGER;

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "focalPoint" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProductCategory" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PromoCode" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "authorRole" TEXT,
ADD COLUMN IF NOT EXISTS "photoAssetIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "marketingConsentAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "referralCode" TEXT,
ADD COLUMN IF NOT EXISTS "referredById" TEXT,
ADD COLUMN IF NOT EXISTS "reliabilityScore" INTEGER NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Account" (
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

-- CreateTable
CREATE TABLE IF NOT EXISTS "ConsentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InstructorApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "styles" "DanceStyle"[],
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SavedSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'all',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReviewResponse" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ContentBlock" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ShortLink" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ShortLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FeatureFlagOverride" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlagOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "VerificationDocument" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Dispute" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "openedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ClassPass" (
    "id" TEXT NOT NULL,
    "purchaserId" TEXT NOT NULL,
    "templateId" TEXT,
    "lessonsTotal" INTEGER NOT NULL,
    "lessonsRemaining" INTEGER NOT NULL,
    "pricePaid" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassPass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ClassPassRedemption" (
    "id" TEXT NOT NULL,
    "passId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassPassRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RecurringSeries" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "instructorId" TEXT,
    "pattern" JSONB NOT NULL,
    "maxWeeks" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WalletAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WalletEntry" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Referral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT,
    "code" TEXT NOT NULL,
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "bonusPaidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CorporateAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorporateAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" TEXT NOT NULL,
    "corporateAccountId" TEXT,
    "orderId" TEXT,
    "number" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BoostCampaign" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "bidAmount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoostCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReliabilityEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReliabilityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Banner" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "imageKey" TEXT,
    "href" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Account_issuer_accountId_key" ON "Account"("issuer", "accountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ConsentRecord_userId_idx" ON "ConsentRecord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ConsentRecord_email_documentId_version_key" ON "ConsentRecord"("email", "documentId", "version");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InstructorApplication_status_createdAt_idx" ON "InstructorApplication"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SavedSearch_userId_idx" ON "SavedSearch"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SavedSearch_userId_query_scope_key" ON "SavedSearch"("userId", "query", "scope");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ReviewResponse_reviewId_key" ON "ReviewResponse"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ContentBlock_key_key" ON "ContentBlock"("key");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ShortLink_code_key" ON "ShortLink"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ShortLink_code_idx" ON "ShortLink"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FeatureFlagOverride_key_key" ON "FeatureFlagOverride"("key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VerificationDocument_instructorId_status_idx" ON "VerificationDocument"("instructorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Dispute_bookingId_key" ON "Dispute"("bookingId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ClassPass_purchaserId_expiresAt_idx" ON "ClassPass"("purchaserId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ClassPassRedemption_bookingId_key" ON "ClassPassRedemption"("bookingId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ClassPassRedemption_passId_idx" ON "ClassPassRedemption"("passId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RecurringSeries_customerId_createdAt_idx" ON "RecurringSeries"("customerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WalletAccount_userId_key" ON "WalletAccount"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WalletEntry_accountId_createdAt_idx" ON "WalletEntry"("accountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Referral_refereeId_key" ON "Referral"("refereeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Referral_code_idx" ON "Referral"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Referral_referrerId_idx" ON "Referral"("referrerId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Referral_referrerId_code_key" ON "Referral"("referrerId", "code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_orderId_key" ON "Invoice"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_corporateAccountId_status_idx" ON "Invoice"("corporateAccountId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BoostCampaign_instructorId_status_idx" ON "BoostCampaign"("instructorId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BoostCampaign_status_endsAt_idx" ON "BoostCampaign"("status", "endsAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReliabilityEvent_userId_kind_idx" ON "ReliabilityEvent"("userId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Banner_key_key" ON "Banner"("key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ClassSession_deletedAt_idx" ON "ClassSession"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ClassSession_classId_startsAt_key" ON "ClassSession"("classId", "startsAt") WHERE ("deletedAt" IS NULL);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Course_deletedAt_idx" ON "Course"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Course_slug_key" ON "Course"("slug") WHERE ("deletedAt" IS NULL);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CourseLesson_deletedAt_idx" ON "CourseLesson"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CourseLesson_courseId_slug_key" ON "CourseLesson"("courseId", "slug") WHERE ("deletedAt" IS NULL);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DanceClass_deletedAt_idx" ON "DanceClass"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DanceClass_slug_key" ON "DanceClass"("slug") WHERE ("deletedAt" IS NULL);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Event_deletedAt_idx" ON "Event"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Event_slug_key" ON "Event"("slug") WHERE ("deletedAt" IS NULL);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InstructorProfile_deletedAt_idx" ON "InstructorProfile"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InstructorProfile_userId_key" ON "InstructorProfile"("userId") WHERE ("deletedAt" IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InstructorProfile_slug_key" ON "InstructorProfile"("slug") WHERE ("deletedAt" IS NULL);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MediaAsset_deletedAt_idx" ON "MediaAsset"("deletedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_deletedAt_idx" ON "Product"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Product_slug_key" ON "Product"("slug") WHERE ("deletedAt" IS NULL);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductCategory_deletedAt_idx" ON "ProductCategory"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProductCategory_slug_key" ON "ProductCategory"("slug") WHERE ("deletedAt" IS NULL);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductVariant_deletedAt_idx" ON "ProductVariant"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_sku_key" ON "ProductVariant"("sku") WHERE ("deletedAt" IS NULL);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PromoCode_deletedAt_idx" ON "PromoCode"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PromoCode_code_key" ON "PromoCode"("code") WHERE ("deletedAt" IS NULL);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Room_deletedAt_idx" ON "Room"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Venue_deletedAt_idx" ON "Venue"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Venue_slug_key" ON "Venue"("slug") WHERE ("deletedAt" IS NULL);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VerificationToken_identifier_idx" ON "VerificationToken"("identifier");

-- AddForeignKey (Account FK already in 20260908152402_better_auth_tables) — idempotent guard
DO $$ BEGIN
  ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Booking" ADD CONSTRAINT "Booking_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "RecurringSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ReviewResponse" ADD CONSTRAINT "ReviewResponse_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "VerificationDocument" ADD CONSTRAINT "VerificationDocument_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "InstructorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ClassPassRedemption" ADD CONSTRAINT "ClassPassRedemption_passId_fkey" FOREIGN KEY ("passId") REFERENCES "ClassPass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ClassPassRedemption" ADD CONSTRAINT "ClassPassRedemption_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "WalletAccount" ADD CONSTRAINT "WalletAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "WalletAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Referral" ADD CONSTRAINT "Referral_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_corporateAccountId_fkey" FOREIGN KEY ("corporateAccountId") REFERENCES "CorporateAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "BoostCampaign" ADD CONSTRAINT "BoostCampaign_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "InstructorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ReliabilityEvent" ADD CONSTRAINT "ReliabilityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

