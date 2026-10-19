import 'server-only';

import { revalidatePath } from 'next/cache';

import { mediaUrl } from '@/config/media';
import { db } from '@/lib/db';
import { browseModel, getOperatorCounts, globalOperatorSearch, modelFields, operatorDelegate, operatorModelName, operatorModels } from '@/server/admin/operator';
import { operatorPulse } from '@/server/admin/operator';
import { isTrashedModel } from '@/config/trash';
import { onlyTrashed } from '@/domain/trash';
import { recordAudit } from '@/lib/audit';
import { requireOperator } from '@/lib/auth/guards';
import { cartStats, purgeEmptyCarts } from '@/server/cart/service';
import { formatInspect, inspectOperatorRecord } from '@/server/admin/inspect';
import { redactRecord } from '@/domain/operator';
import { terminalCommands } from './registry';

function helpLines(): string[] {
  return ['Available commands:', ...terminalCommands.map((c) => `  ${c.usage.padEnd(48)} — ${c.description}`), '', 'Tip: Tab — autocomplete, Arrow Up/Down — history, Enter — run.'];
}

function parseFlags(args: string[]): { flags: Map<string, string | true>; positional: string[] } {
  const flags = new Map<string, string | true>();
  const positional: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i]!;
    if (a.startsWith('--')) {
      const key = a.slice(2).toLowerCase();
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags.set(key, next);
        i += 1;
      } else {
        flags.set(key, true);
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

function parseOlderThan(raw: string | true | undefined): number | null {
  if (!raw || raw === true) return null;
  const m = String(raw).trim().match(/^(\d+)\s*d$/i);
  if (!m) return null;
  return Number(m[1]);
}

async function handleHealth(): Promise<string[]> {
  const pulse = await operatorPulse();
  return [
    `sessions: ${pulse.sessions}`,
    `open tickets: ${pulse.openTickets}`,
    `failed payments (24h): ${pulse.failedPayments}`,
    `failed notifications (24h): ${pulse.failedNotifications}`,
    `failed webhooks (24h): ${pulse.failedWebhooks}`,
    `services: email=${pulse.services.email ? 'ok' : '—'} media=${pulse.services.media ? 'ok' : '—'} payments=${pulse.services.payments} cron=${pulse.services.cron ? 'ok' : '—'}`,
  ];
}

async function handleCounts(): Promise<string[]> {
  const pulse = await operatorPulse();
  return [`active sessions: ${pulse.sessions}`, `locked login keys: ${pulse.locked.length}`, `open tickets: ${pulse.openTickets}`];
}

async function handleJobs(args: string[]): Promise<string[]> {
  const n = Math.min(50, Math.max(1, Number(args[0] ?? 10) || 10));
  const pulse = await operatorPulse();
  const jobs = pulse.jobs.slice(0, n);
  if (jobs.length === 0) return ['no jobs'];
  return jobs.map((job) => `${job.jobName} · ${job.succeeded === false ? 'failed' : job.succeeded === true ? 'ok' : 'running'} · ${job.startedAt.toISOString()}`);
}

async function handleInspect(args: string[]): Promise<string[]> {
  const model = args[0]?.trim();
  const key = args[1]?.trim();
  if (!model || !key) return ['usage: inspect <User|Order|Booking|SupportTicket> <id|email|number|reference>'];
  const result = await inspectOperatorRecord(model, key);
  if (!result) return [`not found: ${model} ${key}`];
  return formatInspect(result);
}

async function handleSearch(args: string[]): Promise<string[]> {
  const query = args.join(' ').trim();
  if (query.length < 2) return ['usage: search <email|id|name|reference|text> (minimum 2 characters)'];
  const results = await globalOperatorSearch(query);
  if (results.length === 0) return [`no matches for: ${query}`];
  return [
    `matches for: ${query}`,
    ...results.map((result) => `${result.kind.padEnd(10)} ${result.label} → ${result.href}`),
    '',
    'Tip: use inspect User|Order|Booking|SupportTicket <id|key> for a full support snapshot.',
  ];
}

async function handleDb(args: string[]): Promise<string[]> {
  const sub = (args[0] ?? '').toLowerCase();
  if (!sub || sub === 'help') {
     return [
       'db models                          — list models',
       'db counts [Model]                  — counts (all or one model)',
       'db count <Model> [--where JSON]     — exact count with filter',
       'db find <Model> [--where JSON] [--take N] [--q text] — first rows (max 25)',
       'db get <Model> <id>                — one row by id',
       'db fields <Model>                  — list writable fields',
       'db create <Model> --data JSON      — create row (returns id)',
       'db update <Model> <id> --set JSON  — patch row by id',
       'db delete <Model> <id> [--force] [--hard] — soft-delete (--hard purges)',
       'db restore <Model> <id>            — restore soft-deleted row',
       'db mutations support --dry-run     — preview without writing',
     ];
   }
  if (sub === 'models') {
    const models = operatorModels().map((m) => m.name).sort();
    return [models.join(', ')];
  }
  if (sub === 'counts') {
    const name = args[1]?.trim();
    if (name) {
      const delegate = operatorDelegate(name);
      const count = await delegate.count({});
      return [`${name}: ${count}`];
    }
    const counts = await getOperatorCounts();
    const sorted = [...counts].sort((a, b) => b.count - a.count);
    return sorted.map((c) => `${c.name.padEnd(28)} ${c.count}`);
  }
  if (sub === 'count') {
    const model = args[1]?.trim();
    if (!model) return ['usage: db count <Model> [--where JSON]'];
    const { flags } = parseFlags(args.slice(2));
    const whereRaw = flags.get('where');
    let where: Record<string, unknown> = {};
    if (typeof whereRaw === 'string') {
      try {
        where = JSON.parse(whereRaw) as Record<string, unknown>;
      } catch {
        return ['invalid --where JSON'];
      }
    }
    const delegate = operatorDelegate(model);
    const count = await delegate.count({ where });
    return [`${model}: ${count}`];
  }
  if (sub === 'find') {
    const model = args[1]?.trim();
    if (!model) return ['usage: db find <Model> [--where JSON] [--take N] [--q text]'];
    const { flags } = parseFlags(args.slice(2));
    const whereRaw = flags.get('where');
    const takeRaw = flags.get('take');
    const qRaw = flags.get('q');
    let where: Record<string, unknown> = {};
    if (typeof whereRaw === 'string') {
      try {
        where = JSON.parse(whereRaw) as Record<string, unknown>;
      } catch {
        return ['invalid --where JSON'];
      }
    }
    const take = Math.min(25, Math.max(1, Number(takeRaw ?? 5) || 5));
    const q = typeof qRaw === 'string' ? qRaw : '';
    const page = 1;
    const result = await browseModel(model, q, page);
    // Если передан where — делаем прямой findMany с where (browseModel не поддерживает произвольный where)
    if (Object.keys(where).length > 0) {
      const canonical = operatorModelName(model);
      const select = Object.fromEntries(modelFields(canonical).map((field) => [field.name, true]));
      const delegate = operatorDelegate(canonical);
      const rows = await delegate.findMany({ where, select, take, orderBy: { id: 'desc' } as never });
      if (rows.length === 0) return ['no rows'];
      return rows.map((r) => JSON.stringify(redactRecord(r, canonical)));
    }
    // Иначе используем browseModel (с секретами уже вырезаны)
    const rows = result.rows.slice(0, take);
    if (rows.length === 0) return ['no rows'];
    return rows.map((r) => JSON.stringify(r));
  }
  if (sub === 'get') {
    const model = args[1]?.trim(); const id = args[2]?.trim();
    if (!model || !id) return ['usage: db get <Model> <id>'];
    const BLOCKED = new Set(['Account','VerificationToken','Session','PushSubscription','OperatorSetting']);
    if (BLOCKED.has(model)) return ['model not available: ' + model];
    try {
      const canonical = operatorModelName(model);
      const select = Object.fromEntries(modelFields(canonical).map((field) => [field.name, true]));
      const d = operatorDelegate(canonical);
      const row = await d.findUnique({ where: { id }, select });
      if (!row) return ['not found: ' + canonical + ' ' + id];
      return [JSON.stringify(redactRecord(row, canonical))];
    } catch (e) { return ['error: ' + (e instanceof Error ? e.message.slice(0,400) : String(e).slice(0,400))]; }
  }
  if (sub === 'fields') {
    const model = args[1]?.trim(); if (!model) return ['usage: db fields <Model>'];
    const BLOCKED = new Set(['Account','VerificationToken','Session','PushSubscription','OperatorSetting']); if (BLOCKED.has(model)) return ['model not available: ' + model];
    try { const fields = modelFields(model); const SENS = new Set(['password','passwordHash','token','tokenHash','accessToken','refreshToken','idToken','secret','value','p256dh','auth','endpoint','providerPayload','rawPayload','payload','bankAccountIban','bankAccountNumber','accountNumber']); const IMM = new Set(['id','createdAt','updatedAt']); const lines = fields.map((f) => { const req = f.isRequired && !f.hasDefaultValue ? ' *' : ''; const lst = f.isList ? '[]' : ''; const mut = IMM.has(f.name) ? ' (immutable)' : SENS.has(f.name) ? ' (blocked)' : ''; return (f.name.padEnd(24) + ' ' + f.type + lst + req + mut); }); return [model + ' fields:', ...lines]; } catch (e) { return ['error: ' + (e instanceof Error ? e.message.slice(0,400) : String(e).slice(0,400))]; }
  }
  if (sub === 'create') {
    const model = args[1]?.trim(); if (!model) return ['usage: db create <Model> --data JSON'];
    const BLOCKED = new Set(['Account','VerificationToken','Session','PushSubscription','OperatorSetting']); if (BLOCKED.has(model)) return ['model not available: ' + model];
    const { flags } = parseFlags(args.slice(2)); const raw = flags.get('data');
    if (typeof raw !== 'string') return ['db create requires --data JSON  e.g. db create Banner --data {"key":"promo","title":"Hi"}'];
    let data; try { data = JSON.parse(raw); } catch { return ['invalid --data JSON']; }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return ['--data must be a JSON object'];
    const SENS = new Set(['password','passwordHash','token','tokenHash','accessToken','refreshToken','idToken','secret','value','p256dh','auth','endpoint','providerPayload','rawPayload','payload','bankAccountIban','bankAccountNumber','accountNumber']); const IMM = new Set(['id','createdAt','updatedAt']); const dropped: string[] = []; const patch: Record<string, unknown> = {}; for (const [k,v] of Object.entries(data as Record<string, unknown>)) { if (SENS.has(k) || IMM.has(k) || ['__proto__','constructor','prototype'].includes(k)) { dropped.push(k); continue; } if (k === 'deletedAt') { dropped.push(k); continue; } patch[k]=v; }
    if (Object.keys(patch).length === 0) return ['nothing to create (all fields blocked/immutable)'];
    const createGuard = genericWriteGuard(model, patch); if (createGuard) return [createGuard];
    if (flags.has('dry-run')) return [`dry-run: create ${model}`, `  data: ${JSON.stringify(redactRecord(patch, model))}`, 'no changes were made'];
    let delegate; try { delegate = operatorDelegate(model); } catch { return ['unknown model: ' + model]; }
    try { const created = await delegate.create({ data: patch, select: { id: true } }); try { const caller = await requireOperator(); await recordAudit({ actor: caller, action: 'admin.database.create', entityType: model, entityId: String(created.id), after: patch, ipAddress: undefined }); } catch {} const tip = dropped.length ? ' (dropped: ' + dropped.join(', ') + ')' : ''; return ['created ' + model + ' ' + created.id + tip]; } catch (e) { return ['create failed: ' + (e instanceof Error ? e.message.slice(0,600) : String(e).slice(0,600))]; }
  }
  if (sub === 'update') {
    const model = args[1]?.trim(); const id = args[2]?.trim();
    if (!model || !id) return ['usage: db update <Model> <id> --set JSON   e.g. db update User <id> --set {"name":"New"}'];
    const BLOCKED = new Set(['Account','VerificationToken','Session','PushSubscription','OperatorSetting']); if (BLOCKED.has(model)) return ['model not available: ' + model];
    const { flags } = parseFlags(args.slice(3)); const raw = flags.get('set');
    if (typeof raw !== 'string') return ['db update requires --set JSON'];
    let data; try { data = JSON.parse(raw); } catch { return ['invalid --set JSON']; }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return ['--set must be a JSON object'];
    const SENS = new Set(['password','passwordHash','token','tokenHash','accessToken','refreshToken','idToken','secret','value','p256dh','auth','endpoint','providerPayload','rawPayload','payload','bankAccountIban','bankAccountNumber','accountNumber']); const dropped: string[] = []; const patch: Record<string, unknown> = {}; for (const [k,v] of Object.entries(data as Record<string, unknown>)) { if (k==='id' || k==='createdAt' || SENS.has(k) || ['__proto__','constructor','prototype'].includes(k)) { dropped.push(k); continue; } if (k==='deletedAt') { dropped.push(k); continue; } patch[k]=v; }
    if (Object.keys(patch).length === 0) return ['nothing to update' + (dropped.length ? ' (dropped: ' + dropped.join(', ') + ')' : '')];
    const updateGuard = genericWriteGuard(model, patch); if (updateGuard) return [updateGuard];
    let delegate; try { delegate = operatorDelegate(model); } catch { return ['unknown model: ' + model]; }
    try {
      const before = await delegate.findUnique({ where: { id } }).catch(() => null);
      if (!before) return ['not found: ' + model + ' ' + id];
      const after = { ...before, ...patch };
      if (flags.has('dry-run')) return dryRunLines('update', model, id, before, after);
      await delegate.update({ where: { id }, data: patch });
      try { const caller = await requireOperator(); const canonical = operatorModelName(model); await recordAudit({ actor: caller, action: 'admin.database.patch', entityType: canonical, entityId: id, before: redactRecord(before, canonical), after: redactRecord(after, canonical), ipAddress: undefined }); } catch {}
      const tip = dropped.length ? ' (dropped: ' + dropped.join(', ') + ')' : '';
      return ['updated ' + model + ' ' + id + tip];
    } catch (e) { return ['update failed: ' + (e instanceof Error ? e.message.slice(0,600) : String(e).slice(0,600))]; }
  }
  if (sub === 'delete') {
    const model = args[1]?.trim(); const id = args[2]?.trim();
    if (!model || !id) return ['usage: db delete <Model> <id> [--force] [--hard]'];
    const BLOCKED = new Set(['Account','VerificationToken','Session','PushSubscription','OperatorSetting']); if (BLOCKED.has(model)) return ['model not available: ' + model];
    const { flags } = parseFlags(args.slice(3)); if (!flags.has('force') && !flags.has('dry-run')) return ['refusing without --force. Re-run with --force to confirm. Add --hard to purge permanently (trashed models).'];
    const deleteGuard = genericWriteGuard(model); if (deleteGuard) return [deleteGuard];
    const hard = flags.has('hard'); let delegate; try { delegate = operatorDelegate(model); } catch { return ['unknown model: ' + model]; }
    try {
      const row = await delegate.findUnique({ where: { id } }).catch(() => null);
      if (!row) return ['not found: ' + model + ' ' + id];
      if (flags.has('dry-run')) return [`dry-run: ${hard ? 'purge' : 'delete'} ${model} ${id}`, 'no changes were made'];
      const canonical = operatorModelName(model);
      if (hard) { await delegate.delete({ where: { id } }); try { const caller = await requireOperator(); await recordAudit({ actor: caller, action: 'admin.database.delete', entityType: canonical, entityId: id, before: redactRecord(row, canonical), after: { hard: true }, ipAddress: undefined }); } catch {} return ['purged ' + canonical + ' ' + id]; }
      if (isTrashedModel(canonical)) { try { await delegate.update({ where: { id }, data: { deletedAt: new Date() }, select: { id: true } }); } catch { await delegate.delete({ where: { id } }); } try { const caller = await requireOperator(); await recordAudit({ actor: caller, action: 'admin.database.delete', entityType: canonical, entityId: id, before: redactRecord(row, canonical), after: { deletedAt: 'now' }, ipAddress: undefined }); } catch {} return ['deleted ' + canonical + ' ' + id + ' (soft \u2014 restore: db restore ' + canonical + ' ' + id + ')']; }
      await delegate.delete({ where: { id } }); try { const caller = await requireOperator(); await recordAudit({ actor: caller, action: 'admin.database.delete', entityType: canonical, entityId: id, before: redactRecord(row, canonical), after: { deleted: true }, ipAddress: undefined }); } catch {} return ['deleted ' + canonical + ' ' + id];
    } catch (e) { return ['delete failed: ' + (e instanceof Error ? e.message.slice(0,600) : String(e).slice(0,600))]; }
  }
  if (sub === 'restore') {
    const model = args[1]?.trim(); const id = args[2]?.trim();
    if (!model || !id) return ['usage: db restore <Model> <id>'];
    if (!isTrashedModel(model)) return [model + ' does not support restore (no deletedAt)'];
    const BLOCKED = new Set(['Account','VerificationToken','Session','PushSubscription','OperatorSetting']); if (BLOCKED.has(model)) return ['model not available: ' + model];
    const restoreGuard = genericWriteGuard(model); if (restoreGuard) return [restoreGuard];
    let delegate; try { delegate = operatorDelegate(model); } catch { return ['unknown model: ' + model]; }
    try { const row = await (delegate as unknown as { findFirst: (a: { where: Record<string, unknown>; select: Record<string, boolean> }) => Promise<Record<string, unknown> | null> }).findFirst({ where: { id, ...onlyTrashed }, select: { id: true } } as never).catch(() => null); if (!row) return ['not found in trash: ' + model + ' ' + id]; await (delegate as unknown as { update: (a: { where: { id: string }; data: Record<string, unknown>; select: { id: boolean } }) => Promise<unknown> }).update({ where: { id }, data: { deletedAt: null }, select: { id: true } }); try { const caller = await requireOperator(); await recordAudit({ actor: caller, action: 'admin.database.restore', entityType: model, entityId: id, ipAddress: undefined }); } catch {} return ['restored ' + model + ' ' + id]; } catch (e) { return ['restore failed: ' + (e instanceof Error ? e.message.slice(0,600) : String(e).slice(0,600))]; }
  }
  return [`unknown db subcommand: ${sub} — try: db help`];
}

async function handleCarts(args: string[]): Promise<string[]> {
  const sub = (args[0] ?? '').toLowerCase();
  if (!sub || sub === 'help') {
     return [
       'carts stats                                                   — carts summary',
       'carts purge --empty [--anon] [--older-than 7d] [--dry-run] [--force]',
       '  --empty       only empty (without CartItem)',
       '  --anon        only guest (anonymousId != null)',
       '  --older-than 7d  only older than N days (e.g. 7d)',
       '  --dry-run     show how many would be removed, do not remove',
       '  --force       execute deletion (without it — dry-run)',
       'Examples:',
       '  carts stats',
       '  carts purge --empty --dry-run',
       '  carts purge --empty --force',
       '  carts purge --empty --anon --older-than 7d --dry-run',
       '  carts purge --empty --anon --older-than 7d --force',
     ];
   }
  if (sub === 'stats') {
    const s = await cartStats();
    return [
      `total:       ${s.total}`,
      `with items:  ${s.withItems}`,
      `empty:       ${s.empty}`,
      `anon:        ${s.anon}  (empty: ${s.anonEmpty})`,
      `user:        ${s.user}  (empty: ${s.userEmpty})`,
      `expired:     ${s.expired}`,
    ];
  }
  if (sub === 'purge') {
    const { flags } = parseFlags(args.slice(1));
    const empty = flags.has('empty');
    const anonOnly = flags.has('anon');
    const olderThan = parseOlderThan(flags.get('older-than'));
    const dryRunFlag = flags.has('dry-run');
    const forceFlag = flags.has('force');

    if (!empty) return ['carts purge requires --empty (only empty carts). Add --dry-run to preview.'];

    // Без --force считаем dry-run (безопасно)
    const dryRun = !forceFlag || dryRunFlag;
    const res = await purgeEmptyCarts({
      anonOnly: anonOnly || false,
      olderThanDays: olderThan,
      dryRun,
    });
     if (dryRun) {
       return [`dry-run: ${res.deleted} carts would be removed (add --force to remove)`];
     }
     return [`removed ${res.deleted} carts`];
  }
  return [`unknown carts subcommand: ${sub} — try: carts help`];
}

function mediaLine(asset: { storageKey: string; purpose?: string | null; altText?: string | null }): string {
  const url = mediaUrl(asset.storageKey);
  const label = asset.purpose ? ` [${asset.purpose}]` : '';
  const alt = asset.altText ? ` alt="${asset.altText.slice(0, 60)}"` : '';
  return `${asset.storageKey}${label}${alt} → ${url}`;
}

async function handleClasses(args: string[]): Promise<string[]> {
  const { flags, positional } = parseFlags(args);
  const q = positional.join(' ').trim() || (typeof flags.get('q') === 'string' ? String(flags.get('q')) : '');
  const take = Math.min(25, Math.max(1, Number(flags.get('take') ?? 10) || 10));
  const where = q
    ? {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {};
  const rows = (await db.danceClass.findMany({
    where: where as never,
    select: {
      id: true,
      slug: true,
      title: true,
      style: true,
      level: true,
      price: true,
      isActive: true,
      media: { select: { storageKey: true, altText: true, purpose: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } as never },
    },
    orderBy: { createdAt: 'desc' } as never,
    take,
  })) as unknown as Array<{ id: string; slug: string; title: string; style: string; level: string; price: number; isActive: boolean; media: Array<{ storageKey: string; altText: string; purpose: string | null }> }>;
  if (rows.length === 0) return ['no classes — try: classes salsa  or  db find DanceClass --q salsa --take 5'];
   return rows.flatMap((r) => {
     const header = `${r.title} — /classes/${r.slug} — ${r.style} · ${r.level} · ${r.price}֏ · ${r.isActive ? 'active' : 'inactive'} — id ${r.id}`;
     const medias = r.media.length ? r.media.map(mediaLine) : ['(no media) — check the class admin / add an image'];
    return [header, ...medias, ''];
  });
}

async function handleInstructors(args: string[]): Promise<string[]> {
  const { flags, positional } = parseFlags(args);
  const q = positional.join(' ').trim() || (typeof flags.get('q') === 'string' ? String(flags.get('q')) : '');
  const take = Math.min(25, Math.max(1, Number(flags.get('take') ?? 10) || 10));
  const where = q
    ? { OR: [{ slug: { contains: q, mode: 'insensitive' } }, { headline: { contains: q, mode: 'insensitive' } }, { user: { name: { contains: q, mode: 'insensitive' } } }] }
    : {};
  const rows = (await db.instructorProfile.findMany({
    where: where as never,
    select: {
      id: true,
      slug: true,
      headline: true,
      isVerified: true,
      user: { select: { name: true } },
      media: { select: { storageKey: true, altText: true, purpose: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } as never },
    },
    take,
    orderBy: { createdAt: 'desc' } as never,
  })) as unknown as Array<{ id: string; slug: string; headline: string; isVerified: boolean; user: { name: string }; media: Array<{ storageKey: string; altText: string; purpose: string | null }> }>;
  if (rows.length === 0) return ['no instructors'];
  return rows.flatMap((r) => {
    const header = `${r.user.name} — /instructors/${r.slug} — ${r.headline} ${r.isVerified ? '✓' : ''} — id ${r.id}`;
    const medias = r.media.length ? r.media.map(mediaLine) : ['(no media)'];
    return [header, ...medias, ''];
  });
}

async function handleProducts(args: string[]): Promise<string[]> {
  const { flags, positional } = parseFlags(args);
  const q = positional.join(' ').trim() || (typeof flags.get('q') === 'string' ? String(flags.get('q')) : '');
  const take = Math.min(25, Math.max(1, Number(flags.get('take') ?? 10) || 10));
  const where = q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } }] } : {};
  const rows = (await db.product.findMany({
    where: where as never,
    select: {
      id: true,
      slug: true,
      title: true,
      basePrice: true,
      isActive: true,
      media: { select: { storageKey: true, altText: true, purpose: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } as never },
    },
    take,
    orderBy: { createdAt: 'desc' } as never,
  })) as unknown as Array<{ id: string; slug: string; title: string; basePrice: number; isActive: boolean; media: Array<{ storageKey: string; altText: string; purpose: string | null }> }>;
  if (rows.length === 0) return ['no products'];
  return rows.flatMap((r) => {
    const header = `${r.title} — /shop/${r.slug} — ${r.basePrice}֏ ${r.isActive ? 'active' : 'inactive'} — id ${r.id}`;
    const medias = r.media.length ? r.media.map(mediaLine) : ['(no media)'];
    return [header, ...medias, ''];
  });
}

