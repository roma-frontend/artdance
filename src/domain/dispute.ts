/**
 * DISPUTE (D-08) — споры по броням.
 * Открывает любой участник, решает модератор. DISPUTE_LOST → reliability -20.
 */

export function disputeValidReason(reason: string): boolean {
  const normalized = reason.trim();
  return normalized.length >= 12 && normalized.length <= 2000;
}
