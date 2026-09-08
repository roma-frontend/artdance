/**
 * Экран входа.
 *
 * **Уже вошедшего сюда не пускаем.** Форма входа для человека с активной сессией
 * — это либо недоумение, либо случайный выход из аккаунта. Перенаправление идёт на
 * `redirectTo`, если он есть: человек пришёл по защищённой ссылке, `proxy.ts`
 * отправил его сюда, а сессия оказалась валидной.
 *
 * **Страница не индексируется и не кешируется.** `/sign-in` есть и в
 * `noIndexPathPrefixes`, и в `privatePaths`: ответ зависит от наличия сессии, и
 * отданный CDN повторно он увёл бы одного человека в кабинет другого.
 *
 * **`redirectTo` проверяется здесь и ещё раз в действии.** Абсолютный URL в этом
 * параметре — открытый редирект, то есть фишинговая ссылка с нашего домена.
 * Дважды проверить строку дешевле, чем один раз объясняться.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AuthShell } from '@/components/auth/auth-shell';
import { SignInForm } from '@/components/auth/sign-in-form';
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
  const t = await getTranslations({ locale: locale as Locale, namespace: 'auth.signIn' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.signIn(),
    title: t('title'),
    description: t('subtitle'),
    noIndex: true,
  });
}

/** Только относительный путь. Всё остальное — потенциальный открытый редирект. */
function safeTarget(value: string | string[] | undefined): string | undefined {
  const target = Array.isArray(value) ? value[0] : value;
  if (!target || !target.startsWith('/') || target.startsWith('//')) return undefined;
  return target;
}

export default async function SignInPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const redirectTo = safeTarget((await searchParams).redirectTo);

  const caller = await getCaller();
  if (caller) redirect({ href: redirectTo ?? routes.account(), locale: locale as Locale });

  const t = await getTranslations('auth.signIn');

  return (
    <AuthShell
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <>
          {t('noAccount')}{' '}
          <Link
            href={routes.signUp(redirectTo)}
            className="font-semibold text-content-accent underline"
          >
            {t('signUpLink')}
          </Link>
        </>
      }
    >
      <SignInForm redirectTo={redirectTo} />
    </AuthShell>
  );
}