async function handleMedia(args: string[]): Promise<string[]> {
  const model = args[0]?.trim();
  const idOrSlug = args[1]?.trim();
  if (!model || !idOrSlug) return ['usage: media <Model> <id|slug>   e.g. media DanceClass <id>  or  media DanceClass my-salsa-class'];
  const modelLower = model.toLowerCase();
  if (['danceclass', 'dance_class', 'class', 'classes'].includes(modelLower)) {
    const danceClass = (await db.danceClass.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] } as never,
      select: { id: true, slug: true, title: true, media: { select: { storageKey: true, altText: true, purpose: true, blurDataUrl: true, focalPoint: true } } },
    })) as unknown as { id: string; slug: string; title: string; media: Array<{ storageKey: string; altText: string; purpose: string | null }> } | null;
    if (!danceClass) return [`DanceClass not found: ${idOrSlug}`];
    if (!danceClass.media.length) return [`${danceClass.title} (${danceClass.slug}) — no media`];
    return [`${danceClass.title} — /classes/${danceClass.slug}`, ...danceClass.media.map(mediaLine)];
  }
  if (['product', 'products'].includes(modelLower)) {
    const product = (await db.product.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] } as never,
      select: { id: true, slug: true, title: true, media: { select: { storageKey: true, altText: true, purpose: true } } },
    })) as unknown as { id: string; slug: string; title: string; media: Array<{ storageKey: string; altText: string; purpose: string | null }> } | null;
    if (!product) return [`Product not found: ${idOrSlug}`];
    if (!product.media.length) return [`${product.title} — no media`];
    return [`${product.title} — /shop/${product.slug}`, ...product.media.map(mediaLine)];
  }
  if (['instructor', 'instructors', 'instructorprofile'].includes(modelLower)) {
    const profile = (await db.instructorProfile.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] } as never,
      select: { id: true, slug: true, headline: true, media: { select: { storageKey: true, altText: true, purpose: true } } },
    })) as unknown as { id: string; slug: string; headline: string; media: Array<{ storageKey: string; altText: string; purpose: string | null }> } | null;
    if (!profile) return [`Instructor not found: ${idOrSlug}`];
    if (!profile.media.length) return [`${profile.slug} — no media`];
    return [`${profile.slug}`, ...profile.media.map(mediaLine)];
  }
  if (['venue', 'venues', 'event', 'events'].includes(modelLower)) {
    return ['usage: media DanceClass <id|slug>  |  media Product <id|slug>  |  media Instructor <id|slug>'];
  }
  return ['unknown media model — try: media DanceClass <id|slug>'];
}

