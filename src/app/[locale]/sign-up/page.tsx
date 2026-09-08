/**
 * Экран регистрации. Зеркало входа: та же рамка, та же проверка `redirectTo`,
 * то же перенаправление уже вошедшего.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AuthShell } from '@/components/auth/auth-shell';
import { SignUpForm } from '@/components/auth/sign-up-form';
import { routes } from '@/config';
import type { Locale } from '@/i18n/config';
import { Link, redirect } from '@/i18n/routing';
import { getCaller } from '@/lib/auth/guards';
import { buildMetadata } from '@/lib/seo/metadata';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ redirectTo?: string | string[] }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'auth.signUp' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.signUp(),
    title: t('title'),
    description: t('subtitle'),
    noIndex: true,
  });
}

function safeTarget(value: string | string[] | undefined): string | undefined {
  const target = Array.isArray(value) ? value[0] : value;
  if (!target || !target.startsWith('/') || target.startsWith('//')) return undefined;
  return target;
}

export default async function SignUpPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const redirectTo = safeTarget((await searchParams).redirectTo);

  const caller = await getCaller();
  if (caller) redirect({ href: redirectTo ?? routes.account(), locale: locale as Locale });

  const t = await getTranslations('auth.signUp');

  return (
    <AuthShell
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <>
          {t('hasAccount')}{' '}
          <Link
            href={routes.signIn(redirectTo)}
            className="font-semibold text-content-accent underline"
          >
            {t('signInLink')}
          </Link>
        </>
      }
    >
      <SignUpForm redirectTo={redirectTo} />
    </AuthShell>
  );
}
