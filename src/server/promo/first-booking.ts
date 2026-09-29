import 'server-only';

import { db } from '@/lib/db';
import { domainErrors } from '@/domain/errors';
import { isFirstBooking } from '@/domain/first-booking';

export async function applyFirstBookingPromo(input: { userId: string; promoCode: string }) {
  const normalized = input.promoCode.trim().toUpperCase();
  const promo = await db.promoCode.findFirst({ where: { code: normalized, deletedAt: null } });
  if (!promo || !(promo as unknown as { isActive: boolean }).isActive) throw domainErrors.notFound();
  const promoObj = promo as unknown as { id: string; value: number; type: string; usageCount: number; usageLimit: number | null };
  const count = await db.booking.count({ where: { customerId: input.userId } });
  if (!isFirstBooking(count)) throw domainErrors.validationFailed('promoCode');
  if (promoObj.usageLimit !== null && promoObj.usageCount >= promoObj.usageLimit) throw domainErrors.validationFailed('promoCode');
  return { discountPercent: promoObj.value, type: promoObj.type };
}
