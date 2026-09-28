/**
 * UNSUBSCRIBE ALIAS — /unsubscribe/[token] → /newsletter/unsubscribe/[token].
 */

import { redirect } from '@/i18n/routing';

import { routes } from '@/config/routes';
import type { Locale } from '@/i18n/config';

interface PageProps {
  params: Promise<{ locale: string; token: string }>;
}

export default async function UnsubscribeAliasPage({ params }: PageProps) {
  const { locale, token } = await params;
  redirect({ href: routes.newsletterUnsubscribe(token), locale: locale as Locale } as never);
}
