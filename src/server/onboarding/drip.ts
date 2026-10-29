/**
 * ONBOARDING DRIP (C-09) — три письма новым пользователям, шаги описаны в `steps.ts`.
 *
 * Тик берёт только тех, кому какой-то шаг сейчас актуален и ещё не отправлен, самых старых
 * первыми. Выборка страницами по курсору (createdAt, id), поэтому число новых пользователей
 * не вытесняет старых. Если `notify` отказал (письмо отключено), шаг не засчитывается:
 * через сутки он перестаёт быть актуальным и больше не проверяется.
 */

import 'server-only';

import { routes } from '@/config/routes';
import { absoluteUrl } from '@/config/site';
import type { Locale } from '@/i18n/config';
import { db } from '@/lib/db';
import { notify } from '@/lib/notifications/send';
import {
  nextOnboardingStep,
  onboardingSteps,
  STEP_GRACE_MS,
  type OnboardingTemplateKey,
} from '@/server/onboarding/steps';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Размер страницы выборки. */
const ONBOARDING_PAGE_SIZE = 200;
/** Предохранитель на один запуск. Шаг актуален сутки, поэтому остаток уходит в следующий запуск. */
const ONBOARDING_MAX_USERS_PER_RUN = 10_000;

/** Курсор: последний пользователь предыдущей страницы в порядке (createdAt, id). */
type UserCursor = { createdAt: Date; id: string };
type OnboardingUser = { id: string; locale: Locale; createdAt: Date };

/** Путь, куда ведёт кнопка письма; локаль добавляет `absoluteUrl`. */
const stepPath: Record<OnboardingTemplateKey, string> = {
  'onboarding.welcome': routes.classes(),
  'onboarding.howToBook': routes.instructors(),
  'onboarding.bonus': routes.accountReferrals(),
};

/** Ставит актуальные шаги и возвращает число принятых писем. Сбой одного пользователя изолирован. */
export async function sendOnboardingEmails(now: Date): Promise<number> {
  let queued = 0;
  let scanned = 0;
  let after: UserCursor | null = null;
  while (scanned < ONBOARDING_MAX_USERS_PER_RUN) {
    const page: OnboardingUser[] = await db.user.findMany({
      where: {
        isActive: true,
        deletionRequestedAt: null,
        anonymizedAt: null,
        AND: [{ OR: onboardingSteps.map((step) => dueForStep(step, now)) }, afterCursor(after)],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: ONBOARDING_PAGE_SIZE,
      select: { id: true, locale: true, createdAt: true },
    });
    const last = page.at(-1);
    if (!last) break;
    queued += await sendPage(page, now);
    scanned += page.length;
    after = { createdAt: last.createdAt, id: last.id };
    if (page.length < ONBOARDING_PAGE_SIZE) break;
  }
  return queued;
}

/** Условие актуальности шага: createdAt попадает в окно из `steps.ts`, и шаг ещё не отправлен. */
function dueForStep(step: (typeof onboardingSteps)[number], now: Date) {
  const delayMs = step.delayDays * DAY_MS;
  return {
    createdAt: {
      gte: new Date(now.getTime() - delayMs - STEP_GRACE_MS),
      lte: new Date(now.getTime() - delayMs),
    },
    notifications: { none: { type: step.templateKey } },
  };
}

/** Строго после курсора: строки с равным createdAt сравниваются по id. Без курсора ограничения нет. */
function afterCursor(after: UserCursor | null) {
  if (!after) return {};
  return {
    OR: [
      { createdAt: { gt: after.createdAt } },
      { createdAt: after.createdAt, id: { gt: after.id } },
    ],
  };
}

/** Ставит шаги одной страницы пользователей. Возвращает число принятых писем. */
async function sendPage(users: OnboardingUser[], now: Date): Promise<number> {
  const sent = await db.notification.findMany({
    where: { userId: { in: users.map((user) => user.id) }, type: { startsWith: 'onboarding.' } },
    select: { userId: true, type: true },
  });
  const sentByUser = new Map<string, string[]>();
  for (const row of sent) {
    const keys = sentByUser.get(row.userId) ?? [];
    keys.push(row.type);
    sentByUser.set(row.userId, keys);
  }

  let queued = 0;
  for (const user of users) {
    try {
      if (await sendStep(user, now, sentByUser.get(user.id) ?? [])) queued += 1;
    } catch (error) {
      console.error('[cron:onboarding]', error);
    }
  }
  return queued;
}

/** Ставит актуальный неотправленный шаг пользователя. false — шага нет или письмо не принято. */
async function sendStep(
  user: { id: string; locale: Locale; createdAt: Date },
  now: Date,
  sentKeys: readonly string[],
): Promise<boolean> {
  const key = nextOnboardingStep(user.createdAt, now, sentKeys);
  if (key === null) return false;
  return notify({
    userId: user.id,
    type: key,
    locale: user.locale,
    data: {},
    dedupeKey: `onboarding:${user.id}:${key}`,
    href: absoluteUrl(`/${user.locale}${stepPath[key]}`),
  });
}
