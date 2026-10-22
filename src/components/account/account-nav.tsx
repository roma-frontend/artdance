/**
 * НАВИГАЦИЯ КАБИНЕТА.
 *
 * До этого модуля страницы кабинета существовали порознь: `/account/wallet`,
 * `/account/orders`, `/account/bookings` открывались только по прямой ссылке,
 * а единственным переходом между ними был браузерный «назад». Ключи
 * `account.nav.*` лежали в переводах и использовались ровно для одного пункта.
 *
 * **Секции фильтруются снимком тарифов, а не env.** Кошелёк, рефералы и
 * подписка — модули пресета: при MVP их нет, и ссылка на выключенный раздел
 * ведёт в 404. Поэтому список приходит с сервера уже отфильтрованным: сервер
 * умеет прочитать тумблер, а клиент — нет.
 *
 * **Активный пункт — `aria-current`,** а не класс. Скринридер сообщает «текущая
 * страница»; цвет в CSS — вторичный признак, и один он до неё не доезжает.
 */

import { getTranslations } from 'next-intl/server';

import { routes } from '@/config/routes';
import type { FeatureKey } from '@/config/features';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/** Пункт меню: путь плюс тумблер, без которого пункт не показывается. */
interface AccountNavEntry {
  href: string;
  labelKey: string;
  feature?: FeatureKey;
  /** Сравнение по префиксу: у `/account/orders/:number` активен пункт «Заказы». */
  exact?: boolean;
}

/**
 * Только страницы, которые существуют.
 *
 * В `routes` объявлены и `/account/reviews`, и `/account/settings`, но страниц
 * за ними нет. Пункт меню, ведущий в 404, хуже отсутствующего пункта: он
 * обещает раздел и подводит. Появятся страницы — добавятся строки здесь, и
 * ни одна другая правка не понадобится.
 */
const entries: readonly AccountNavEntry[] = [
  { href: routes.account(), labelKey: 'account.nav.overview', exact: true },
  { href: routes.accountBookings(), labelKey: 'account.nav.bookings' },
  { href: routes.accountOrders(), labelKey: 'account.nav.orders' },
  { href: routes.accountFavorites(), labelKey: 'account.nav.favorites' },
  { href: routes.accountSubscription(), labelKey: 'account.nav.subscription', feature: 'subscriptions' },
  { href: routes.accountWallet(), labelKey: 'account.nav.wallet', feature: 'wallet' },
  { href: routes.accountReferrals(), labelKey: 'account.nav.referrals', feature: 'referrals' },
  { href: routes.accountNotifications(), labelKey: 'account.nav.notifications' },
  { href: routes.accountDancerProfile(), labelKey: 'account.nav.dancerProfile' },
  { href: routes.accountData(), labelKey: 'account.nav.data' },
];

function isActive(pathname: string, entry: AccountNavEntry): boolean {
  if (entry.exact) return pathname === entry.href || pathname === `${entry.href}/`;
  return pathname === entry.href || pathname.startsWith(`${entry.href}/`);
}

export async function AccountNav({
  locale,
  pathname,
  entitlements,
}: {
  locale: Locale;
  /** Путь без префикса локали: `/account/wallet`. */
  pathname: string;
  entitlements: Record<FeatureKey, boolean>;
}) {
  const t = await getTranslations({ locale });

  const visible = entries.filter((entry) => !entry.feature || entitlements[entry.feature]);
  if (visible.length === 0) return null;

  return (
    <nav aria-label={t('account.title')} className="mt-6">
      <ul className="flex flex-wrap gap-1.5">
        {visible.map((entry) => {
          const active = isActive(pathname, entry);
          return (
            <li key={entry.href}>
              <Link
                href={entry.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center rounded-full border px-3.5 py-1.5 text-body-sm transition-colors duration-normal ease-brand',
                  active
                    ? 'border-accent bg-accent-soft font-semibold text-content-accent'
                    : 'border-border-default text-content-secondary hover:border-border-strong hover:text-content-primary',
                )}
              >
                {/* Ключ собран из литерала в константе — проверяется i18n:check, не типами. */}
                {t(entry.labelKey as never)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
