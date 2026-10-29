/**
 * ONBOARDING (C-09) — welcome drip 3 письма: день 0 (спасибо), день 3 (как бронировать), день 7 (бонус).
 *
 * Шаг актуален в течение суток после своего дня, а окна шагов не пересекаются:
 * в каждый момент отправляется не больше одного письма на пользователя.
 */

export const onboardingSteps = [
  { delayDays: 0, templateKey: 'onboarding.welcome' as const },
  { delayDays: 3, templateKey: 'onboarding.howToBook' as const },
  { delayDays: 7, templateKey: 'onboarding.bonus' as const },
] as const;

export function scheduleAt(createdAt: Date, delayDays: number): Date {
  return new Date(createdAt.getTime() + delayDays * 24 * 60 * 60 * 1000);
}

export type OnboardingTemplateKey = (typeof onboardingSteps)[number]['templateKey'];

/** Срок, в течение которого шаг ещё можно отправить после наступления его дня. */
export const STEP_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * Первый шаг, который уже наступил, ещё актуален (не старше `STEP_GRACE_MS`) и не отправлен.
 * null — отправлять нечего. Старые шаги не догоняются: иначе при запуске всем, кто
 * зарегистрировался за последнюю неделю, ушла бы серия из трёх писем подряд.
 */
export function nextOnboardingStep(
  userCreatedAt: Date,
  now: Date,
  sentKeys: readonly string[],
): OnboardingTemplateKey | null {
  for (const step of onboardingSteps) {
    const at = scheduleAt(userCreatedAt, step.delayDays).getTime();
    const current = at <= now.getTime() && now.getTime() - at <= STEP_GRACE_MS;
    if (current && !sentKeys.includes(step.templateKey)) return step.templateKey;
  }
  return null;
}
