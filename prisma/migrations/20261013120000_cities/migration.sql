-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "moderation" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "publishedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CityTranslation" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "CityTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistrictTranslation" (
    "id" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "DistrictTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "City_slug_key" ON "City"("slug") WHERE ("deletedAt" IS NULL);

-- CreateIndex
CREATE INDEX "City_moderation_idx" ON "City"("moderation");

-- CreateIndex
CREATE INDEX "City_deletedAt_idx" ON "City"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CityTranslation_cityId_locale_key" ON "CityTranslation"("cityId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "District_cityId_slug_key" ON "District"("cityId", "slug") WHERE ("deletedAt" IS NULL);

-- CreateIndex
CREATE INDEX "District_cityId_isActive_sortOrder_idx" ON "District"("cityId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "District_deletedAt_idx" ON "District"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DistrictTranslation_districtId_locale_key" ON "DistrictTranslation"("districtId", "locale");

-- AddForeignKey
ALTER TABLE "CityTranslation" ADD CONSTRAINT "CityTranslation_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "District" ADD CONSTRAINT "District_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistrictTranslation" ADD CONSTRAINT "DistrictTranslation_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;
