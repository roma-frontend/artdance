import 'server-only';

import { adminResourceSpecs } from '@/config/admin';
import { features } from '@/config/features';
import { getServerEnv } from '@/config/env';
import { operatorEditableModels, operatorExportLimit, operatorPageSize } from '@/config/operator';
import { routes } from '@/config/routes';
import { domainErrors } from '@/domain/errors';
import { flattenMessages, jsonSafe, messageParameters, messageTags, redactRecord, secretFields } from '@/domain/operator';
import { locales, type Locale } from '@/i18n/config';
import { messageLoaders } from '@/i18n/messages';
import { db } from '@/lib/db';
import { requireOperator } from '@/lib/auth/guards';
import { defineQuery } from '@/server/query';

export interface OperatorDelegate {
  findMany(args: object): Promise<Record<string, unknown>[]>;
  findUnique(args: object): Promise<Record<string, unknown> | null>;
  count(args: object): Promise<number>;
  create(args: object): Promise<Record<string, unknown>>;
  update(args: object): Promise<Record<string, unknown>>;
  delete(args: object): Promise<Record<string, unknown>>;
}

interface RuntimeField { name: string; kind: string; type: string; isRequired: boolean; isList: boolean; hasDefaultValue?: boolean }
interface RuntimeModel { name: string; fields: RuntimeField[] }

function runtimeModels(): RuntimeModel[] {
  const models = (db as unknown as { _runtimeDataModel?: { models?: Record<string, RuntimeModel> } })._runtimeDataModel?.models;
  return Object.entries(models ?? {}).map(([name, model]) => ({ ...model, name }));
}

export function operatorModels() {
  // Authentication secrets are never browseable. Session management has its
  // own explicit select, and runtime settings have purpose-built editors.
  return runtimeModels().filter((m) => !['Account', 'VerificationToken', 'Session', 'PushSubscription', 'OperatorSetting'].includes(m.name));
}

export function operatorModel(name: string) {
  const model = operatorModels().find((m) => m.name === name);
  if (!model) throw domainErrors.validationFailed('model');
  return model;
}

export function operatorDelegate(name: string, client: unknown = db): OperatorDelegate {
  operatorModel(name);
  const delegate = (client as Record<string, OperatorDelegate | undefined>)[name.charAt(0).toLowerCase() + name.slice(1)];
  if (!delegate) throw domainErrors.validationFailed('model');
  return delegate;
}

export function modelFields(name: string) {
  return operatorModel(name).fields.filter((f) => f.kind !== 'object' && (!secretFields.has(f.name) || (f.name === 'value' && name !== 'OperatorSetting')));
}

export function editableFields(name: string) {
  if (!(operatorEditableModels as readonly string[]).includes(name)) return [];
  return modelFields(name).filter((f) => !['id', 'createdAt', 'updatedAt', 'clicks', 'deletedAt'].includes(f.name));
}

export function modelFormSpec(name: string) {
  return editableFields(name).map((f) => ({
    name: f.name, type: f.type, required: f.isRequired && !f.hasDefaultValue, list: f.isList,
    options: undefined,
  }));
}

export function modelWorkflow(name: string, id?: string): string | undefined {
  const resource = Object.values(adminResourceSpecs).find((s) => s.model === name);
  if (resource) return id ? (name === 'User' ? routes.adminUser(id) : routes.adminResourceEdit(resource.id, id)) : routes.adminResource(resource.id);
  if (name === 'Booking') return id ? routes.adminBooking(id) : routes.adminBookings();
  if (name === 'Order') return id ? routes.adminOrder(id) : routes.adminOrders();
  if (name === 'Payout') return routes.adminPayouts();
  if (['Payment', 'Refund'].includes(name)) return routes.adminOrders();
  if (['Review', 'Dispute', 'VerificationDocument'].includes(name)) return routes.adminModeration();
  return undefined;
}

export async function browseModel(name: string, q: string, page: number) {
  await requireOperator();
  const fields = modelFields(name);
  const searchFields = fields.filter((f) => f.type === 'String' && !f.isList).slice(0, 8);
  const where = q ? { OR: searchFields.map((f) => ({ [f.name]: { contains: q, mode: 'insensitive' } })) } : {};
  const select = Object.fromEntries(fields.map((f) => [f.name, true]));
  const order = fields.find((f) => f.name === 'createdAt')?.name ?? fields.find((f) => f.name === 'id')?.name ?? fields[0]?.name ?? 'id';
  const delegate = operatorDelegate(name);
  const [rows, total] = await Promise.all([
    delegate.findMany({ where, select, orderBy: { [order]: 'desc' }, skip: (page - 1) * operatorPageSize, take: operatorPageSize }),
    delegate.count({ where }),
  ]);
  return { rows: jsonSafe(rows.map((r) => redactRecord(r, name))) as Record<string, unknown>[], total, fields: fields.map((f) => f.name) };
}

export async function exportModel(name: string) {
  await requireOperator();
  const delegate = operatorDelegate(name);
  const count = await delegate.count({});
  if (count > operatorExportLimit) throw domainErrors.validationFailed('exportTooLarge');
  const fields = modelFields(name);
  const rows: Record<string, unknown>[] = [];
  // Stable ordered pagination: exports never quietly stop at the first page.
  const order = fields.some((f) => f.name === 'id') ? 'id' : fields[0]?.name ?? 'id';
  for (let skip = 0; skip < count; skip += 500) {
    rows.push(...await delegate.findMany({ select: Object.fromEntries(fields.map((f) => [f.name, true])), orderBy: { [order]: 'asc' }, skip, take: 500 }));
  }
  return jsonSafe(rows.map((r) => redactRecord(r, name))) as Record<string, unknown>[];
}

