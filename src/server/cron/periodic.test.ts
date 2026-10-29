import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runPeriodicJobs } from '@/server/cron/periodic';

const h = vi.hoisted(() => ({
  db: {
    session: { deleteMany: vi.fn() },
    notification: { findMany: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    operatorSetting: { findUnique: vi.fn(), upsert: vi.fn() },
  },
  deliverNotificationRow: vi.fn(),
  renderEmail: vi.fn(),
  sendAbandonedCartReminders: vi.fn(),
  sendOnboardingEmails: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: h.db }));
vi.mock('@/lib/notifications/send', () => ({ deliverNotificationRow: h.deliverNotificationRow }));
vi.mock('@/lib/notifications/render', () => ({ renderEmail: h.renderEmail }));
vi.mock('@/server/cart/abandonment', () => ({ sendAbandonedCartReminders: h.sendAbandonedCartReminders }));
vi.mock('@/server/onboarding/drip', () => ({ sendOnboardingEmails: h.sendOnboardingEmails }));
vi.mock('@/server/saved-search/alerts', () => ({ runSavedSearchAlerts: vi.fn(async () => 0) }));

const NOON_UTC = new Date('2025-06-10T12:00:00.000Z');
const DIGEST_KEY = 'cron.digest.sentOn';
const RENDERED = { subject: 'Напоминание', heading: 'Скоро занятие', paragraphs: ['Ждём вас.'] };

function queuedRow(overrides: { id?: string; type?: string } = {}) {
  return {
    id: overrides.id ?? 'n-1',
    userId: 'user-1',
    type: overrides.type ?? 'booking.confirmed',
    locale: 'ru',
    payload: {
      title: 'Йога',
      when: '18:00',
      href: '/account/bookings/1',
      subject: 'Тема',
      heading: 'Заголовок',
    },
  };
}

/** Дайджест-заглушка: `sent` — что вернёт провайдер. */
function digestStub(sent = true) {
  return vi.fn(async () => ({ sent }));
}

beforeEach(() => {
  vi.resetAllMocks();
  h.db.session.deleteMany.mockResolvedValue({ count: 0 });
  h.db.notification.findMany.mockResolvedValue([]);
  h.db.notification.update.mockResolvedValue({});
  h.db.user.findUnique.mockResolvedValue({ email: 'user@example.com' });
  h.db.operatorSetting.findUnique.mockResolvedValue(null);
  h.db.operatorSetting.upsert.mockResolvedValue({});
  h.deliverNotificationRow.mockResolvedValue(true);
  h.renderEmail.mockResolvedValue(RENDERED);
  h.sendAbandonedCartReminders.mockResolvedValue(0);
  h.sendOnboardingEmails.mockResolvedValue(0);
});

describe('runPeriodicJobs: сессии', () => {
  it('удаляет сессии с истёкшим сроком и возвращает их число', async () => {
    h.db.session.deleteMany.mockResolvedValue({ count: 5 });

    const report = await runPeriodicJobs(NOON_UTC, digestStub(false));

    expect(h.db.session.deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lt: NOON_UTC } } });
    expect(report.sessionsPurged).toBe(5);
  });

  it('сбой чистки не мешает отправке писем и дайджесту', async () => {
    h.db.session.deleteMany.mockRejectedValue(new Error('db timeout'));
    h.db.notification.findMany.mockResolvedValue([queuedRow()]);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const report = await runPeriodicJobs(new Date('2025-06-10T04:00:00.000Z'), digestStub(true));

    expect(report).toEqual({
      sessionsPurged: 0,
      scheduledSent: 1,
      abandonedCartReminders: 0,
      onboardingSent: 0,
      savedSearchAlerts: 0,
      digestSent: true,
    });
    expect(errorSpy).toHaveBeenCalledWith('[cron:sessions]', expect.any(Error));
  });
});

