-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "promoCodeId" TEXT;

-- CreateIndex
CREATE INDEX "Booking_promoCodeId_idx" ON "Booking"("promoCodeId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
