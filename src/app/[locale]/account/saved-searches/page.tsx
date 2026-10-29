/**
 * СОХРАНЁННЫЕ ПОИСКИ — раздел кабинета (C-05).
 *
 * Сохранить поиск можно на странице результатов `/discover`; здесь он виден,
 * открывается обратно и удаляется. Уведомления о новых совпадениях приходят
 * письмом раз в сутки, когда по запросу появляются результаты, которых не было.
 *
 * **Гвард здесь, а не только в `proxy.ts`.** Прокси смотрит на наличие cookie, а
 * `getCaller()` проверяет подпись, срок и `isActive`. Список чужих поисков по
 * одной cookie-заглушке был бы утечкой.
 *
 * Страница приватная: префикс `/account` попадает в `noIndexPathPrefixes`.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AccountNav } from '@/components/account/account-nav';
import { SavedSearchRemoveButton } from '@/components/account/saved-search-remove-button';
import { SiteFooter } from '@/components/layout/site-footer';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { routes, site } from '@/config';
import { parseSearchScope, searchScopeLabelKey } from '@/domain/search';
import type { Locale } from '@/i18n/config';
import { Link, redirect } from '@/i18n/routing';
import { getRootTranslate } from '@/i18n/translate';
import { getCaller } from '@/lib/auth/guards';
import { buildMetadata } from '@/lib/seo/metadata';
import { getEffectiveEntitlementsSafe } from '@/server/entitlements/service';
import { listSavedSearches } from '@/server/saved-search/service';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'savedSearches' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.accountSavedSearches(),
    title: t('title'),
    noIndex: true,
  });
}

export default async function SavedSearchesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const caller = await getCaller();
  if (!caller) {
    redirect({ href: routes.signIn(routes.accountSavedSearches()), locale: locale as Locale });
    /* `redirect` бросает, но его тип этого не выражает — `return` сужает тип ниже. */
    return null;
  }

  const items = await listSavedSearches(caller.id);

  const t = await getTranslations('savedSearches');
  const tNav = await getTranslations('nav');
  const tRoot = await getRootTranslate();
  const entitlements = await getEffectiveEntitlementsSafe();

  return (
    <>
      <main id={site.mainContentId} className="page-container inner-page">
        <header>
          <p className="text-eyebrow uppercase text-content-tertiary">{tNav('account')}</p>
          <h1 className="text-heading-2 mt-2">{t('title')}</h1>
        </header>
        <AccountNav locale={locale as Locale} pathname={routes.accountSavedSearches()} entitlements={entitlements} />

        {items.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              title={t('empty')}
              description={t('emptyHint')}
              action={
                <Button asChild variant="accent">
                  <Link href={routes.discover()}>{tNav('discover')}</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="mt-10 flex flex-col gap-4">
            {items.map((item) => {
              const scope = parseSearchScope(item.scope);
              const href = routes.discover({
                q: item.query,
                ...(scope === 'all' ? {} : { scope }),
              });

              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border-default p-5"
                >
                  <div className="min-w-0">
                    <p className="text-card-title break-words">{item.query}</p>
                    <p className="text-body-sm text-content-secondary">{tRoot(searchScopeLabelKey(scope))}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button asChild variant="outline" size="sm">
                      <Link href={href}>{t('open')}</Link>
                    </Button>
                    <SavedSearchRemoveButton id={item.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