async function handleOpen(args: string[]): Promise<string[]> {
  const raw = args.join(' ').trim() || args[0]?.trim() || '';
  if (!raw) return ['usage: open <path|slug>  e.g. open /en/classes/salsa  or  open salsa'];
  if (raw.startsWith('/')) return [raw, `Open: ${raw} — copy the path and paste into the address bar (opens in a new tab on right-click)`];
  // slug → suggest paths
  return [`/${raw}`, `/en/classes/${raw}`, `/en/instructors/${raw}`, `/en/shop/${raw}`, 'Copy the URL → open in a new tab (terminal does not open windows itself)'];
}

async function handleRevalidate(args: string[]): Promise<string[]> {
  const path = args[0]?.trim() || '/';
  revalidatePath(path, 'layout');
  return [`revalidated: ${path}`];
}

export async function runTerminalCommand(raw: string): Promise<{ lines: string[]; ok: boolean }> {
  await requireOperator();
  const trimmed = raw.trim();
  if (!trimmed) return { lines: ['(empty)'], ok: false };
  // Лимит 400 символов — чтобы не протащить большой JSON в URL
  if (trimmed.length > 4000) return { lines: ['command too long (max 4000)'], ok: false };

  const parts = tokenizeTerminalCommand(trimmed);
  const cmd = parts[0]!.toLowerCase();
  const args = parts.slice(1);

  // clear обрабатывается на фронте, но если дошло — подсказываем
  if (cmd === 'clear') return { lines: ['(clear on client)'], ok: true };
  if (cmd === 'help') return { lines: helpLines(), ok: true };

  try {
    if (cmd === 'inspect') return { lines: await handleInspect(args), ok: true };
    if (cmd === 'search') return { lines: await handleSearch(args), ok: true };
    if (cmd === 'health') return { lines: await handleHealth(), ok: true };
    if (cmd === 'counts') return { lines: await handleCounts(), ok: true };
    if (cmd === 'jobs') return { lines: await handleJobs(args), ok: true };
    if (cmd === 'db') return { lines: await handleDb(args), ok: true };
    if (cmd === 'carts') return { lines: await handleCarts(args), ok: true };
    if (cmd === 'classes') return { lines: await handleClasses(args), ok: true };
    if (cmd === 'instructors') return { lines: await handleInstructors(args), ok: true };
    if (cmd === 'products') return { lines: await handleProducts(args), ok: true };
    if (cmd === 'media') return { lines: await handleMedia(args), ok: true };
    if (cmd === 'open') return { lines: await handleOpen(args), ok: true };
    if (cmd === 'revalidate') return { lines: await handleRevalidate(args), ok: true };
    return { lines: [`Unknown command: ${cmd}`, '', ...helpLines()], ok: false };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { lines: [`error: ${msg.slice(0, 400)}`], ok: false };
  }
}

