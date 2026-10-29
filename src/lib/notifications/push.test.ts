import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isAllowedPushEndpoint } from '@/config/notifications';
import { isPushConfigured, preferredChannel, sendPushToUser } from '@/lib/notifications/push';
import { notify } from '@/lib/notifications/send';

const h = vi.hoisted(() => ({
  getServerEnv: vi.fn(),
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
  getEffectiveEntitlementsSafe: vi.fn(),
  sendEmail: vi.fn(),
  renderEmail: vi.fn(),
  db: {
    user: { findUnique: vi.fn() },
    notificationPreference: { findMany: vi.fn() },
    notification: { create: vi.fn(), update: vi.fn() },
    pushSubscription: { findFirst: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock('@/config/env', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, getServerEnv: h.getServerEnv };
});
vi.mock('web-push', () => ({ setVapidDetails: h.setVapidDetails, sendNotification: h.sendNotification }));
vi.mock('@/lib/db', () => ({ db: h.db }));
vi.mock('@/server/entitlements/service', () => ({
  getEffectiveEntitlementsSafe: h.getEffectiveEntitlementsSafe,
}));
vi.mock('@/lib/email/send', () => ({ sendEmail: h.sendEmail }));
vi.mock('@/lib/notifications/render', () => ({ renderEmail: h.renderEmail }));

const CONFIGURED_ENV = {
  VAPID_PUBLIC_KEY: 'BPublicKeyForTests',
  VAPID_PRIVATE_KEY: 'private-key-for-tests',
  VAPID_SUBJECT: 'mailto:ops@example.com',
};

const SUBSCRIPTION = {
  id: 'sub-1',
  endpoint: 'https://fcm.googleapis.com/fcm/send/test-1',
  p256dh: 'p256',
  auth: 'auth-secret',
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);

  h.getServerEnv.mockReturnValue(CONFIGURED_ENV);
  h.getEffectiveEntitlementsSafe.mockResolvedValue({ push: true });
  h.db.pushSubscription.findFirst.mockResolvedValue({ id: SUBSCRIPTION.id });
  h.db.pushSubscription.findMany.mockResolvedValue([SUBSCRIPTION]);
  h.db.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });
  h.sendNotification.mockResolvedValue({ statusCode: 201 });
  h.db.user.findUnique.mockResolvedValue({ locale: 'ru', email: 'user@example.com' });
  h.db.notificationPreference.findMany.mockResolvedValue([]);
  h.db.notification.create.mockResolvedValue({ id: 'n-1' });
  h.db.notification.update.mockResolvedValue({});
  h.renderEmail.mockResolvedValue({
    subject: 'Бронирование подтверждено',
    heading: 'Всё готово',
    paragraphs: ['Ждём вас на занятии.'],
  });
  h.sendEmail.mockResolvedValue({ delivered: true, providerMessageId: 'mail-1' });
});

describe('isAllowedPushEndpoint', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/abc',
    'https://wns2-by3p.notify.windows.com/w/?token=abc',
  ])('принимает push-сервис %s', (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://evil.example.test/hook',
    'https://fcm.googleapis.com.evil.example.test/abc',
    'https://notfcm.googleapis.com/abc',
    'https://fcm.googleapis.com:8443/abc',
    'https://user:pass@fcm.googleapis.com/abc',
    'https://169.254.169.254/latest/meta-data',
    'not a url',
  ])('отклоняет %s', (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });
});

