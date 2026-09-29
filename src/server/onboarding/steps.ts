/**
 * ONBOARDING (C-09) — welcome drip 3 письма: день 0 (спасибо), день 3 (как бронировать), день 7 (бонус).
 */

export const onboardingSteps = [
  { delayDays: 0, templateKey: 'onboarding.welcome' as const },
  { delayDays: 3, templateKey: 'onboarding.howToBook' as const },
  { delayDays: 7, templateKey: 'onboarding.bonus' as const },
] as const;

export function scheduleAt(createdAt: Date, delayDays: number): Date {
  return new Date(createdAt.getTime() + delayDays * 24 * 60 * 60 * 1000);
}

export function nextOnboardingStep(userCreatedAt: Date, now: Date, sentKeys: string[]): string | null {
  for (const step of onboardingSteps) {
    const at = scheduleAt(userCreatedAt, step.delayDays);
    if (at.getTime() <= now.getTime() && !sentKeys.includes(step.templateKey)) return step.templateKey;
  }
  return null;
}
