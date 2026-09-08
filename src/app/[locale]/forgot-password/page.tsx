/**
 * Экран запроса ссылки для сброса пароля.
 *
 * Вошедшего не перенаправляем: смена пароля — законное желание человека с
 * активной сессией, и отправлять его в кабинет означало бы не дать сделать то,
 * зачем он пришёл.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AuthShell } from '@/components/auth/auth-shell';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { routes } from '@/config';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { buildMetadata } from '@/lib/seo/metadata';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'auth.forgotPassword' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.forgotPassword(),
    title: t('title'),
    description: t('subtitle'),
    noIndex: true,
  });
}

export default async function ForgotPasswordPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations('auth.forgotPassword');

  return (
    <AuthShell
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <Link href={routes.signIn()} className="font-semibold text-content-accent underline">
          {t('backToSignIn')}
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