describe('isPushConfigured', () => {
  it('выключен без VAPID-ключей', () => {
    h.getServerEnv.mockReturnValue({});
    expect(isPushConfigured()).toBe(false);
  });

  it('выключен при частичной настройке', () => {
    h.getServerEnv.mockReturnValue({ VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' });
    expect(isPushConfigured()).toBe(false);
  });

  it('выключен, если окружение не читается', () => {
    h.getServerEnv.mockImplementation(() => {
      throw new Error('bad env');
    });
    expect(isPushConfigured()).toBe(false);
  });

  it('включён, когда заданы все три значения', () => {
    expect(isPushConfigured()).toBe(true);
  });
});

describe('preferredChannel', () => {
  it('EMAIL без обращения к БД, если push не настроен', async () => {
    h.getServerEnv.mockReturnValue({});
    await expect(preferredChannel('user-1', 'booking.confirmed')).resolves.toBe('EMAIL');
    expect(h.getEffectiveEntitlementsSafe).not.toHaveBeenCalled();
    expect(h.db.pushSubscription.findFirst).not.toHaveBeenCalled();
  });

  it('PUSH при настройке, включённом тарифе и активной подписке', async () => {
    await expect(preferredChannel('user-1')).resolves.toBe('PUSH');
  });

  it('EMAIL, если тариф выключает push', async () => {
    h.getEffectiveEntitlementsSafe.mockResolvedValue({ push: false });
    await expect(preferredChannel('user-1')).resolves.toBe('EMAIL');
    expect(h.db.pushSubscription.findFirst).not.toHaveBeenCalled();
  });

  it('EMAIL, если у пользователя нет подписки', async () => {
    h.db.pushSubscription.findFirst.mockResolvedValue(null);
    await expect(preferredChannel('user-1')).resolves.toBe('EMAIL');
  });
});

describe('sendPushToUser', () => {
  const payload = {
    title: 'Бронирование подтверждено',
    body: 'Ждём вас на занятии.',
    href: '/account/bookings',
  };

  it('шлёт на все подписки и считает доставленные', async () => {
    h.db.pushSubscription.findMany.mockResolvedValue([
      SUBSCRIPTION,
      { ...SUBSCRIPTION, id: 'sub-2', endpoint: 'https://fcm.googleapis.com/fcm/send/test-2' },
    ]);

    await expect(sendPushToUser('user-1', payload)).resolves.toEqual({ sent: 2, removed: 0 });
    expect(h.sendNotification).toHaveBeenCalledWith(
      { endpoint: SUBSCRIPTION.endpoint, keys: { p256dh: 'p256', auth: 'auth-secret' } },
      JSON.stringify(payload),
      { TTL: 86400 },
    );
  });

  it('удаляет подписку, которую push-сервис отверг с 410', async () => {
    h.sendNotification.mockRejectedValue(Object.assign(new Error('gone'), { statusCode: 410 }));

    await expect(sendPushToUser('user-1', payload)).resolves.toEqual({ sent: 0, removed: 1 });
    expect(h.db.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { id: SUBSCRIPTION.id } });
  });

  it('сохраняет подписку при временной ошибке 500', async () => {
    h.sendNotification.mockRejectedValue(Object.assign(new Error('server'), { statusCode: 500 }));

    await expect(sendPushToUser('user-1', payload)).resolves.toEqual({ sent: 0, removed: 0 });
    expect(h.db.pushSubscription.deleteMany).not.toHaveBeenCalled();
  });

  it('не бросает исключение при сетевой ошибке', async () => {
    h.sendNotification.mockRejectedValue(new Error('ECONNRESET'));

    await expect(sendPushToUser('user-1', payload)).resolves.toEqual({ sent: 0, removed: 0 });
  });

  it('не бросает исключение, если БД недоступна', async () => {
    h.db.pushSubscription.findMany.mockRejectedValue(new Error('db down'));

    await expect(sendPushToUser('user-1', payload)).resolves.toEqual({ sent: 0, removed: 0 });
  });

  it('пропускает адрес не из списка push-сервисов и не шлёт на него', async () => {
    h.db.pushSubscription.findMany.mockResolvedValue([{ ...SUBSCRIPTION, endpoint: 'https://evil.example.test/hook' }]);

    await expect(sendPushToUser('user-1', payload)).resolves.toEqual({ sent: 0, removed: 0 });
    expect(h.sendNotification).not.toHaveBeenCalled();
  });

  it('возвращает ноль без обращения к БД, если push не настроен', async () => {
    h.getServerEnv.mockReturnValue({});

    await expect(sendPushToUser('user-1', payload)).resolves.toEqual({ sent: 0, removed: 0 });
    expect(h.db.pushSubscription.findMany).not.toHaveBeenCalled();
  });
});

describe('notify: канал PUSH', () => {
  it('push доставлен: письмо не уходит, строка PUSH помечена SENT', async () => {
    const created = await notify({
      userId: 'user-1',
      type: 'booking.confirmed',
      data: { title: 'Йога' },
      href: '/account/bookings/1',
    });

    expect(created).toBe(true);
    expect(h.sendNotification).toHaveBeenCalledTimes(1);
    expect(h.sendEmail).not.toHaveBeenCalled();
    expect(h.db.notification.create).toHaveBeenCalledTimes(1);
    expect(h.db.notification.create.mock.calls[0]?.[0].data).toMatchObject({ channel: 'PUSH', status: 'QUEUED' });
    expect(h.db.notification.update.mock.calls[0]?.[0].data).toMatchObject({ status: 'SENT' });
  });

  it('push не доставлен: строка PUSH помечена FAILED, письмо уходит', async () => {
    h.sendNotification.mockRejectedValue(Object.assign(new Error('server'), { statusCode: 500 }));

    const created = await notify({ userId: 'user-1', type: 'booking.confirmed', data: { title: 'Йога' } });

    expect(created).toBe(true);
    expect(h.db.notification.create.mock.calls.map((call) => call[0].data.channel)).toEqual(['PUSH', 'EMAIL']);
    expect(h.db.notification.update.mock.calls[0]?.[0].data).toMatchObject({
      status: 'FAILED',
      failureReason: 'push-not-delivered',
    });
    expect(h.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('без push-подписки уходит только письмо, как раньше', async () => {
    h.db.pushSubscription.findFirst.mockResolvedValue(null);

    const created = await notify({ userId: 'user-1', type: 'booking.confirmed', data: { title: 'Йога' } });

    expect(created).toBe(true);
    expect(h.sendNotification).not.toHaveBeenCalled();
    expect(h.db.notification.create.mock.calls.map((call) => call[0].data.channel)).toEqual(['EMAIL']);
    expect(h.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('отложенное уведомление не уходит по push', async () => {
    const later = new Date(Date.now() + 60 * 60 * 1000);

    await notify({ userId: 'user-1', type: 'booking.confirmed', data: { title: 'Йога' }, scheduledFor: later });

    expect(h.sendNotification).not.toHaveBeenCalled();
    expect(h.db.notification.create.mock.calls.map((call) => call[0].data.channel)).toEqual(['EMAIL']);
    expect(h.sendEmail).not.toHaveBeenCalled();
  });
});