export interface TerminalCompletion {
  value: string;
  label: string;
  description?: string;
}

/** Split command input without breaking JSON or quoted arguments containing spaces. */
export function tokenizeTerminalCommand(input: string): string[] {
  const tokens: string[] = [];
  let token = '';
  let depth = 0;
  let quote: '"' | "'" | null = null;
  let escaped = false;
  for (const char of input.trim()) {
    if (escaped) { token += char; escaped = false; continue; }
    if (char === '\\' && quote) { token += char; escaped = true; continue; }
    if (quote) {
      if (char === quote) quote = null;
      else token += char;
      continue;
    }
    if ((char === '"' || char === "'") && depth === 0) { quote = char; continue; }
    if (char === '{' || char === '[' || char === '(') depth += 1;
    if (char === '}' || char === ']' || char === ')') depth = Math.max(0, depth - 1);
    if (/\s/.test(char) && depth === 0) {
      if (token) { tokens.push(token); token = ''; }
    } else token += char;
  }
  if (token) tokens.push(token);
  return tokens;
}

function dryRunLines(action: string, model: string, id: string, before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const changed = Object.keys({ ...before, ...after }).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
  return [
    `dry-run: ${action} ${model} ${id}`,
    ...changed.map((key) => `  ${key}: ${JSON.stringify(redactRecord({ [key]: before[key] }, model)[key])} → ${JSON.stringify(redactRecord({ [key]: after[key] }, model)[key])}`),
    'no changes were made',
  ];
}