export async function translationCatalog(q: string, page: number) {
  await requireOperator();
  const bundles = await Promise.all(locales.map(async (locale) => ({ locale, values: flattenMessages((await messageLoaders[locale]()).default) })));
  const all = bundles.find((b) => b.locale === 'en')!.values;
  const matches = Object.keys(all).filter((key) => !q || key.toLowerCase().includes(q.toLowerCase()) || bundles.some((b) => b.values[key]?.toLowerCase().includes(q.toLowerCase())));
  const keys = matches.slice((page - 1) * operatorPageSize, page * operatorPageSize);
  const overrides = await db.operatorSetting.findMany({ where: { key: { startsWith: 'i18n.' } } });
  const byKey = new Map(overrides.map((o) => [o.key, o.value]));
  return { total: matches.length, rows: keys.map((key) => ({ key, values: Object.fromEntries(locales.map((locale) => {
    const override = byKey.get(`i18n.${locale}.${key}`);
    return [locale, { text: typeof override === 'string' ? override : bundles.find((b) => b.locale === locale)!.values[key], overridden: typeof override === 'string' }];
  })) as Record<Locale, { text: string; overridden: boolean }> })) };
}

export async function validateTranslation(key: string, locale: Locale, value: string) {
  const base = flattenMessages((await messageLoaders[locale]()).default)[key];
  if (!base || JSON.stringify(messageParameters(base)) !== JSON.stringify(messageParameters(value)) || JSON.stringify(messageTags(base)) !== JSON.stringify(messageTags(value))) throw domainErrors.validationFailed('translation');
  /* The same parameter/tag invariants as the repository i18n check are the
   * safety boundary here; rendering remains owned by next-intl at request time. */
}

export const getUiOverrides = defineQuery({
  name: 'operator-ui-overrides', tags: () => ['operator-i18n'], revalidate: 300,
  handler: async (locale: Locale) => db.operatorSetting.findMany({ where: { key: { startsWith: `i18n.${locale}.` } }, select: { key: true, value: true } }),
});

export async function operatorPulse() {
  await requireOperator();
  const since = new Date(Date.now() - 86400000);
  const [sessions, failedPayments, failedNotifications, failedWebhooks, openTickets, activity, jobs, locked] = await Promise.all([
    db.session.count({ where: { expiresAt: { gt: new Date() } } }),
    db.payment.count({ where: { status: 'FAILED', createdAt: { gte: since } } }),
    db.notification.count({ where: { status: 'FAILED', createdAt: { gte: since } } }),
    db.webhookEvent.count({ where: { status: 'FAILED', receivedAt: { gte: since } } }),
    db.supportTicket.count({ where: { status: { in: ['OPEN', 'PENDING'] } } }),
    db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, action: true, actorEmail: true, entityType: true, entityId: true, createdAt: true } }),
    db.jobRun.findMany({ orderBy: { startedAt: 'desc' }, take: 10 }),
    db.loginAttempt.findMany({ where: { lockedUntil: { gt: new Date() } }, take: 25, select: { identifier: true, failures: true, lockedUntil: true } }),
  ]);
  const env = getServerEnv();
  return { sessions, failedPayments, failedNotifications, failedWebhooks, openTickets, activity, jobs, locked, services: { email: !!env.RESEND_API_KEY, media: !!env.R2_BUCKET, payments: env.PAYMENT_PROVIDER, cron: !!env.CRON_SECRET }, features };
}

export async function globalOperatorSearch(q: string) {
  await requireOperator();
  if (q.length < 2) return [];
  const contains = { contains: q, mode: 'insensitive' as const };
  const [users, bookings, orders, classes, venues, tickets] = await Promise.all([
    db.user.findMany({ where: { OR: [{ id: q }, { email: contains }, { name: contains }] }, take: 5, select: { id: true, name: true, email: true } }),
    db.booking.findMany({ where: { OR: [{ id: q }, { reference: contains }] }, take: 5, select: { id: true, reference: true } }),
    db.order.findMany({ where: { OR: [{ id: q }, { orderNumber: contains }] }, take: 5, select: { id: true, orderNumber: true } }),
    db.danceClass.findMany({ where: { OR: [{ id: q }, { title: contains }, { slug: contains }] }, take: 5, select: { id: true, title: true } }),
    db.venue.findMany({ where: { OR: [{ id: q }, { name: contains }, { slug: contains }] }, take: 5, select: { id: true, name: true } }),
    db.supportTicket.findMany({ where: { OR: [{ id: q }, { email: contains }, { message: contains }] }, take: 5, select: { id: true, name: true } }),
  ]);
  return [
    ...users.map((u) => ({ label: `${u.name} · ${u.email}`, href: routes.adminUser(u.id), kind: 'users' as const })),
    ...bookings.map((b) => ({ label: b.reference, href: routes.adminBooking(b.id), kind: 'bookings' as const })),
    ...orders.map((o) => ({ label: o.orderNumber, href: routes.adminOrder(o.id), kind: 'orders' as const })),
    ...classes.map((c) => ({ label: c.title, href: routes.adminResourceEdit('classes', c.id), kind: 'classes' as const })),
    ...venues.map((v) => ({ label: v.name, href: routes.adminResourceEdit('venues', v.id), kind: 'venues' as const })),
    ...tickets.map((t) => ({ label: t.name, href: routes.adminOperatorTool('tickets', { id: t.id }), kind: 'tickets' as const })),
  ];
}
