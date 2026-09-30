import { describe, expect, it } from 'vitest';

// A-08: windowDays 30, requireVerifiedPurchase, idempotency [authorId, bookingId]
describe('reviews reply', () => {
  it('A-08 windowDays is 30', async () => {
    const { reviews } = await import('@/config/business');
    expect(reviews.windowDays).toBe(30);
  });

  it('A-08 requireVerifiedPurchase true', async () => {
    const { reviews } = await import('@/config/business');
    expect(reviews.requireVerifiedPurchase).toBe(true);
  });

  it('A-08 requireModeration true', async () => {
    const { reviews } = await import('@/config/business');
    expect(reviews.requireModeration).toBe(true);
  });

  it('A-08 rateLimit reviewSubmit exists', async () => {
    const { rateLimits } = await import('@/config/business');
    expect(rateLimits.reviewSubmit.requests).toBeGreaterThan(0);
  });
});