const BLOCKED_GENERIC_WRITE_MODELS = new Set([
  'Account', 'VerificationToken', 'Session', 'PushSubscription', 'OperatorSetting',
  'AuditLog', 'Payment', 'Refund', 'Payout', 'WalletAccount', 'WalletLedger', 'CommissionRecord',
]);
const USER_SAFE_WRITE_FIELDS = new Set(['name', 'phone', 'locale', 'timeZone', 'isActive']);

function genericWriteGuard(model: string, patch?: Record<string, unknown>): string | null {
  let canonical: string;
  try { canonical = operatorModelName(model); } catch { return `unknown model: ${model}`; }
  if (BLOCKED_GENERIC_WRITE_MODELS.has(canonical)) return `${canonical} is protected; use its dedicated support workflow`;
  if (canonical === 'User' && patch) {
    const unsafe = Object.keys(patch).filter((field) => !USER_SAFE_WRITE_FIELDS.has(field));
    if (unsafe.length) return `User fields blocked in generic terminal: ${unsafe.join(', ')}; use a dedicated workflow`;
  }
  return null;
}

const DB_SUBCOMMANDS = ['models', 'counts', 'count', 'find', 'get', 'fields', 'create', 'update', 'delete', 'restore', 'help'];
const DB_MODEL_COMMANDS = new Set(['counts', 'count', 'find', 'fields', 'create', 'get', 'update', 'delete', 'restore']);
const DB_FLAGS: Record<string, string[]> = {
  count: ['--where'],
  find: ['--where', '--take', '--q'],
  create: ['--data', '--dry-run'],
  update: ['--set', '--dry-run'],
  delete: ['--force', '--hard', '--dry-run'],
};
const INSPECT_MODELS = ['User', 'Order', 'Booking', 'SupportTicket'];
const MAX_ID_COMPLETIONS = 500;

