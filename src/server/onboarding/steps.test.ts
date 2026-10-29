import { describe, expect, it } from 'vitest';

import { nextOnboardingStep } from '@/server/onboarding/steps';

const HOUR_MS = 60 * 60 * 1000;
const NOW = new Date('2026-03-10T12:00:00.000Z');

/** Дата регистрации `hoursAgo` часов назад. */
function createdHoursAgo(hoursAgo: number): Date {
  return new Date(NOW.getTime() - hoursAgo * HOUR_MS);
}

describe('nextOnboardingStep', () => {
  it('сразу после регистрации отдаёт приветствие', () => {
    expect(nextOnboardingStep(createdHoursAgo(1), NOW, [])).toBe('onboarding.welcome');
  });

  it('до третьего дня инструкция по бронированию ещё не наступила', () => {
    expect(nextOnboardingStep(createdHoursAgo(48), NOW, ['onboarding.welcome'])).toBeNull();
  });

  it('на третий день отдаёт инструкцию по бронированию', () => {
    expect(nextOnboardingStep(createdHoursAgo(72), NOW, ['onboarding.welcome'])).toBe('onboarding.howToBook');
  });

  it('шаг остаётся актуальным в течение суток после своего дня', () => {
    expect(nextOnboardingStep(createdHoursAgo(72 + 23), NOW, ['onboarding.welcome'])).toBe('onboarding.howToBook');
  });

  it('старше суток после своего дня шаг не отдаётся, даже если не отправлен', () => {
    expect(nextOnboardingStep(createdHoursAgo(72 + 25), NOW, ['onboarding.welcome'])).toBeNull();
  });

  it('старые шаги не догоняются: после пяти дней без писем ничего не отдаёт', () => {
    expect(nextOnboardingStep(createdHoursAgo(5 * 24), NOW, [])).toBeNull();
  });

  it('на седьмой день отдаёт бонус', () => {
    expect(
      nextOnboardingStep(createdHoursAgo(7 * 24), NOW, ['onboarding.welcome', 'onboarding.howToBook']),
    ).toBe('onboarding.bonus');
  });

  it('когда все шаги отправлены, отдаёт null', () => {
    expect(
      nextOnboardingStep(createdHoursAgo(8 * 24), NOW, [
        'onboarding.welcome',
        'onboarding.howToBook',
        'onboarding.bonus',
      ]),
    ).toBeNull();
  });
});
