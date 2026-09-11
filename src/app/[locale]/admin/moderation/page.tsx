/**
 * МОДЕРАЦИЯ — очередь решений: отзывы, профили инструкторов, площадки.
 *
 * Не таблица, а карточки: модератору нужно прочитать текст целиком, а не увидеть
 * первые сорок символов в ячейке. Решение принимается по содержанию.
 *
 * Три очереди — три вкладки в URL (`?tab=`), потому что ссылку на «отклонённые
 * отзывы» пересылают коллеге, а после решения страница обновляется и элемент
 * уходит из очереди.
 */

import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ModerationActions } from '@/components/admin/moderation-actions';
import { EmptyState } from '@/components/ui/empty-state';
import { routes } from '@/config';
import { moderationStatusLabelKey, moderationStatuses } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { getRootTranslate } from '@/i18n/translate';
import { adminAccess } from '@/server/admin/access';
import { listModerationQueue, type ModerationTab } from '@/server/admin/operations';
import { parseAdminQuery } from '@/server/admin/query-params';
import { AccessDenied } from '@/components/ui/access-denied';
import { cn } from '@/lib/utils';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const tabs: readonly { id: ModerationTab; labelKey: 'reviewsTab' | 'instructorsTab' | 'venuesTab' }[] = [
  { id: 'reviews', labelKey: 'reviewsTab' },
  { id: 'instructors', labelKey: 'instructorsTab' },
  { id: 'venues', labelKey: 'venuesTab' },
];

export default async function AdminModerationPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const { can } = await adminAccess();
  if (!can('reviews.moderate') && !can('content.moderate')) return <AccessDenied />;

  const query = parseAdminQuery(await searchParams);
  const tab: ModerationTab = tabs.some((item) => item.id === query.tab)
    ? (query.tab as ModerationTab)
    : 'reviews';

  const { items, total } = await listModerationQueue(tab, query);

  const t = await getTranslations('admin.moderation');
  const tRoot = await getRootTranslate();
  const format = await getFormatter();

  return (
    <>
      <AdminPageHeader titleKey="admin.moderation.title" subtitleKey="admin.moderation.subtitle" />

      <div className="flex flex-col gap-6">
        <nav aria-label={t('title')} className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <Link
              key={item.id}
              href={routes.adminModeration({ tab: item.id, ...(query.status ? { status: query.status } : {}) })}
              aria-current={tab === item.id ? 'page' : undefined}
              className={cn(
                'text-button rounded-full px-4 py-2 transition-colors duration-fast',
                tab === item.id
                  ? 'bg-accent text-content-on-accent'
                  : 'bg-surface-sunken text-content-secondary hover:text-content-primary',
              )}
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>

        <nav aria-label={tRoot('admin.list.statusLabel')} className="flex flex-wrap gap-3">
          {moderationStatuses.map((status) => (
            <Link
              key={status}
              href={routes.adminModeration({ tab, status })}
              className={cn(
                'text-caption uppercase underline-offset-4 hover:underline',
                (query.status ?? 'PENDING') === status ? 'text-content-accent' : 'text-content-tertiary',
              )}
            >
              {tRoot(moderationStatusLabelKey(status))}
            </Link>
          ))}
        </nav>

        {items.length === 0 ? (
          <EmptyState title={t('empty')} />
        ) : (
          <ul className="flex flex-col gap-4">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 rounded-lg border border-border-default bg-surface-card p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="text-card-title text-content-primary">{item.title}</p>
                  {item.rating !== null ? (
                    <p className="text-body-sm text-content-secondary">
                      {format.number(item.rating, 'rating')}
                    </p>
                  ) : null}
                  {item.createdAt ? (
                    <time dateTime={item.createdAt} className="text-caption text-content-tertiary">
                      {format.dateTime(new Date(item.createdAt), 'mediumDate')}
                    </time>
                  ) : null}
                </div>

                {item.target ? (
                  <p className="text-caption text-content-tertiary">
                    {t('targetLabel')}: {item.target}
                  </p>
                ) : null}

                <p className="text-body-sm whitespace-pre-line text-content-secondary">{item.body}</p>

                <ModerationActions kind={tab} id={item.id} />
              </li>
            ))}
          </ul>
        )}

        <p className="text-body-sm text-content-secondary">
          {tRoot('admin.list.resultsCount', { count: total })}
        </p>
      </div>
    </>
  );
}