function completion(value: string, description?: string): TerminalCompletion {
  return { value, label: value, ...(description ? { description } : {}) };
}

function matching(values: readonly string[], prefix: string): TerminalCompletion[] {
  const lower = prefix.toLowerCase();
  return values.filter((value) => value.toLowerCase().startsWith(lower)).map((value) => completion(value));
}

function splitCompletionInput(input: string): { tokens: string[]; current: string } {
  const trimmed = input.trimStart();
  const trailingSpace = /\s$/.test(trimmed);
  const tokens = trimmed.trim().split(/\s+/).filter(Boolean);
  return { current: trailingSpace ? '' : (tokens.pop() ?? ''), tokens };
}

async function modelCompletions(prefix: string): Promise<TerminalCompletion[]> {
  return matching(operatorModels().map((model) => model.name).sort(), prefix);
}

async function idCompletions(model: string, prefix: string): Promise<TerminalCompletion[]> {
  try {
    const canonical = operatorModelName(model);
    const fields = modelFields(canonical);
    if (!fields.some((field) => field.name === 'id')) return [];
    const displayField = ['name', 'email', 'title', 'slug', 'reference', 'orderNumber', 'code', 'key']
      .find((name) => fields.some((field) => field.name === name));
    const select: Record<string, boolean> = { id: true };
    if (displayField) select[displayField] = true;
    const delegate = operatorDelegate(canonical);
    const rows = await delegate.findMany({
      where: prefix ? { id: { startsWith: prefix } } : {},
      select,
      orderBy: { id: 'asc' },
      take: MAX_ID_COMPLETIONS,
    });
    return rows
      .map((row) => {
        const id = typeof row.id === 'string' ? row.id : String(row.id ?? '');
        if (!id) return null;
        const display = displayField && row[displayField] != null ? String(row[displayField]) : '';
        return completion(id, display ? `${canonical} · ${display}` : canonical);
      })
      .filter((item): item is TerminalCompletion => item !== null);
  } catch {
    return [];
  }
}

