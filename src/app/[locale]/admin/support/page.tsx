import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { SupportTicketActions } from '@/components/admin/support-ticket-actions';
import { StatGrid, type StatSpec } from '@/components/data/stat';
import { AccessDenied } from '@/components/ui/access-denied';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { adminNavigation, routes } from '@/config';
import { support } from '@/config/security';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { getRootTranslate } from '@/i18n/translate';
import { adminAccess } from '@/server/admin/access';
import { getDashboardStats } from '@/server/admin/dashboard';
import { listAuditLog } from '@/server/admin/people';
import { getSupportSummary } from '@/server/admin/support';

interface PageProps { params: Promise<{ locale: string }> }

export default async function AdminSupportPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const { caller, capabilities, can } = await adminAccess();
  if (!can('support.manage')) return <AccessDenied />;

  const [stats, supportSummary, audit] = await Promise.all([
    getDashboardStats(capabilities),
    getSupportSummary(),
    listAuditLog({ page: 1 }),
  ]);
  const t = await getTranslations('admin.support');
  const tRoot = await getRootTranslate();
  const format = await getFormatter();

  const shortcuts = adminNavigation
    .flatMap((group) => group.items)
    .filter((item) => !item.capability || can(item.capability));

  const statItems: readonly StatSpec[] = [
    { labelKey: 'admin.dashboard.stats.users', value: stats.users, kind: 'count' },
    { labelKey: 'admin.dashboard.stats.bookings', value: stats.bookings, kind: 'count' },
    { labelKey: 'admin.dashboard.stats.orders', value: stats.orders, kind: 'count' },
    { labelKey: 'admin.support.openTickets', value: supportSummary.open, kind: 'count' },
    { labelKey: 'admin.support.pendingTickets', value: supportSummary.pending, kind: 'count' },
    { labelKey: 'admin.support.resolvedToday', value: supportSummary.resolvedToday, kind: 'count' },
  ];

  return (
    <>
      <AdminPageHeader titleKey="admin.support.title" subtitleKey="admin.support.subtitle" />

      <section className="mb-8 rounded-2xl border border-accent/25 bg-accent-soft/30 p-5 shadow-sm" aria-labelledby="support-owner">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-label uppercase tracking-wide text-content-accent">{t('operatorMode')}</p>
            <h2 id="support-owner" className="mt-1 text-card-title text-content-primary">{t('godModeActive')}</h2>
            <p className="mt-1 text-body-sm text-content-secondary">{caller.name} · {caller.email}</p>
          </div>
          <Badge variant="success" size="md">{t('allCapabilities')}</Badge>
        </div>
        <p className="mt-4 max-w-(--layout-prose-max-width) text-caption text-content-secondary">
          {t('ownerNotice', { email: support.ownerEmail })}
        </p>
      </section>

      <StatGrid items={statItems} />

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-border-default bg-surface-card p-4 shadow-sm sm:p-6" aria-labelledby="support-queue">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 id="support-queue" className="text-card-title text-content-primary">{t('queueTitle')}</h2><p className="mt-1 text-caption text-content-secondary">{t('queueHint')}</p></div>
            <Button asChild size="sm" variant="outline"><Link href={routes.contact()}>{t('openContactPage')}</Link></Button>
          </div>
          {supportSummary.tickets.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border-default p-6 text-center text-body-sm text-content-secondary">{t('emptyQueue')}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border-default">
              <Table>
                <TableHeader><TableRow><TableHead>{t('requester')}</TableHead><TableHead>{t('topic')}</TableHead><TableHead>{t('received')}</TableHead><TableHead>{t('actions')}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {supportSummary.tickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell><p className="font-semibold text-content-primary">{ticket.name}</p><p className="text-caption text-content-tertiary">{ticket.email}</p></TableCell>
                      <TableCell><Link href={routes.adminOperatorTool('tickets', { id: ticket.id })} className="text-content-accent hover:underline"><Badge variant={ticket.status === 'PENDING' ? 'warning' : 'signal'} size="sm">{t(`status.${ticket.status.toLowerCase()}` as 'status.open')}</Badge></Link><p className="mt-1 max-w-56 truncate text-caption text-content-secondary">{ticket.message}</p></TableCell>
                      <TableCell className="whitespace-nowrap text-caption text-content-secondary">{format.dateTime(ticket.createdAt, 'bookingStamp')}</TableCell>
                      <TableCell><SupportTicketActions id={ticket.id} status={ticket.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border-default bg-surface-card p-4 shadow-sm sm:p-6" aria-labelledby="support-tools">
          <div className="mb-4 flex items-center justify-between gap-3"><div><h2 id="support-tools" className="text-card-title text-content-primary">{t('toolsTitle')}</h2><p className="mt-1 text-caption text-content-secondary">{t('toolsHint')}</p></div><Link className="text-caption font-semibold text-content-accent hover:underline" href={routes.adminAuditLog()}>{t('viewAudit')}</Link></div>
          <div className="grid gap-2 sm:grid-cols-2">
            {shortcuts.map((item) => <Link key={item.href} href={item.href} className="rounded-xl border border-border-subtle px-3 py-3 text-body-sm font-semibold text-content-primary transition-colors hover:border-accent hover:bg-accent-soft/30">{tRoot(item.labelKey)}</Link>)}
            {(['database', 'translations', 'sessions', 'operations', 'access', 'terminal', 'features'] as const).map((tool) => <Link key={tool} href={routes.adminOperatorTool(tool)} className="rounded-xl border border-accent/25 bg-accent-soft/20 px-3 py-3 text-body-sm font-semibold text-content-accent transition-colors hover:border-accent hover:bg-accent-soft/40">{t(`${tool}Title` as 'databaseTitle')}</Link>)}
          </div>
        </section>
      </div>

      <section className="mt-8 rounded-2xl border border-border-default bg-surface-card p-4 shadow-sm sm:p-6" aria-labelledby="support-audit">
        <div className="mb-4 flex items-center justify-between gap-3"><h2 id="support-audit" className="text-card-title text-content-primary">{t('recentActivity')}</h2><Link className="text-caption font-semibold text-content-accent hover:underline" href={routes.adminAuditLog()}>{t('viewAudit')}</Link></div>
        <div className="divide-y divide-border-subtle">
          {audit.rows.slice(0, 8).map((row) => <div key={String(row.id)} className="flex flex-wrap items-center justify-between gap-2 py-3"><span className="font-mono text-caption text-content-primary">{String(row.action)}</span><span className="text-caption text-content-tertiary">{String(row.actorEmail)} · {row.createdAt ? format.dateTime(new Date(String(row.createdAt)), 'bookingStamp') : '—'}</span></div>)}
        </div>
      </section>
    </>
  );
}
