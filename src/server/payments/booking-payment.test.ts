import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: {
    booking: { findUnique: vi.fn() },
    payment: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
  provider: { id: 'mock', createPayment: vi.fn() },
  providerForMethod: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: mocks.db }));
vi.mock('@/lib/payments', () => ({
  getPaymentProvider: vi.fn(),
  providerForMethod: mocks.providerForMethod,
}));
vi.mock('@/server/entitlements/service', () => ({ getEffectiveEntitlementsSafe: vi.fn() }));
vi.mock('@/server/wallet/service', () => ({ applyWalletToPayment: vi.fn() }));

import { createBookingPayment } from './service';

const pendingBooking = {
  id: 'booking-1',
  reference: 'BK-00000001',
  customerId: 'customer-1',
  status: 'PENDING',
  totalPrice: 17_000,
  subject: 'CLASS_SESSION',
  customer: { email: 'a@example.com', phone: null, name: 'Anna' },
};

const input = { bookingId: 'booking-1', userId: 'customer-1', method: 'CARD' as const, locale: 'ru' };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.providerForMethod.mockReturnValue(mocks.provider);
  mocks.provider.createPayment.mockResolvedValue({
    provider: 'mock',
    providerTransactionId: 'tx-1',
    redirectUrl: 'https://pay.example/tx-1',
    qrPayload: null,
    status: 'PENDING',
  });
  mocks.db.payment.create.mockResolvedValue({ id: 'payment-1' });
  mocks.db.payment.update.mockResolvedValue({});
  mocks.db.payment.findUnique.mockResolvedValue(null);
});

describe('createBookingPayment', () => {
  it('returns NOT_FOUND for an unknown booking', async () => {
    mocks.db.booking.findUnique.mockResolvedValue(null);
    await expect(createBookingPayment(input)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(mocks.provider.createPayment).not.toHaveBeenCalled();
  });

  it('refuses to pay for a booking owned by someone else', async () => {
    mocks.db.booking.findUnique.mockResolvedValue({ ...pendingBooking, customerId: 'someone-else' });
    await expect(createBookingPayment(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mocks.db.payment.create).not.toHaveBeenCalled();
  });

  it('refuses to pay a booking that is no longer PENDING', async () => {
    mocks.db.booking.findUnique.mockResolvedValue({ ...pendingBooking, status: 'CONFIRMED' });
    await expect(createBookingPayment(input)).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(mocks.provider.createPayment).not.toHaveBeenCalled();
  });

  it('creates a payment at the booking price and returns the provider redirect', async () => {
    mocks.db.booking.findUnique.mockResolvedValue(pendingBooking);

    const result = await createBookingPayment(input);

    expect(mocks.db.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bookingId: 'booking-1', amount: 17_000, status: 'PENDING', method: 'CARD' }),
      }),
    );
    expect(mocks.provider.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: 'payment-1', amount: 17_000, method: 'CARD', locale: 'ru' }),
    );
    expect(result).toMatchObject({
      bookingId: 'booking-1',
      paymentId: 'payment-1',
      amount: 17_000,
      providerTransactionId: 'tx-1',
      redirectUrl: 'https://pay.example/tx-1',
    });
  });

  it('returns the existing attempt instead of creating a second payment', async () => {
    mocks.db.booking.findUnique.mockResolvedValue(pendingBooking);
    mocks.db.payment.findUnique.mockResolvedValue({
      id: 'payment-0',
      status: 'PENDING',
      providerTransactionId: 'tx-0',
      providerPayload: { redirectUrl: 'https://pay.example/tx-0' },
    });

    const result = await createBookingPayment(input);

    expect(mocks.db.payment.create).not.toHaveBeenCalled();
    expect(mocks.provider.createPayment).not.toHaveBeenCalled();
    expect(result).toMatchObject({ paymentId: 'payment-0', providerTransactionId: 'tx-0', redirectUrl: 'https://pay.example/tx-0' });
  });

  it('reissues the attempt on the same row when the previous session expired', async () => {
    mocks.db.booking.findUnique.mockResolvedValue(pendingBooking);
    mocks.db.payment.findUnique.mockResolvedValue({
      id: 'payment-0',
      status: 'PENDING',
      providerTransactionId: 'tx-0',
      providerPayload: { redirectUrl: 'https://pay.example/tx-0', expiresAt: new Date(Date.now() - 60_000).toISOString() },
    });
    mocks.db.payment.update.mockResolvedValueOnce({ id: 'payment-0' });

    const result = await createBookingPayment(input);

    expect(mocks.db.payment.create).not.toHaveBeenCalled();
    expect(mocks.provider.createPayment).toHaveBeenCalledWith(expect.objectContaining({ paymentId: 'payment-0', amount: 17_000 }));
    expect(result).toMatchObject({ paymentId: 'payment-0', redirectUrl: 'https://pay.example/tx-1' });
  });
});
