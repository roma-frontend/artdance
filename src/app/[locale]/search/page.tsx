/**
 * SEARCH — A-04: алиас /discover с поддержкой ?q и scope.
 * Весь поиск живёт в /discover; отдельный /search — для индексации и прямых ссылок из писем/QR.
 */

import { redirect } from '@/i18n/routing';

import { routes } from '@/config/routes';
import type { Locale } from '@/i18n/config';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SearchAliasPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q : Array.isArray(sp.q) ? sp.q[0] : undefined;
  const scope = typeof sp.scope === 'string' ? sp.scope : undefined;
  const href = routes.discover({ ...(q ? { q } : {}), ...(scope ? { scope } : {}) });
  redirect({ href, locale: locale as Locale } as never);
}
