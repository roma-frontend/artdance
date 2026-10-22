/**
 * ОНБОРДИНГ ТАНЦОРА — первый тур анкеты.
 *
 * Человек попадает сюда сразу после регистрации: пока он не ответил, инструктор
 * не знает, с какого уровня начинать. Повторный заход в тур не запрещён — если
 * человек уже проходил его, страница отправляет его в кабинет, где анкету можно
 * переписать в любой момент.
 *
 * **Гвард здесь, а не только в `proxy.ts`.** Прокси смотрит на наличие cookie;
 * `getCaller()` проверяет подпись, срок и `isActive`. Без этого страница отдала
 * бы анкету кому угодно, кто поставил себе cookie с нужным именем.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { DancerTour } from '@/components/onboarding/dancer-tour';
import { routes, site } from '@/config';
import { isDancerLevel } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { redirect } from '@/i18n/routing';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { buildMetadata } from '@/lib/seo/metadata';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'onboarding.dancer' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.onboardingDancer(),
    title: t('meta.title'),
    description: t('meta.description'),
    noIndex: true,
  });
}

export default async function OnboardingDancerPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const caller = await getCaller();
  if (!caller) {
    redirect({ href: routes.signIn(routes.onboardingDancer()), locale: locale as Locale });
    return null;
  }

  const profile = await db.dancerProfile.findUnique({
    where: { userId: caller.id },
    select: { level: true, styles: true, goal: true, note: true, onboardingCompleted: true },
  });

  /* Анкета уже заполнена — в кабинет, а не второй раз в тот же тур. */
  if (profile?.onboardingCompleted) {
    redirect({ href: routes.account(), locale: locale as Locale });
    return null;
  }

  const t = await getTranslations('onboarding.dancer');

  return (
    <main id={site.mainContentId} className="page-container inner-page min-w-0">
      <div className="mx-auto max-w-2xl py-6 sm:py-10">
        <p className="text-eyebrow uppercase text-content-tertiary">{t('eyebrow')}</p>
        <DancerTour
          mode="onboarding"
          initialLevel={isDancerLevel(profile?.level) ? profile.level : null}
          initialStyles={profile?.styles ?? []}
          initialGoal={profile?.goal ?? null}
          initialNote={profile?.note ?? null}
        />
      </div>
    </main>
  );
}
