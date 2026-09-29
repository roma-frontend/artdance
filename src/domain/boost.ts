/**
 * BOOST (B-07) — промо-размещение: кампания с ставкой, сроком, модерацией.
 * Активная кампания повышает rankingScore инструктора в каталоге discovery.
 */

export function boostActive(campaign: { status: string; startsAt: Date; endsAt: Date }, now: Date): boolean {
  return campaign.status === 'APPROVED' && campaign.startsAt.getTime() <= now.getTime() && campaign.endsAt.getTime() > now.getTime();
}

export function boostBidValid(amount: number): boolean {
  return amount >= 1000 && amount <= 100_000 && amount % 100 === 0;
}
