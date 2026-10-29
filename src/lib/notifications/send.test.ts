import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deliverNotificationRow } from '@/lib/notifications/send';

const h = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  db: { notification: { update: vi.fn() } },
}));

vi.mock('@/lib/db', () => ({ db: h.db }));
vi.mock('@/lib/email/send', () => ({ sendEmail: h.sendEmail }));
vi.mock('@/lib/notifications/push', () => ({ preferredChannel: vi.fn(), sendPushToUser: vi.fn() }));
vi.mock('@/lib/notifications/render', () => ({ renderEmail: vi.fn() }));

const RENDERED = {
  subject: 'Бронирование подтверждено',
  heading: 'Всё готово',
  paragraphs: ['Ждём вас на занятии.'],
  ctaLabel: 'Открыть',
  ctaHref: '/account/bookings/1',
};

beforeEach(() => {
  vi.resetAllMocks();
  h.db.notification.update.mockResolvedValue({});
});

describe('deliverNotificationRow', () => {
  it('письмо принято провайдером: строка SENT с идентификатором письма', async () => {
    h.sendEmail.mockResolvedValue({ delivered: true, providerMessageId: 'mail-1' });

    await expect(deliverNotificationRow('n-1', 'user@example.com', 'ru', RENDERED)).resolves.toBe(true);

    expect(h.sendEmail).toHaveBeenCalledWith({
      to: 'user@example.com',
      locale: 'ru',
      subject: 'Бронирование подтверждено',
      heading: 'Всё готово',
      paragraphs: ['Ждём вас на занятии.'],
      action: { label: 'Открыть', href: '/account/bookings/1' },
    });
    expect(h.db.notification.update).toHaveBeenCalledWith({
      where: { id: 'n-1' },
      data: expect.objectContaining({ status: 'SENT', providerMessageId: 'mail-1', failureReason: null }),
    });
  });

  it('провайдер не принял письмо: строка FAILED с причиной', async () => {
    h.sendEmail.mockResolvedValue({ delivered: false, reason: 'provider-503' });

    await expect(deliverNotificationRow('n-1', 'user@example.com', 'ru', RENDERED)).resolves.toBe(false);

    expect(h.db.notification.update.mock.calls[0]?.[0].data).toMatchObject({
      status: 'FAILED',
      failureReason: 'provider-503',
      sentAt: null,
    });
  });

  it('исключение при отправке: строка FAILED, наружу ничего не бросается', async () => {
    h.sendEmail.mockRejectedValue(new Error('network down'));

    await expect(deliverNotificationRow('n-1', 'user@example.com', 'ru', RENDERED)).resolves.toBe(false);

    expect(h.db.notification.update.mock.calls[0]?.[0].data).toMatchObject({
      status: 'FAILED',
      failureReason: 'network down',
    });
  });
});