describe('runPeriodicJobs: отложенные письма', () => {
  it('отправляет строки, у которых наступил scheduledFor, через общий путь доставки', async () => {
    h.db.notification.findMany.mockResolvedValue([queuedRow()]);

    const report = await runPeriodicJobs(NOON_UTC, digestStub(false));

    expect(h.db.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'QUEUED', channel: 'EMAIL', scheduledFor: { lte: NOON_UTC } },
        orderBy: { scheduledFor: 'asc' },
        take: 200,
      }),
    );
    expect(h.renderEmail).toHaveBeenCalledWith({
      type: 'booking.confirmed',
      locale: 'ru',
      data: { title: 'Йога', when: '18:00', href: '/account/bookings/1', subject: 'Тема', heading: 'Заголовок' },
    });
    expect(h.deliverNotificationRow).toHaveBeenCalledWith('n-1', 'user@example.com', 'ru', RENDERED);
    expect(report.scheduledSent).toBe(1);
  });

  it('считает только принятые письма и не останавливается на сбое одной строки', async () => {
    h.db.notification.findMany.mockResolvedValue([
      queuedRow({ id: 'n-1' }),
      queuedRow({ id: 'n-2' }),
      queuedRow({ id: 'n-3' }),
    ]);
    h.renderEmail
      .mockResolvedValueOnce(RENDERED)
      .mockRejectedValueOnce(new Error('render failed'))
      .mockResolvedValueOnce(RENDERED);
    h.deliverNotificationRow.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const report = await runPeriodicJobs(NOON_UTC, digestStub(false));

    expect(report.scheduledSent).toBe(1);
    expect(h.deliverNotificationRow).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledWith('[cron:scheduled-notifications]', expect.any(Error));
  });

  it('строка без получателя помечается FAILED, письмо не рисуется', async () => {
    h.db.notification.findMany.mockResolvedValue([queuedRow()]);
    h.db.user.findUnique.mockResolvedValue(null);

    const report = await runPeriodicJobs(NOON_UTC, digestStub(false));

    expect(h.db.notification.update).toHaveBeenCalledWith({
      where: { id: 'n-1' },
      data: { status: 'FAILED', failureReason: 'recipient-not-found' },
    });
    expect(h.renderEmail).not.toHaveBeenCalled();
    expect(h.deliverNotificationRow).not.toHaveBeenCalled();
    expect(report.scheduledSent).toBe(0);
  });

  it('строка с неизвестным типом помечается FAILED, письмо не рисуется', async () => {
    h.db.notification.findMany.mockResolvedValue([queuedRow({ type: 'legacy.unknown' })]);

    await runPeriodicJobs(NOON_UTC, digestStub(false));

    expect(h.db.notification.update).toHaveBeenCalledWith({
      where: { id: 'n-1' },
      data: { status: 'FAILED', failureReason: 'unknown-type' },
    });
    expect(h.renderEmail).not.toHaveBeenCalled();
    expect(h.deliverNotificationRow).not.toHaveBeenCalled();
  });
});

