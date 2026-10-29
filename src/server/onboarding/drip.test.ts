import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sendOnboardingEmails } from '@/server/onboarding/drip';

const h = vi.hoisted(() => ({
  db: {
    user: { findMany: vi.fn() },
    notification: { findMany: vi.fn() },
  },
  notify: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: h.db }));
vi.mock('@/lib/notifications/send', () => ({ notify: h.notify }));

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const NOW = new Date('2026-03-10T12:00:00.000Z');

/** Пользователь, зарегистрированный `hoursAgo` часов назад, в том виде, в каком его отдаёт findMany. */
function signedUp(id: string, hoursAgo: number, locale: 'hy' | 'ru' | 'en' = 'ru') {
  return { id, locale, createdAt: new Date(NOW.getTime() - hoursAgo * HOUR_MS) };
}

beforeEach(() => {
  vi.resetAllMocks();
  h.db.user.findMany.mockResolvedValue([]);
  h.db.notification.findMany.mockResolvedValue([]);
  h.notify.mockResolvedValue(true);
});

describe('sendOnboardingEmails: выборка', () => {
  it('берёт только тех, кому шаг сейчас актуален и не отправлен, самых старых первыми', async () => {
    await sendOnboardingEmails(NOW);

    expect(h.db.user.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        deletionRequestedAt: null,
        anonymizedAt: null,
        AND: [
          {
            OR: [
              {
                createdAt: { gte: new Date(NOW.getTime() - 1 * DAY_MS), lte: NOW },
                notifications: { none: { type: 'onboarding.welcome' } },
              },
              {
                createdAt: {
                  gte: new Date(NOW.getTime() - 4 * DAY_MS),
                  lte: new Date(NOW.getTime() - 3 * DAY_MS),
                },
                notifications: { none: { type: 'onboarding.howToBook' } },
              },
              {
                createdAt: {
                  gte: new Date(NOW.getTime() - 8 * DAY_MS),
                  lte: new Date(NOW.getTime() - 7 * DAY_MS),
                },
                notifications: { none: { type: 'onboarding.bonus' } },
              },
            ],
          },
          {},
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 200,
      select: { id: true, locale: true, createdAt: true },
    });
  });

  it('больше пользователей, чем размер страницы: все получают шаг, следующая страница идёт за последним', async () => {
    const firstPage = Array.from({ length: 200 }, (_, index) =>
      signedUp(`user-${String(index).padStart(3, '0')}`, 2),
    );
    const secondPage = [signedUp('user-200', 2), signedUp('user-201', 2)];
    h.db.user.findMany.mockResolvedValueOnce(firstPage).mockResolvedValueOnce(secondPage);

    expect(await sendOnboardingEmails(NOW)).toBe(202);
    expect(h.notify).toHaveBeenCalledTimes(202);
    expect(h.db.user.findMany).toHaveBeenCalledTimes(2);

    const secondQuery = h.db.user.findMany.mock.calls[1]?.[0];
    const createdAt = new Date(NOW.getTime() - 2 * HOUR_MS);
    expect(secondQuery?.where.AND[1]).toEqual({
      OR: [{ createdAt: { gt: createdAt } }, { createdAt, id: { gt: 'user-199' } }],
    });
  });

  it('без новых пользователей не читает отправленные шаги и ничего не ставит', async () => {
    expect(await sendOnboardingEmails(NOW)).toBe(0);
    expect(h.db.notification.findMany).not.toHaveBeenCalled();
    expect(h.notify).not.toHaveBeenCalled();
  });

  it('читает отправленные шаги всех пользователей одним запросом', async () => {
    h.db.user.findMany.mockResolvedValue([signedUp('user-1', 2), signedUp('user-2', 2)]);

    await sendOnboardingEmails(NOW);

    expect(h.db.notification.findMany).toHaveBeenCalledTimes(1);
    expect(h.db.notification.findMany).toHaveBeenCalledWith({
      where: { userId: { in: ['user-1', 'user-2'] }, type: { startsWith: 'onboarding.' } },
      select: { userId: true, type: true },
    });
  });
});

describe('sendOnboardingEmails: шаги', () => {
  it('новый пользователь получает приветствие со ссылкой на занятия в своей локали', async () => {
    h.db.user.findMany.mockResolvedValue([signedUp('user-1', 2, 'en')]);

    expect(await sendOnboardingEmails(NOW)).toBe(1);
    expect(h.notify).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'onboarding.welcome',
      locale: 'en',
      data: {},
      dedupeKey: 'onboarding:user-1:onboarding.welcome',
      href: 'http://localhost:3000/en/classes',
    });
  });

  it('на третий день после приветствия уходит инструкция по бронированию', async () => {
    h.db.user.findMany.mockResolvedValue([signedUp('user-1', 72)]);
    h.db.notification.findMany.mockResolvedValue([{ userId: 'user-1', type: 'onboarding.welcome' }]);

    await sendOnboardingEmails(NOW);

    expect(h.notify).toHaveBeenCalledTimes(1);
    expect(h.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'onboarding.howToBook',
        href: 'http://localhost:3000/ru/instructors',
      }),
    );
  });

  it('на седьмой день уходит бонус со ссылкой на реферальную страницу', async () => {
    h.db.user.findMany.mockResolvedValue([signedUp('user-1', 7 * 24)]);
    h.db.notification.findMany.mockResolvedValue([
      { userId: 'user-1', type: 'onboarding.welcome' },
      { userId: 'user-1', type: 'onboarding.howToBook' },
    ]);

    await sendOnboardingEmails(NOW);

    expect(h.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'onboarding.bonus',
        href: 'http://localhost:3000/ru/account/referrals',
      }),
    );
  });

  it('уже отправленный шаг не ставится повторно', async () => {
    h.db.user.findMany.mockResolvedValue([signedUp('user-1', 2)]);
    h.db.notification.findMany.mockResolvedValue([{ userId: 'user-1', type: 'onboarding.welcome' }]);

    expect(await sendOnboardingEmails(NOW)).toBe(0);
    expect(h.notify).not.toHaveBeenCalled();
  });

  it('если notify не поставил письмо (отключено пользователем), счётчик не растёт', async () => {
    h.db.user.findMany.mockResolvedValue([signedUp('user-1', 2)]);
    h.notify.mockResolvedValue(false);

    expect(await sendOnboardingEmails(NOW)).toBe(0);
    expect(h.notify).toHaveBeenCalledTimes(1);
  });

  it('пропущенные шаги старше суток не догоняются', async () => {
    h.db.user.findMany.mockResolvedValue([signedUp('user-1', 5 * 24)]);

    expect(await sendOnboardingEmails(NOW)).toBe(0);
    expect(h.notify).not.toHaveBeenCalled();
  });
});

describe('sendOnboardingEmails: сбои', () => {
  it('сбой одного пользователя не останавливает остальных', async () => {
    h.db.user.findMany.mockResolvedValue([signedUp('user-1', 2), signedUp('user-2', 2)]);
    h.notify.mockRejectedValueOnce(new Error('db timeout')).mockResolvedValueOnce(true);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(await sendOnboardingEmails(NOW)).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith('[cron:onboarding]', expect.any(Error));
  });
});
