/**
 * ANTIFRAUD RULES — D-05: velocity, лимит активных броней.
 */

import { booking } from '@/config/business';
import { db } from '@/lib/db';

export async function checkActiveBookingsLimit(userId: string): Promise<{ ok: boolean; count: number }> {
  const count = await db.booking.count({
    where: { customerId: userId, status: { in: ['PENDING', 'CONFIRMED'] as never } } as never,
  });
  return { ok: count < booking.maxActiveBookingsPerCustomer, count };
}
