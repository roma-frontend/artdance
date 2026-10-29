import { beforeEach, describe, expect, it, vi } from 'vitest';

import { notify } from '@/lib/notifications/send';

const h = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  sendPushToUser: vi.fn(),
  preferredChannel: vi.fn(),
  renderEmail: vi.fn(),
  db: {
    user: { findUnique: vi.fn() },
    notification: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    notificationPreference: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/db', () => ({ db: h.db }));
vi.mock('@/lib/email/send', () => ({ sendEmail: h.sendEmail }));
vi.mock('@/lib/notifications/push', () => ({
  preferredChannel: h.preferredChannel,
  sendPushToUser: h.sendPushToUser,
}));
vi.mock('@/lib/notifications/render', () => ({ renderEmail: h.renderEmail }));

const RENDERED = {
  subject: 'New matches for "salsa"',
  heading: 'You have new matches',
  paragraphs: ['New matches: 1. For example: Salsa Basics.'],
  ctaLabel: 'Open search',
  ctaHref: 'https://example.test/en/discover?q=salsa',
};

const INPUT = {
  userId: 'u1',
  type: 'savedSearch.match' as const,
  data: { query: 'salsa', count: 1, title: 'Salsa Basics' },
  dedupeKey: 'saved:u1:classes:salsa:c1',
};

beforeEach(() => {
  vi.resetAllMocks();
  h.db.user.findUnique.mockResolvedValue({ locale: 'en', email: 'user@example.com' });
  h.db.notification.findFirst.mockResolvedValue(null);
  h.db.notification.create.mockResolvedValue({ id: 'n-1' });
  h.db.notification.update.mockResolvedValue({});
  h.db.notificationPreference.findMany.mockResolvedValue([]);
  h.preferredChannel.mockResolvedValue('EMAIL');
  h.renderEmail.mockResolvedValue(RENDERED);
  h.sendEmail.mockResolvedValue({ delivered: true, providerMessageId: 'mail-1' });
});

describe('notify', () => {
  it('получатель не найден: false, строка не создается', async () => {
    h.db.user.findUnique.mockResolvedValue(null);

    await expect(notify(INPUT)).resolves.toBe(false);

    expect(h.db.notification.create).not.toHaveBeenCalled();
    expect(h.sendEmail).not.toHaveBeenCalled();
  });

  it('дубликат по ключу дедупликации: false, новая строка и письмо не создаются', async () => {
    h.db.notification.findFirst.mockResolvedValue({ id: 'n-old' });

    await expect(notify(INPUT)).resolves.toBe(false);

    expect(h.db.notification.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'u1',
        type: 'savedSearch.match',
        payload: { path: ['dedupeKey'], equals: INPUT.dedupeKey },
      },
      select: { id: true },
    });
    expect(h.db.notification.create).not.toHaveBeenCalled();
    expect(h.sendEmail).not.toHaveBeenCalled();
  });

  it('без дубликата: строка EMAIL создается, письмо уходит сразу, результат true', async () => {
    await expect(notify(INPUT)).resolves.toBe(true);

    expect(h.db.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u1',
          channel: 'EMAIL',
          type: 'savedSearch.match',
          status: 'QUEUED',
          locale: 'en',
          scheduledFor: null,
          payload: expect.objectContaining({ dedupeKey: INPUT.dedupeKey, query: 'salsa' }),
        }),
      }),
    );
    expect(h.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@example.com', locale: 'en', subject: RENDERED.subject }),
    );
    expect(h.db.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'n-1' }, data: expect.objectContaining({ status: 'SENT' }) }),
    );
  });

  it('провайдер отказал: строка FAILED с причиной, но результат true, потому что строка создана', async () => {
    h.sendEmail.mockResolvedValue({ delivered: false, reason: 'provider-503' });

    await expect(notify(INPUT)).resolves.toBe(true);

    expect(h.db.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'n-1' },
        data: expect.objectContaining({ status: 'FAILED', failureReason: 'provider-503' }),
      }),
    );
  });

  it('все каналы выключены пользователем: false, строка не создается', async () => {
    h.db.notificationPreference.findMany.mockResolvedValue([
      { channel: 'EMAIL', type: 'savedSearch.match', enabled: false },
    ]);

    await expect(notify(INPUT)).resolves.toBe(false);

    expect(h.db.notification.create).not.toHaveBeenCalled();
    expect(h.sendEmail).not.toHaveBeenCalled();
  });

  it('отложенное уведомление: строка создается с датой, письмо не уходит до cron, результат true', async () => {
    const later = new Date(Date.now() + 60 * 60 * 1000);

    await expect(notify({ ...INPUT, scheduledFor: later })).resolves.toBe(true);

    expect(h.db.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ channel: 'EMAIL', scheduledFor: later }) }),
    );
    expect(h.sendEmail).not.toHaveBeenCalled();
  });

  it('push доставлен хотя бы на одно устройство: письмо не уходит', async () => {
    h.preferredChannel.mockResolvedValue('PUSH');
    h.sendPushToUser.mockResolvedValue({ sent: 1, removed: 0 });

    await expect(notify(INPUT)).resolves.toBe(true);

    expect(h.db.notification.create).toHaveBeenCalledTimes(1);
    expect(h.db.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ channel: 'PUSH' }) }),
    );
    expect(h.sendEmail).not.toHaveBeenCalled();
  });

  it('push не доставлен ни на одно устройство: уходит письмо', async () => {
    h.preferredChannel.mockResolvedValue('PUSH');
    h.sendPushToUser.mockResolvedValue({ sent: 0, removed: 0 });

    await expect(notify(INPUT)).resolves.toBe(true);

    expect(h.db.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ channel: 'PUSH' }) }),
    );
    expect(h.db.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ channel: 'EMAIL' }) }),
    );
    expect(h.sendEmail).toHaveBeenCalledTimes(1);
  });
});