async function inspectCompletions(model: string, prefix: string): Promise<TerminalCompletion[]> {
  try {
    const canonical = operatorModelName(model);
    const preferred = canonical === 'User' ? 'email' : canonical === 'Order' ? 'orderNumber' : canonical === 'Booking' ? 'reference' : 'id';
    const fields = modelFields(canonical);
    const select: Record<string, boolean> = { id: true };
    if (fields.some((field) => field.name === preferred)) select[preferred] = true;
    const rows = await operatorDelegate(canonical).findMany({ select, orderBy: { id: 'asc' }, take: MAX_ID_COMPLETIONS });
    const lower = prefix.toLowerCase();
    return rows.flatMap((row) => {
      const id = String(row.id ?? '');
      const key = preferred === 'id' ? id : String(row[preferred] ?? id);
      if (!key || (!key.toLowerCase().includes(lower) && !id.toLowerCase().includes(lower))) return [];
      return [completion(key, id === key ? canonical : `${canonical} · ${id}`)];
    });
  } catch {
    return [];
  }
}

async function dbCompletions(tokens: string[], current: string): Promise<TerminalCompletion[]> {
  const sub = (tokens[1] ?? '').toLowerCase();
  if (tokens.length <= 1) return matching(DB_SUBCOMMANDS, current);
  if (!DB_SUBCOMMANDS.includes(sub) || !DB_MODEL_COMMANDS.has(sub)) return [];
  if (tokens.length === 2) {
    // Ctrl+Space is commonly pressed immediately after the model word
    // (`db get Users`), so an exact model name advances to its next values
    // instead of making the operator add a trailing space first.
    try {
      operatorModelName(current);
      if (new Set(['get', 'update', 'delete', 'restore']).has(sub)) return idCompletions(current, '');
      return matching(DB_FLAGS[sub] ?? [], '');
    } catch {
      return modelCompletions(current);
    }
  }

  const model = tokens[2]!;
  const idCommands = new Set(['get', 'update', 'delete', 'restore']);
  if (idCommands.has(sub) && tokens.length === 3) return idCompletions(model, current);
  if (sub === 'update' && tokens.length === 4) return matching(DB_FLAGS.update ?? [], current);
  if (sub === 'delete' && tokens.length === 4) return matching(DB_FLAGS.delete ?? [], current);
  if (sub === 'restore' || sub === 'get') return [];
  if (sub === 'create' && tokens.length === 3) return matching(DB_FLAGS.create ?? [], current);
  if ((sub === 'count' || sub === 'find') && tokens.length === 3) return matching(DB_FLAGS[sub] ?? [], current);
  return [];
}

