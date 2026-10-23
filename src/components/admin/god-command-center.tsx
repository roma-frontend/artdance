'use client';

import { useAction } from 'next-safe-action/hooks';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Activity,
  ArrowUpRight,
  Clock3,
  Crown,
  Database,
  FileText,
  Mail,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Timer,
  UserCog,
  Users,
  Wallet,
  Zap,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Link } from '@/i18n/routing';
import { routes } from '@/config/routes';
import { cn } from '@/lib/utils';
import { stopImpersonation } from '@/server/actions/admin/operator';
import { JobButton, OperatorTerminal } from '@/components/admin/operator-actions';
import { GodQueue } from '@/components/admin/god-queue';
import { GodTabs, GodTabPanel, type GodTabId, QUICK_TOOLS } from '@/components/admin/god-tabs';
import type { GodSnapshot } from '@/server/admin/god';

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('ru-RU', { style: 'decimal', maximumFractionDigits: 0 }).format(amount) + ' ֏';
}
type SearchHit = { label: string; href: string; kind: string };
interface Props { snapshot: GodSnapshot; caller: { name: string; email: string }; locale: string; }

export function GodCommandCenter({ snapshot, caller, locale }: Props) {
  const t = useTranslations('admin.support');
  const tg = useTranslations('admin.support.god');
  const tRoot = useTranslations();
  const [activeTab, setActiveTab] = useState<GodTabId>('overview');
  const [queueFilter, setQueueFilter] = useState<'all' | 'OPEN' | 'PENDING' | 'RESOLVED'>('all');
  const [pulse, setPulse] = useState(snapshot.counts);
  const [stats, setStats] = useState(snapshot.stats);
  const [liveAt, setLiveAt] = useState<string | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [tickets, setTickets] = useState(snapshot.allTickets);
  const [imps, setImps] = useState(snapshot.impersonations);
  const [now, setNow] = useState(() => Date.now());
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [showHits, setShowHits] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);
  const audit = snapshot.recentAudit;

  const timeAgo = useCallback((date: Date | string): string => {
    const d = new Date(date);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return tg('justNow');
    if (mins < 60) return tg('minutesAgo', { count: mins } as never);
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return tg('hoursAgo', { count: hrs } as never);
    return tg('daysAgo', { count: Math.floor(hrs / 24) } as never);
  }, [tg]);

  // SSE live pulse (fallback to polling if EventSource fails)
  useEffect(() => {
    let es: EventSource | null = null;
    let fallback: number | null = null;
    try {
      es = new EventSource('/api/admin/god/stream');
      es.addEventListener('open', () => setLiveConnected(true));
      es.addEventListener('pulse', (e: MessageEvent) => {
        try {
          const data = JSON.parse((e as MessageEvent).data) as { counts: typeof pulse; stats: typeof stats; timestamp: string };
          setPulse(data.counts); setStats(data.stats); setLiveAt(data.timestamp); setLiveConnected(true);
        } catch {}
      });
      es.addEventListener('hello', () => setLiveConnected(true));
      es.onerror = () => { setLiveConnected(false); };
    } catch { setLiveConnected(false); }

    // fallback polling if SSE not connected within 4s
    const t = window.setTimeout(() => {
      if (!liveConnected) {
        fallback = window.setInterval(async () => {
          try {
            const res = await fetch('/api/admin/god/pulse', { cache: 'no-store' });
            if (!res.ok) return;
            const data = (await res.json()) as { counts: typeof pulse; stats: typeof stats; timestamp: string };
            setPulse(data.counts); setStats(data.stats); setLiveAt(data.timestamp);
          } catch {}
        }, 15000);
      }
    }, 4000);

    return () => { try { es?.close(); } catch {}; if (fallback) clearInterval(fallback); clearTimeout(t); };
  }, [liveConnected]);

  // impersonation countdown
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, []);
  // omnibox shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape') setShowHits(false);
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);
  const doSearch = useCallback((value: string) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (value.trim().length < 2) { setHits([]); setShowHits(false); return; }
    setSearching(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/god/search?q=${encodeURIComponent(value.trim())}`, { cache: 'no-store' });
        const data = (await res.json()) as SearchHit[];
        setHits(Array.isArray(data) ? data : []); setShowHits(true);
      } catch { setHits([]); } finally { setSearching(false); }
    }, 280);
  }, []);

  const openTickets = tickets.filter((x) => x.status === 'OPEN').length;
  const pendingTickets = tickets.filter((x) => x.status === 'PENDING').length;
  const stopImpAction = useAction(stopImpersonation, { onSuccess: () => { toast.success('Preview stopped'); setImps([]); window.location.reload(); } });

  return (
    <div className="space-y-6">
      {/* HERO */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="relative overflow-hidden rounded-[28px] border border-amber-200/50 bg-gradient-to-br from-[#FFF8EB] via-[#FFF3D6] to-[#FFF0EB] p-6 shadow-[0_8px_40px_rgba(139,90,43,0.12)] dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-900 dark:border-white/10 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-amber-300/30 via-orange-300/20 to-transparent blur-3xl dark:from-amber-500/10" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-gradient-to-tr from-[#D4B896]/20 to-transparent blur-2xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-bold tracking-wide text-amber-900 shadow-sm dark:bg-zinc-800 dark:border-white/10 dark:text-amber-200">
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
                GOD MODE · {liveConnected ? tg('liveSse') : 'LIVE'}
              </span>
              <Badge variant="success" size="md" className="rounded-full"><Crown className="mr-1 h-3.5 w-3.5" /> {t('allCapabilities')}</Badge>
              {liveAt ? <span className="text-xs text-content-tertiary">{tg('lastSync', { time: timeAgo(liveAt) } as never)}</span> : null}
            </div>
            <h1 className="mt-3 flex flex-wrap items-center gap-2 text-2xl font-black tracking-tight text-[#3A3226] dark:text-white sm:text-3xl">
              <Sparkles className="h-7 w-7 text-amber-500" /> {tRoot('admin.support.title' as never) !== 'admin.support.title' ? t('title') : 'Command Center'} <span className="rounded-full bg-[#8B5A2B] px-3 py-1 text-xs font-bold tracking-widest text-white dark:bg-white dark:text-zinc-900">GOD</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#8A7D6B] dark:text-zinc-400">
              {t('ownerNotice', { email: 'romangulanyan@gmail.com · support@demo.artdance.am' })} —{' '}
              <span className="font-semibold text-[#6B3A1F] dark:text-zinc-200">{caller.name} · {caller.email}</span> — {tg('heroSubtitle')}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm border border-zinc-200 dark:bg-zinc-800 dark:border-white/10 dark:text-zinc-300"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> {tg('allowlistBadge')}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm border border-zinc-200 dark:bg-zinc-800 dark:border-white/10 dark:text-zinc-300"><Zap className="h-3.5 w-3.5 text-amber-600" /> {tg('auditedBadge')}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm border border-zinc-200 dark:bg-zinc-800 dark:border-white/10 dark:text-zinc-300"><Timer className="h-3.5 w-3.5 text-violet-600" /> {liveConnected ? tg('liveSse') : tg('livePoll')}</span>
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-3 sm:flex sm:gap-3">
            <div className="rounded-2xl bg-white p-4 shadow-sm border border-amber-100 dark:bg-zinc-800 dark:border-white/10 min-w-[132px]">
              <p className="text-xs font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">{tg('openTicketsLabel')}</p>
              <p className="mt-1 flex items-baseline gap-2"><span className="text-3xl font-black text-[#8B5A2B] dark:text-amber-300">{openTickets}</span><span className="text-xs font-bold text-emerald-600">{tg('liveSuffix')}</span></p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{tg('inProgressLabel', { count: pendingTickets } as never) !== `${pendingTickets} in progress` ? tg('inProgressLabel', { count: pendingTickets } as never) : `${pendingTickets} ${tg('inProgressLabel')}`}</p>
            </div>
            <div className="rounded-2xl bg-[#111111] p-4 text-white shadow-sm min-w-[132px] dark:bg-white dark:text-zinc-900">
              <p className="text-xs font-semibold tracking-wide text-white/60 dark:text-zinc-500">{tg('platformLabel')}</p>
              <p className="mt-1 text-sm font-bold leading-tight">{stats.users} {tRoot('admin.dashboard.stats.users' as never) !== 'admin.dashboard.stats.users' ? '' : 'users'}<br />{stats.bookings} bookings</p>
              <p className="text-xs text-white/60 dark:text-zinc-500">{formatMoney(stats.revenue)} {tg('paidLabel')}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* OMNIBOX — always visible */}
      <Card className="overflow-visible rounded-[24px] border-[#EDE3D3] bg-white shadow-[0_4px_24px_rgba(58,50,38,0.06)] dark:bg-zinc-900 dark:border-white/10">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-zinc-500 dark:text-zinc-400">
            <Search className="h-4 w-4 text-amber-600" /> {tg('omniboxTitle')}
            <span className="ml-auto hidden sm:inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 font-mono text-[11px] text-zinc-500 dark:bg-zinc-800 dark:border-white/10">
              {tg('omniboxHint')} <kbd className="rounded bg-white px-1 py-0.5 shadow-sm border border-zinc-200 dark:bg-zinc-700 dark:border-white/10">/</kbd>
            </span>
          </div>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
            <Input ref={searchRef} value={q} onChange={(e) => { const v = e.target.value; setQ(v); doSearch(v); }} onFocus={() => { if (hits.length) setShowHits(true); }} placeholder={tg('omniboxPlaceholder')} className="h-14 rounded-full border-[#E8DDD0] bg-[#FFFBF5] pl-12 pr-12 text-[15px] placeholder:text-zinc-400 focus-visible:ring-amber-200 dark:bg-zinc-800 dark:border-white/10 dark:text-white" />
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-2">
              {searching ? <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" /> : null}
              <span className="hidden lg:inline text-xs text-zinc-400">{hits.length ? `${hits.length} hits` : tg('globalSearchFallback')}</span>
            </div>
            <AnimatePresence>
              {showHits && hits.length > 0 ? (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="absolute left-0 right-0 top-full z-30 mt-2 max-h-96 overflow-auto rounded-2xl border border-zinc-200 bg-white p-2 shadow-2xl dark:bg-zinc-800 dark:border-white/10">
                  {hits.map((hit) => (
                    <Link key={`${hit.kind}-${hit.href}`} href={hit.href} onClick={() => setShowHits(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-white/[0.07]">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
                        {hit.kind === 'users' ? <Users className="h-4 w-4" /> : hit.kind === 'bookings' ? <Users className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-white">{hit.label}</span>
                      <Badge variant="neutral" size="sm" className="shrink-0 rounded-full font-mono text-[10px]">{hit.kind}</Badge>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-400" />
                    </Link>
                  ))}
                  <p className="px-3 py-2 text-center text-xs text-zinc-400">{tg('omniboxCloseHint')}</p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      {/* TABS */}
      <GodTabs active={activeTab} onChange={setActiveTab} counts={{ openTickets, pendingTickets, failedPayments: pulse.failedPayments, pendingApprovals: pulse.pendingApprovals }}>
        {/* OVERVIEW */}
        <GodTabPanel value="overview">
          {/* e2e anchors — keep sections discoverable; empty sections have 0 width so skip boundingBox check — test now checks GodTabs content visibility instead */}
          {/* visible h2 for e2e getByRole heading inside overview */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: tg('kpiActiveSessions'), value: pulse.sessions, icon: Activity, sub: tg('kpiActiveSessionsSub'), href: routes.adminOperatorTool('sessions') },
              { label: tg('kpiFailedPayments'), value: pulse.failedPayments, icon: Wallet, sub: tg('kpiFailedPaymentsSub'), href: routes.adminOrders(), tone: pulse.failedPayments > 0 ? 'warn' : 'ok' as const },
              { label: tg('kpiOpenTickets'), value: pulse.openTickets, icon: MessageSquare, sub: tg('kpiOpenSuffix', { count: pendingTickets } as never), tab: 'queue' as const, queueFilter: 'OPEN' as const, tone: openTickets > 0 ? 'accent' : 'ok' as const },
              { label: tg('kpiPendingApprovals'), value: pulse.pendingApprovals, icon: ShieldCheck, sub: tg('kpiPendingApprovalsSub'), href: routes.adminApprovals(), tone: pulse.pendingApprovals > 0 ? 'warn' : 'ok' as const },
            ].map((kpi) => {
              const tab = (kpi as { tab?: GodTabId }).tab;
              const qf = (kpi as { queueFilter?: typeof queueFilter }).queueFilter;
              return (
              <Card key={kpi.label} className={cn('rounded-2xl border shadow-sm', (kpi as { tone?: string }).tone === 'warn' ? 'border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-900/30' : (kpi as { tone?: string }).tone === 'accent' ? 'border-amber-200 bg-[#FFF8EB] dark:bg-zinc-900 dark:border-white/10' : 'border-[#EDE3D3] bg-white dark:bg-zinc-900 dark:border-white/10')}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-xs font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">{kpi.label.toUpperCase()}</p><p className="mt-1 text-3xl font-black tracking-tight text-zinc-900 dark:text-white">{kpi.value}</p><p className="text-xs text-zinc-500 dark:text-zinc-400">{kpi.sub}</p></div>
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm border border-zinc-200 dark:bg-zinc-800 dark:border-white/10"><kpi.icon className="h-5 w-5 text-zinc-700 dark:text-zinc-300" /></span>
                  </div>
                  {tab ? (
                    <button type="button" onClick={() => { if (qf) setQueueFilter(qf); setActiveTab(tab); }} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:underline dark:text-amber-300">{tg('kpiOpenLink')} <ArrowUpRight className="h-3 w-3" /></button>
                  ) : (
                    <Link href={(kpi as { href: string }).href} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:underline dark:text-amber-300">{tg('kpiOpenLink')} <ArrowUpRight className="h-3 w-3" /></Link>
                  )}
                </CardContent>
              </Card>
              );
            })}
          </div>
          <Card className="rounded-2xl border-[#EDE3D3] bg-white dark:bg-zinc-900 dark:border-white/10">
            <CardContent className="flex flex-wrap items-center gap-2 p-3 sm:gap-3 sm:p-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wide text-zinc-700 dark:text-zinc-300"><Activity className="h-4 w-4 text-emerald-600" /> {tg('healthLabel')}</span>
              <span className="h-4 w-px bg-zinc-200 dark:bg-white/10" aria-hidden />
              {[
                { label: tg('healthEmail'), ok: snapshot.pulse.services.email, icon: Mail },
                { label: tg('healthMedia'), ok: snapshot.pulse.services.media, icon: Database },
                { label: tg('healthPayments', { provider: snapshot.pulse.services.payments } as never), ok: snapshot.pulse.services.payments !== 'mock', icon: Wallet },
                { label: tg('healthCron'), ok: snapshot.pulse.services.cron, icon: Clock3 },
              ].map((s) => (
                <span key={s.label} className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold', s.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900/30 dark:text-emerald-300' : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:border-white/10 dark:text-zinc-400')}>
                  <s.icon className="h-3 w-3" /> {s.label} {s.ok ? '●' : '○'}
                </span>
              ))}
              <span className="ml-auto inline-flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400"><span className="hidden sm:inline">{tg('healthDb')}</span> {tg('healthPostgres')} · {snapshot.pulse.services.cron ? tg('healthCronReady') : 'cron —'} · {tg('healthLocked', { count: pulse.lockedLogins } as never)} · {tg('healthSla')} · <JobButton job="sla" /></span>
            </CardContent>
          </Card>
          {/* Quick preview so overview is not empty */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-2xl border-[#EDE3D3] bg-white dark:bg-zinc-900 dark:border-white/10">
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="h-5 w-5 text-amber-600" /> {t('queueTitle')} <Badge variant="accent" size="sm" className="rounded-full">{tickets.length}</Badge></CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {tickets.slice(0, 3).map((tk) => (
                  <div key={tk.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:bg-zinc-800 dark:border-white/10">
                    <p className="truncate text-sm font-bold text-zinc-900 dark:text-white">{tk.name} · <span className="font-normal text-zinc-500">{tk.topic}</span></p>
                    <p className="line-clamp-1 text-xs text-zinc-600 dark:text-zinc-400">{tk.message}</p>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full rounded-full" onClick={() => setActiveTab('queue')}>{tg('overviewPreviewQueue')}</Button>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-[#EDE3D3] bg-white dark:bg-zinc-900 dark:border-white/10">
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-5 w-5 text-violet-600" /> {t('toolsTitle')}</CardTitle></CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {QUICK_TOOLS.slice(0, 4).map((tool) => (
                  <Link key={tool.label} href={tool.href} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 hover:bg-white dark:bg-zinc-800 dark:border-white/10 dark:hover:bg-white/[0.06]">
                    <span className="text-xs font-bold text-zinc-900 dark:text-white">{tool.label}</span><span className="block text-xs text-zinc-500 dark:text-zinc-400">{tool.desc}</span>
                  </Link>
                ))}
                <Button variant="outline" size="sm" className="sm:col-span-2 rounded-full" onClick={() => setActiveTab('tools')}>{tg('overviewPreviewTools')}</Button>
              </CardContent>
            </Card>
          </div>
        </GodTabPanel>

        {/* QUEUE */}
        <GodTabPanel value="queue">
          <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">{t('queueTitle')}</h2>
          <GodQueue tickets={tickets} operators={snapshot.operators} templates={snapshot.templates} locale={locale} initialStatusFilter={queueFilter} onTicketsChange={setTickets} />
        </GodTabPanel>

        {/* OPERATIONS */}
        <GodTabPanel value="operations">
          <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">{tg('operationsTitleShort')}</h2>
          <div className="grid gap-4 lg:grid-cols-[1.35fr_0.9fr]">
            <Card className="rounded-2xl border-[#EDE3D3] bg-white dark:bg-zinc-900 dark:border-white/10">
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Zap className="h-5 w-5 text-amber-600" /> {tg('scheduledJobs')}</CardTitle><p className="text-xs text-zinc-500 dark:text-zinc-400">{tg('scheduledJobsHint')}</p></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline" className="rounded-full"><Link href={routes.adminOperatorTool('operations')}>{tg('openJobs')}</Link></Button>
                <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:border-white/10 dark:text-zinc-400">{tg('slaCronLabel')}</span>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-[#EDE3D3] bg-white dark:bg-zinc-900 dark:border-white/10">
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-5 w-5 text-zinc-700 dark:text-zinc-300" /> {tg('auditPreview')}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {audit.slice(0, 8).map((row) => (
                  <div key={String(row.id)} className="flex gap-3 rounded-xl border border-zinc-100 bg-zinc-50/50 p-3 dark:bg-zinc-800/50 dark:border-white/5">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    <div className="min-w-0 flex-1"><p className="truncate font-mono text-xs font-bold text-zinc-900 dark:text-white">{String(row.action)}</p><p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{String(row.actorEmail)} · {String(row.entityType)}:{String(row.entityId).slice(0, 8)}… · {row.createdAt ? timeAgo(row.createdAt) : tg('noActivesHint')}</p></div>
                  </div>
                ))}
                <Button asChild variant="outline" size="sm" className="w-full rounded-full"><Link href={routes.adminAuditLog()}>{tg('openAuditLog')}</Link></Button>
              </CardContent>
            </Card>
          </div>
        </GodTabPanel>

        {/* TERMINAL — full width */}
        <GodTabPanel value="terminal">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">{tg('terminalTitleShort')}</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{tg('terminalTabSubtitle')}</p>
            </div>
            <Button asChild size="sm" variant="outline" className="rounded-full"><Link href={routes.adminOperatorTool('terminal')}>{tg('standaloneTerminal')}</Link></Button>
          </div>
          <Card className="overflow-hidden rounded-[24px] border-zinc-900 bg-zinc-950 dark:border-white/10">
            <CardHeader className="border-b border-white/10 bg-zinc-900 p-4">
              <CardTitle className="flex items-center gap-2 font-mono text-sm tracking-wide text-white">{tg('safeConsoleTitle')} <span className="hidden sm:inline font-normal text-zinc-400">{tg('safeConsoleSubtitle')}</span></CardTitle>
              <p className="font-mono text-xs text-zinc-400">{tg('safeConsoleCommands')}</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[min(72vh,900px)] overflow-auto">
                <div className="p-3 sm:p-4">
                  <OperatorTerminal />
                </div>
              </div>
            </CardContent>
          </Card>
        </GodTabPanel>

        {/* ACCESS */}
        <GodTabPanel value="access">
          <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">{tg('accessTitleShort')}</h2>
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="rounded-[24px] border-violet-200 bg-gradient-to-br from-violet-50 to-white dark:from-zinc-900 dark:to-zinc-900 dark:border-white/10">
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><UserCog className="h-5 w-5 text-violet-600" /> {tg('impersonationCockpit')} <Badge variant="neutral" size="sm" className="rounded-full">{tg('impersonationActive', { count: imps.length } as never)}</Badge></CardTitle><p className="text-xs text-zinc-500 dark:text-zinc-400">{tg('impersonationHint')}</p></CardHeader>
              <CardContent className="space-y-3">
                {imps.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-violet-200 bg-white p-6 text-center dark:bg-zinc-800 dark:border-white/10"><p className="text-sm font-semibold text-zinc-900 dark:text-white">{tg('noActivePreviews')}</p><p className="text-xs text-zinc-500 dark:text-zinc-400">{tg('noActivePreviewsHint')}</p></div>
                ) : imps.map((imp) => {
                  const remainMs = Math.max(0, imp.expiresAt - now); const remainMin = Math.floor(remainMs / 60000); const remainSec = Math.floor((remainMs % 60000) / 1000); const pct = Math.max(0, Math.min(100, (remainMs / (30*60000))*100));
                  return (
                    <div key={imp.key} className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm dark:bg-zinc-800 dark:border-white/10">
                      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-zinc-900 dark:text-white">{imp.targetName ?? imp.targetUserId}</p><p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{imp.targetEmail ?? imp.targetUserId}</p><p className="mt-1 font-mono text-xs text-violet-700 dark:text-violet-300">{remainMin}:{String(remainSec).padStart(2,'0')} · {imp.sessionId.slice(0,8)}…</p></div><Button size="sm" variant="outline" className="shrink-0 rounded-full" onClick={() => stopImpAction.execute({})}><X className="mr-1 h-3.5 w-3.5" /> {tg('stopAction')}</Button></div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-violet-100 dark:bg-white/10"><div className="h-full bg-violet-600 dark:bg-violet-400" style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                })}
                <div className="rounded-2xl bg-violet-600 p-4 text-white dark:bg-violet-700"><p className="text-xs font-bold tracking-wide text-white/80">{tg('startPreview')}</p><p className="mt-1 text-xs text-white/80">{tg('startPreviewHint')}</p><div className="mt-3 flex gap-2"><Button asChild size="sm" variant="outline" className="rounded-full bg-white text-violet-700 hover:bg-zinc-100"><Link href={routes.adminUsers()}>{tg('browseUsers')}</Link></Button>{imps.length ? <Button size="sm" variant="outline" className="rounded-full border-white/30 bg-transparent text-white hover:bg-white/10" onClick={() => stopImpAction.execute({})}>{tg('stopAll')}</Button> : null}</div></div>
              </CardContent>
            </Card>
            <Card className="rounded-[24px] border-[#EDE3D3] bg-white dark:bg-zinc-900 dark:border-white/10">
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-5 w-5 text-zinc-700 dark:text-zinc-300" /> {tg('auditTimeline')} <Badge variant="neutral" size="sm" className="rounded-full font-mono text-[10px]">last {audit.length}</Badge></CardTitle><p className="text-xs text-zinc-500 dark:text-zinc-400">{tg('auditTimelineHint')}</p></CardHeader>
              <CardContent className="space-y-2">
                {audit.slice(0, 10).map((row) => (
                  <div key={String(row.id)} className="flex gap-3 rounded-2xl border border-zinc-100 bg-zinc-50/50 p-3 dark:bg-zinc-800/50 dark:border-white/5"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" /><div className="min-w-0 flex-1"><p className="truncate font-mono text-xs font-bold text-zinc-900 dark:text-white">{String(row.action)}</p><p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{String(row.actorEmail)} · {row.createdAt ? timeAgo(row.createdAt) : '—'}</p>{row.diff ? <details className="mt-2 rounded-xl bg-white p-2 dark:bg-zinc-900"><summary className="cursor-pointer text-xs font-semibold text-zinc-700 dark:text-zinc-300">diff</summary><pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-zinc-600 dark:text-zinc-400">{JSON.stringify(row.diff, null, 2).slice(0, 1200)}</pre></details> : null}</div></div>
                ))}
                <Button asChild variant="outline" size="sm" className="w-full rounded-full"><Link href={routes.adminAuditLog()}>{tg('openAuditLog')}</Link></Button>
              </CardContent>
            </Card>
          </div>
        </GodTabPanel>

        {/* TOOLS */}
        <GodTabPanel value="tools">
          <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">{t('toolsTitle')}</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('toolsHint')}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK_TOOLS.map((item) => (
              <Link key={item.label} href={item.href} className={cn('group flex gap-3 rounded-2xl border p-4 transition hover:shadow-md', item.accent ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-white hover:from-amber-50 hover:to-amber-50/50 dark:from-amber-950/20 dark:to-zinc-900 dark:border-amber-900/20 dark:hover:from-amber-950/25 dark:hover:to-zinc-800' : 'border-zinc-200 bg-zinc-50/50 hover:bg-white dark:bg-zinc-800/50 dark:border-white/5 dark:hover:bg-white/[0.06]')}>
                <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border bg-white shadow-sm dark:bg-zinc-900 dark:border-white/10', item.accent ? 'border-amber-200 text-amber-700 dark:border-amber-900/30 dark:text-amber-300' : 'border-zinc-200 text-zinc-700 dark:border-white/10 dark:text-zinc-300')}><item.icon className="h-5 w-5" /></span>
                <span className="min-w-0"><span className="block text-sm font-bold leading-tight text-zinc-900 group-hover:underline dark:text-white dark:group-hover:text-white">{item.label}</span><span className="block text-xs leading-snug text-zinc-500 dark:text-zinc-400">{item.desc}</span></span>
                <ArrowUpRight className="ml-auto hidden h-4 w-4 shrink-0 text-zinc-400 group-hover:text-zinc-700 dark:text-zinc-500 dark:group-hover:text-white sm:block" />
              </Link>
            ))}
          </div>
        </GodTabPanel>
      </GodTabs>
    </div>
  );
}
