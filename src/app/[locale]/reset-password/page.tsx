/**
 * Экран установки нового пароля по ссылке из письма.
 *
 * Токен читается на сервере и отдаётся форме пропсом: чтение адресной строки в
 * компоненте означало бы, что форма ведёт себя по-разному до и после гидратации.
 *
 * Токен в query, а не в сегменте пути, потому что так формирует ссылку Better
 * Auth (`{redirectTo}?token=…`) — подстроить сегмент невозможно, токен появляется
 * в момент отправки письма. Утечки это не добавляет: страница отдаётся с
 * `no-store`, а `Referrer-Policy` не пускает адрес во внешние запросы.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AuthShell } from '@/components/auth/auth-shell';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { routes } from '@/config';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { buildMetadata } from '@/lib/seo/metadata';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'auth.resetPassword' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.resetPassword(),
    title: t('title'),
    noIndex: true,
  });
}

export default async function ResetPasswordPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const raw = (await searchParams).token;
  const token = (Array.isArray(raw) ? raw[0] : raw) ?? '';

  const t = await getTranslations('auth.resetPassword');

  return (
    <AuthShell
      title={t('title')}
      footer={
        <Link href={routes.signIn()} className="font-semibold text-content-accent underline">
          {t('submit')}
        </Link>
      }
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
