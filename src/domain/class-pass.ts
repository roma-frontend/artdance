import { classPasses } from '@/config/pricing';
import { booking } from '@/config/business';

export type ClassPassOrder = { id: string; lessonsTotal: number; lessonsRemaining: number; pricePaid: number; expiresAt: Date; createdAt: Date };

export function activePasses(passes: readonly ClassPassOrder[], now: Date): readonly ClassPassOrder[] {
  return passes.filter((pass) => pass.expiresAt.getTime() > now.getTime() && pass.lessonsRemaining > 0);
}

export function pickUsablePass(passes: readonly ClassPassOrder[], now: Date): ClassPassOrder | null {
  const usable = [...activePasses(passes, now)];
  if (usable.length === 0) return null;
  usable.sort((a, b) => {
    const remainingDiff = a.lessonsRemaining - b.lessonsRemaining;
    if (remainingDiff !== 0) return remainingDiff;
    return a.expiresAt.getTime() - b.expiresAt.getTime();
  });
  return usable[0] ?? null;
}

export function passExpiresAt(boughtAt: Date, validityDays: number): Date {
  return new Date(boughtAt.getTime() + validityDays * 24 * 60 * 60 * 1000);
}

export function assertCanRedeem(pass: ClassPassOrder, now: Date): void {
  if (pass.lessonsRemaining <= 0) throw Object.assign(new Error('Class pass exhausted'), { code: 'PASS_EXHAUSTED' });
  if (pass.expiresAt.getTime() <= now.getTime()) throw Object.assign(new Error('Class pass expired'), { code: 'PASS_EXPIRED' });
}

export function classPassConfigById(id: string): (typeof classPasses)[number] | null {
  return (classPasses as readonly (typeof classPasses)[number][]).find((pass) => pass.id === id) ?? null;
}

export function classPassOfferPrice(baseGroupPrice: number, discountRate: number, lessons: number): number {
  return Math.round(baseGroupPrice * (1 - discountRate) * lessons);
}

export function validateBusinessConstraints(): void {
  const maxPass = Math.max(...classPasses.map((pass) => pass.lessons));
  if (maxPass > booking.maxActiveBookingsPerCustomer) {
    throw new Error(`Largest class pass (${maxPass}) exceeds booking.maxActiveBookingsPerCustomer (${booking.maxActiveBookingsPerCustomer})`);
  }
}
