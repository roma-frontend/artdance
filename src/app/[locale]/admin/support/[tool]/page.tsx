import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { FeatureFlagButton, JobButton, OperatorTerminal, SessionRevokeButton, TicketReplyForm, TranslationEditor } from '@/components/admin/operator-actions';
import { AccessDenied } from '@/components/ui/access-denied';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { browseModel, getOperatorCounts, operatorModels, translationCatalog } from '@/server/admin/operator';
import { features } from '@/config/features';
import { adminAccess } from '@/server/admin/access';
import { db } from '@/lib/db';
import { routes } from '@/config';
import { Link } from '@/i18n/routing';
import type { Locale } from '@/i18n/config';
import { getCaller } from '@/lib/auth/guards';
import { isEntitlementOwner } from '@/config/security';
import { EntitlementsPanel } from '@/components/admin/entitlements-panel';
import { getEntitlementsState, resolveEffectiveEnabled } from '@/server/entitlements/service';
import { entitlementFeatureCatalog, presetDefaults } from '@/server/entitlements/catalog';

interface PageProps { params: Promise<{ locale: string; tool: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }
const text = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? '' : value ?? '';

export default async function OperatorToolPage({ params, searchParams }: PageProps) {
  const { locale, tool } = await params;
  const query = await searchParams;
  setRequestLocale(locale as Locale);
  const { can } = await adminAccess();
  if (!can('support.manage')) return <AccessDenied />;
  const t = await getTranslations('admin.support');
  const format = await getFormatter();
  const back = <Button asChild variant="ghost" size="sm"><Link href={routes.adminSupport()}>{t('toolBack')}</Link></Button>;

  if (tool === 'database') {
    const models = operatorModels();
    const q = text(query.q);
    const page = Math.max(Number(text(query.page)) || 1, 1);
    const requested = text(query.model);
    const initialModel = (requested && models.some((m) => m.name === requested) ? requested : models[0]?.name) ?? null;
    const [counts, payload] = await Promise.all([
      getOperatorCounts(),
      initialModel ? browseModel(initialModel, q, page).then((data) => ({ fields: data.fields, rows: data.rows as Array<Record<string, unknown> & { id: string }>, total: data.total })).catch(() => ({ fields: [], rows: [], total: 0 }) as { fields: string[]; rows: Array<Record<string, unknown> & { id: string }>; total: number }) : Promise.resolve(null as { fields: string[]; rows: Array<Record<string, unknown> & { id: string }>; total: number } | null),
    ]);
    const { DataBrowserClient } = await import('@/components/superadmin/data-browser-client');
    return <DataBrowserClient models={counts} initialModel={initialModel} initialQuery={q} initialPage={page} payload={payload} />;
  }

  if (tool === 'translations') {
    const data = await translationCatalog(text(query.q), Math.max(Number(text(query.page)) || 1, 1));
    return <><AdminPageHeader title={t('translationsTitle')} subtitle={t('translationsHint')} actions={back} /><form className="mb-6 flex gap-2"><Input name="q" defaultValue={text(query.q)} placeholder={t('translationSearch')} /><Button type="submit" variant="outline">{t('translationSearch')}</Button></form><div className="flex flex-col gap-3">{data.rows.map((row) => <div key={row.key} className="rounded-xl border border-border-default bg-surface-card p-4"><p className="mb-3 text-caption text-content-secondary">{row.key}</p><TranslationEditor row={row} /></div>)}</div></>;
  }

  if (tool === 'sessions') {
    const sessions = await db.session.findMany({ where: { expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, userId: true, ipAddress: true, userAgent: true, createdAt: true, expiresAt: true, user: { select: { name: true, email: true, role: true } } } });
    return <><AdminPageHeader title={t('sessionsTitle')} subtitle={t('sessionsHint')} actions={back} /><div className="overflow-x-auto rounded-xl border border-border-default bg-surface-card"><Table><TableHeader><TableRow><TableHead>{t('sessionUser')}</TableHead><TableHead>{t('sessionCreated')}</TableHead><TableHead>{t('sessionExpires')}</TableHead><TableHead>{t('actions')}</TableHead></TableRow></TableHeader><TableBody>{sessions.map((session) => <TableRow key={session.id}><TableCell><p className="font-semibold">{session.user.name}</p><p className="text-caption text-content-tertiary">{session.user.email} · {session.ipAddress ?? '—'}</p></TableCell><TableCell className="text-caption">{format.dateTime(session.createdAt, 'bookingStamp')}</TableCell><TableCell className="text-caption">{format.dateTime(session.expiresAt, 'bookingStamp')}</TableCell><TableCell><SessionRevokeButton id={session.id} /></TableCell></TableRow>)}</TableBody></Table></div></>;
  }

  if (tool === 'tickets') {
    const ticketId = text(query.id);
    const ticket = ticketId ? await db.supportTicket.findUnique({ where: { id: ticketId }, select: { id: true, name: true, email: true, topic: true, message: true, locale: true, status: true, createdAt: true, replies: { orderBy: { createdAt: 'asc' }, select: { id: true, body: true, internal: true, delivered: true, createdAt: true, actorId: true } } } }) : null;
    if (!ticket) return <><AdminPageHeader title={t('queueTitle')} subtitle={t('queueHint')} actions={back} /><p className="text-body-sm text-content-secondary">{t('emptyQueue')}</p></>;
    return <><AdminPageHeader title={ticket.name} subtitle={`${ticket.email} · ${ticket.topic}`} actions={back} /><div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]"><section className="rounded-2xl border border-border-default bg-surface-card p-5"><div className="mb-6 flex items-center justify-between gap-3"><Badge variant={ticket.status === 'PENDING' ? 'warning' : ticket.status === 'RESOLVED' ? 'success' : 'signal'}>{t(`status.${ticket.status.toLowerCase()}` as 'status.open')}</Badge><span className="text-caption text-content-tertiary">{format.dateTime(ticket.createdAt, 'bookingStamp')}</span></div><p className="whitespace-pre-wrap text-body-sm text-content-primary">{ticket.message}</p><div className="mt-8 border-t border-border-subtle pt-6"><h2 className="mb-3 text-card-title">{t('repliesTitle')}</h2><div className="flex flex-col gap-3">{ticket.replies.map((reply) => <div key={reply.id} className="rounded-xl border border-border-subtle p-3"><div className="mb-1 flex items-center justify-between gap-2"><Badge variant={reply.internal ? 'warning' : 'neutral'} size="sm">{reply.internal ? t('internalNote') : t('replyLabel')}</Badge><span className="text-caption text-content-tertiary">{format.dateTime(reply.createdAt, 'bookingStamp')}</span></div><p className="whitespace-pre-wrap text-body-sm">{reply.body}</p></div>)}</div></div></section><section className="rounded-2xl border border-border-default bg-surface-card p-5"><h2 className="mb-3 text-card-title">{t('replyTitle')}</h2><TicketReplyForm ticketId={ticket.id} /></section></div></>;
  }