describe('runPeriodicJobs: ежедневный дайджест', () => {
  it('до 04:00 UTC не запускается и не читает отметку', async () => {
    const runDigest = digestStub();

    const report = await runPeriodicJobs(new Date('2025-06-10T03:59:00.000Z'), runDigest);

    expect(runDigest).not.toHaveBeenCalled();
    expect(h.db.operatorSetting.findUnique).not.toHaveBeenCalled();
    expect(report.digestSent).toBe(false);
  });

  it('первый тик от 04:00 UTC запускает дайджест один раз и ставит отметку дня', async () => {
    const runDigest = digestStub(true);
    const now = new Date('2025-06-10T04:00:00.000Z');

    const report = await runPeriodicJobs(now, runDigest);

    expect(runDigest).toHaveBeenCalledTimes(1);
    expect(runDigest).toHaveBeenCalledWith(now);
    expect(h.db.operatorSetting.upsert).toHaveBeenCalledWith({
      where: { key: DIGEST_KEY },
      create: { key: DIGEST_KEY, value: '2025-06-10', updatedBy: 'cron' },
      update: { value: '2025-06-10', updatedBy: 'cron' },
    });
    expect(report.digestSent).toBe(true);
  });

  it('следующий тик того же UTC-дня дайджест не повторяет', async () => {
    h.db.operatorSetting.findUnique.mockResolvedValue({ value: '2025-06-10' });
    const runDigest = digestStub();

    const report = await runPeriodicJobs(NOON_UTC, runDigest);

    expect(runDigest).not.toHaveBeenCalled();
    expect(h.db.operatorSetting.upsert).not.toHaveBeenCalled();
    expect(report.digestSent).toBe(false);
  });

  it('новые UTC-сутки снова запускают дайджест', async () => {
    h.db.operatorSetting.findUnique.mockResolvedValue({ value: '2025-06-09' });
    const runDigest = digestStub();

    await runPeriodicJobs(new Date('2025-06-10T04:15:00.000Z'), runDigest);

    expect(runDigest).toHaveBeenCalledTimes(1);
  });

  it('неудачная отправка не повторяется в тот же день: отметка ставится до запуска', async () => {
    const runDigest = digestStub(false);

    const first = await runPeriodicJobs(new Date('2025-06-10T04:00:00.000Z'), runDigest);

    // Провайдер не принял письмо; отметка уже записана, и следующий тик её видит.
    h.db.operatorSetting.findUnique.mockResolvedValue({ value: '2025-06-10' });
    await runPeriodicJobs(new Date('2025-06-10T04:15:00.000Z'), runDigest);

    expect(first.digestSent).toBe(false);
    expect(runDigest).toHaveBeenCalledTimes(1);
    const markedAt = h.db.operatorSetting.upsert.mock.invocationCallOrder[0] ?? Number.NaN;
    const sentAt = runDigest.mock.invocationCallOrder[0] ?? Number.NaN;
    expect(markedAt).toBeLessThan(sentAt);
  });

  it('сбой дайджеста не отменяет остальные задачи', async () => {
    h.db.session.deleteMany.mockResolvedValue({ count: 2 });
    h.db.notification.findMany.mockResolvedValue([queuedRow()]);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const runDigest = vi.fn(async () => {
      throw new Error('aggregate failed');
    });

    const report = await runPeriodicJobs(new Date('2025-06-10T04:00:00.000Z'), runDigest);

    expect(report).toEqual({
      sessionsPurged: 2,
      scheduledSent: 1,
      abandonedCartReminders: 0,
      onboardingSent: 0,
      savedSearchAlerts: 0,
      digestSent: false,
    });
    expect(errorSpy).toHaveBeenCalledWith('[cron:digest]', expect.any(Error));
  });
});

describe('runPeriodicJobs: корзины и онбординг', () => {
  it('напоминания о корзинах и письма онбординга попадают в отчёт', async () => {
    h.sendAbandonedCartReminders.mockResolvedValue(2);
    h.sendOnboardingEmails.mockResolvedValue(3);

    const report = await runPeriodicJobs(NOON_UTC, digestStub(false));

    expect(h.sendAbandonedCartReminders).toHaveBeenCalledWith(NOON_UTC);
    expect(h.sendOnboardingEmails).toHaveBeenCalledWith(NOON_UTC);
    expect(report.abandonedCartReminders).toBe(2);
    expect(report.onboardingSent).toBe(3);
  });

  it('сбой корзин не отменяет онбординг и дайджест', async () => {
    h.sendAbandonedCartReminders.mockRejectedValue(new Error('db timeout'));
    h.sendOnboardingEmails.mockResolvedValue(1);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const report = await runPeriodicJobs(new Date('2025-06-10T04:00:00.000Z'), digestStub(true));

    expect(report).toEqual({
      sessionsPurged: 0,
      scheduledSent: 0,
      abandonedCartReminders: 0,
      onboardingSent: 1,
      savedSearchAlerts: 0,
      digestSent: true,
    });
    expect(errorSpy).toHaveBeenCalledWith('[cron:abandoned-carts]', expect.any(Error));
  });
});
