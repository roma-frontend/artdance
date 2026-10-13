-- CreateTable
CREATE TABLE "FooterLink" (
    "id" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "labelKey" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "feature" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FooterLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FooterLink_isActive_group_order_idx" ON "FooterLink"("isActive", "group", "order");
