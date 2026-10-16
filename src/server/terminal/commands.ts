import 'server-only';

import { revalidatePath } from 'next/cache';

import { mediaUrl } from '@/config/media';
import { db } from '@/lib/db';
import { browseModel, getOperatorCounts, operatorDelegate, operatorModels } from '@/server/admin/operator';
import { operatorPulse } from '@/server/admin/operator';
import { cartStats, purgeEmptyCarts } from '@/server/cart/service';
import { terminalCommands } from './registry';

function helpLines(): string[] {
  return ['Available commands:', ...terminalCommands.map((c) => `  ${c.usage.padEnd(48)} — ${c.description}`), '', 'Tip: Tab — автокомплит, ↑/↓ — история, Enter — выполнить.'];
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

async function handleDb(args: string[]): Promise<string[]> {
  const sub = (args[0] ?? '').toLowerCase();
  if (!sub || sub === 'help') {
    return [
      'db models                          — список моделей',
      'db counts [Model]                  — счётчики (все или одна модель)',
      'db count <Model> [--where JSON]     — точный count с фильтром',
      'db find <Model> [--where JSON] [--take N] [--q text] — первые записи (макс 25)',
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
      const delegate = operatorDelegate(model);
      const rows = await delegate.findMany({ where, take, orderBy: { id: 'desc' } as never });
      if (rows.length === 0) return ['no rows'];
      return rows.map((r) => JSON.stringify(r));
    }
    // Иначе используем browseModel (с секретами уже вырезаны)
    const rows = result.rows.slice(0, take);
    if (rows.length === 0) return ['no rows'];
    return rows.map((r) => JSON.stringify(r));
  }
  return [`unknown db subcommand: ${sub} — try: db help`];
}

async function handleCarts(args: string[]): Promise<string[]> {
  const sub = (args[0] ?? '').toLowerCase();
  if (!sub || sub === 'help') {
    return [
      'carts stats                                                   — сводка по корзинам',
      'carts purge --empty [--anon] [--older-than 7d] [--dry-run] [--force]',
      '  --empty       только пустые (без CartItem)',
      '  --anon        только гостевые (anonymousId != null)',
      '  --older-than 7d  только старше N дней (например 7d)',
      '  --dry-run     показать сколько удалит, не удалять',
      '  --force       выполнить удаление (без него — dry-run)',
      'Примеры:',
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

    if (!empty) return ['carts purge требует --empty (удаляем только пустые корзины). Добавьте --dry-run чтобы посмотреть.'];

    // Без --force считаем dry-run (безопасно)
    const dryRun = !forceFlag || dryRunFlag;
    const res = await purgeEmptyCarts({
      anonOnly: anonOnly || false,
      olderThanDays: olderThan,
      dryRun,
    });
    if (dryRun) {
      return [`dry-run: будет удалено ${res.deleted} корзин (добавьте --force чтобы удалить)`];
    }
    return [`удалено ${res.deleted} корзин`];
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
    const medias = r.media.length ? r.media.map(mediaLine) : ['(no media) — проверь админку занятия / добавь картинку'];
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
  if (raw.startsWith('/')) return [raw, `Открой: ${raw} — скопируй путь и вставь в адресную строку (откроется в новой вкладке, если кликнуть правой кнопкой)`];
  // slug → подсказать пути
  return [`/${raw}`, `/en/classes/${raw}`, `/en/instructors/${raw}`, `/en/shop/${raw}`, 'Скопируй нужный URL → открой в новой вкладке (терминал не открывает окна сам)'];
}

async function handleRevalidate(args: string[]): Promise<string[]> {
  const path = args[0]?.trim() || '/';
  revalidatePath(path, 'layout');
  return [`revalidated: ${path}`];
}

export async function runTerminalCommand(raw: string): Promise<{ lines: string[]; ok: boolean }> {
  const trimmed = raw.trim();
  if (!trimmed) return { lines: ['(empty)'], ok: false };
  // Лимит 400 символов — чтобы не протащить большой JSON в URL
  if (trimmed.length > 500) return { lines: ['command too long (max 500)'], ok: false };

  const parts = trimmed.split(/\s+/);
  const cmd = parts[0]!.toLowerCase();
  const args = parts.slice(1);

  // clear обрабатывается на фронте, но если дошло — подсказываем
  if (cmd === 'clear') return { lines: ['(clear on client)'], ok: true };
  if (cmd === 'help') return { lines: helpLines(), ok: true };

  try {
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

// Используется фронтом для подсказок
export function completeTerminal(input: string): string[] {
  const trimmed = input.trimStart();
  if (!trimmed) return terminalCommands.map((c) => c.name);
  const lower = trimmed.toLowerCase();
  // Если уже есть пробел — подсказываем подкоманды
  if (lower.startsWith('db ')) {
    const rest = lower.slice(3).trim();
    const subs = ['models', 'counts', 'count', 'find', 'help'];
    if (!rest) return subs;
    return subs.filter((s) => s.startsWith(rest));
  }
  if (lower.startsWith('carts ')) {
    const rest = lower.slice(6).trim();
    const subs = ['stats', 'purge', 'help'];
    if (!rest) return subs;
    // подсказки флагов после purge
    if (rest.startsWith('purge')) {
      const flags = ['--empty', '--anon', '--older-than', '--dry-run', '--force'];
      const last = rest.split(/\s+/).pop() ?? '';
      if (last.startsWith('--')) return flags.filter((f) => f.startsWith(last));
      if (rest.includes('--')) return flags.filter((f) => !rest.includes(f));
      return flags;
    }
    return subs.filter((s) => s.startsWith(rest));
  }
  if (lower.startsWith('revalidate')) return ['revalidate /', 'revalidate /en/admin/support/terminal'];
  if (lower.startsWith('classes')) return ['classes salsa --take 5', 'classes --take 10'];
  if (lower.startsWith('instructors')) return ['instructors salsa', 'instructors --take 5'];
  if (lower.startsWith('products')) return ['products --take 5'];
  if (lower.startsWith('media ')) return ['media DanceClass ', 'media Product ', 'media Instructor '];
  if (lower.startsWith('open ')) return ['open /en/classes/', 'open /en/shop/'];
  if (!trimmed.includes(' ')) {
    return terminalCommands.map((c) => c.name).filter((n) => n.startsWith(lower));
  }
  return [];
}