  if (tool === 'features') {
    const overrides = await db.featureFlagOverride.findMany({ select: { key: true, enabled: true } });
    const overrideMap = new Map(overrides.map((item) => [item.key, item.enabled]));
    return <><AdminPageHeader title={t('featuresTitle')} subtitle={t('featuresHint')} actions={back} /><div className="grid gap-3 sm:grid-cols-2">{Object.entries(features).map(([key, defaultValue]) => { const enabled = overrideMap.get(key) ?? defaultValue; return <div key={key} className="flex items-center justify-between gap-3 rounded-xl border border-border-default bg-surface-card p-4"><div><p className="font-mono text-body-sm text-content-primary">{key}</p><p className="text-caption text-content-tertiary">{overrideMap.has(key) ? t('flagOverride') : t('flagDefault')}</p></div><FeatureFlagButton flag={key} enabled={enabled} /></div>; })}</div></>;
  }

  if (tool === 'operations') return <><AdminPageHeader title={t('operationsTitle')} subtitle={t('operationsHint')} actions={back} /><div className="grid gap-3 sm:grid-cols-2"><JobButton job="booking" /><JobButton job="holds" /><JobButton job="trash" /><JobButton job="digest" /></div></>;
  if (tool === 'terminal') return <><AdminPageHeader title={t('terminalTitle')} subtitle={t('terminalHint')} actions={back} /><OperatorTerminal /></>;
  if (tool === 'access') return <><AdminPageHeader title={t('accessTitle')} subtitle={t('accessHint')} actions={back} /><div className="flex flex-wrap gap-3"><Button asChild variant="accent"><Link href={routes.adminSettings()}>{t('openAccessSettings')}</Link></Button><Button asChild variant="outline"><Link href={routes.adminUsers()}>{t('impersonate')}</Link></Button></div></>;

  if (tool === 'entitlements') {
    const caller = await getCaller({ realActor: true });
    const isOwner = !!caller && isEntitlementOwner(caller);
    if (!isOwner) return <AccessDenied />;
    const state = await getEntitlementsState();
    const rows = entitlementFeatureCatalog.map((meta) => {
      const presetValue = state.preset ? (presetDefaults[state.preset][meta.key as keyof typeof presetDefaults.mvp] ?? false) : false;
      const overridden = state.overrides.has(meta.key as never);
      const effective = resolveEffectiveEnabled(state.preset, state.overrides, meta.key as never);
      return { meta, presetValue, effective, overridden };
    });
    const timeline = await db.auditLog.findMany({
      where: { action: { in: ['admin.entitlement.preset', 'admin.entitlement.override', 'admin.entitlement.overrideReset', 'admin.entitlement.reset'] } },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { id: true, action: true, actorEmail: true, createdAt: true, diff: true },
    });
    return <><AdminPageHeader title={t('entitlementsTitle')} subtitle={t('entitlementsHint')} actions={back} /><EntitlementsPanel preset={state.preset} rows={rows} timeline={timeline} /></>;
  }

  return <><AdminPageHeader title={t('title')} subtitle={t('subtitle')} actions={back} /><p className="text-body-sm text-content-secondary">{t('emptyQueue')}</p></>;
}