/**
 * Resolve values against the live database for the current cursor position.
 * This stays server-side so model names and record IDs are not exposed to an
 * unauthorised browser.
 */
export async function completeTerminal(input: string): Promise<TerminalCompletion[]> {
  await requireOperator();
  const { tokens, current } = splitCompletionInput(input);
  const head = (tokens[0] ?? current).toLowerCase();
  if (tokens.length === 0 && head === 'db') {
    const exactSub = DB_SUBCOMMANDS.find((sub) => sub === current.toLowerCase());
    if (exactSub && DB_MODEL_COMMANDS.has(exactSub)) return modelCompletions('');
    return matching(DB_SUBCOMMANDS, current === 'db' ? '' : current);
  }
  if (tokens.length === 0 && head === 'carts') return matching(['stats', 'purge', 'help'], '');
  if (tokens.length === 0 && head === 'media') return matching(['DanceClass', 'Product', 'Instructor'], '');
  if (tokens.length === 0) return matching(terminalCommands.map((command) => command.name), current);
  if (head === 'inspect') {
    if (tokens.length <= 1) return matching(INSPECT_MODELS, current);
    if (tokens.length === 2) return inspectCompletions(tokens[1]!, current);
    return [];
  }
  if (tokens.length === 1 && head === 'db' && current === '') return matching(DB_SUBCOMMANDS, '');
  if (head === 'db') return dbCompletions(tokens, current);

  if (head === 'carts') {
    const sub = tokens[1] ?? current;
    if (tokens.length <= 1) return matching(['stats', 'purge', 'help'], sub);
    if (sub === 'purge') {
      const used = new Set(tokens.slice(2).filter((token) => token.startsWith('--')));
      return matching(['--empty', '--anon', '--older-than', '--dry-run', '--force'].filter((flag) => !used.has(flag)), current);
    }
    return [];
  }
  if (head === 'media') {
    if (tokens.length <= 1) return matching(['DanceClass', 'Product', 'Instructor'], current);
    if (tokens.length === 2) return idCompletions(tokens[1]!, current);
    return [];
  }
  if (tokens.length === 1) return matching(terminalCommands.map((command) => command.name), current);
  return [];
}
