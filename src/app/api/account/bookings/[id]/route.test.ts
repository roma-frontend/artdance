import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCaller: vi.fn(),
  db: {
    booking: { findFirst: vi.fn() },
    review: { findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/auth/guards', () => ({ getCaller: mocks.getCaller }));
vi.mock('@/lib/db', () => ({ db: mocks.db }));

import { GET } from './route';

const contactText = 'Позвоните +374 99 12 34 56';

function row(paid: boolean) {
  return {
    id: 'booking-1',
    reference: 'BK-000001',
    status: 'CONFIRMED',
    startsAt: new Date('2026-11-05T10:00:00.000Z'),
    endsAt: new Date('2026-11-05T11:00:00.000Z'),
    totalPrice: 12_000,
    basePrice: 12_000,
    travelFee: 0,
    currencyCode: 'AMD',
    lessonType: 'PAIR',
    partnerName: contactText,
    cancelledAt: null,
    cancellationReason: null,
    sessionId: null,
    rescheduleCount: 0,
    maxReschedules: 2,
    payments: paid ? [{ id: 'payment-1' }] : [],
    instructor: { slug: 'instructor', user: { name: 'Instructor' } },
    venue: null,
    session: null,
    event: null,
  };
}

async function call() {
  return GET(new Request('https://artdance.test/api/account/bookings/booking-1'), {
    params: Promise.resolve({ id: 'booking-1' }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getCaller.mockResolvedValue({ id: 'customer-1', role: 'CUSTOMER' });
  mocks.db.booking.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) =>
    where.id === 'booking-1' ? row(false) : null,
  );
  mocks.db.review.findUnique.mockResolvedValue(null);
});

describe('GET /api/account/bookings/[id]', () => {
  it('masks contact text before payment', async () => {
    const response = await call();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.booking).toMatchObject({
      paid: false,
      partnerName: `Позвоните ${'•'.repeat(contactText.length - 'Позвоните '.length)}`,
    });
    expect(payload.booking.partnerName).not.toContain('+374');
  });

  it('shows the original contact text after payment', async () => {
    mocks.db.booking.findFirst.mockResolvedValue(row(true));

    const response = await call();
    const payload = await response.json();

    expect(payload.booking).toMatchObject({ paid: true, partnerName: contactText });
  });
});
