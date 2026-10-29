'use client';

import { useAction } from 'next-safe-action/hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  CheckCircle2, Clock3, Eye, MessageSquare, Paperclip, Search, UserPlus, Send, FileText, Trash2, Sparkles, ArrowUpCircle, Minus, Flame
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useRouter } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { replyToSupportTicket } from '@/server/actions/admin/operator';
import { setSupportTicketStatus } from '@/server/actions/admin/support';
import type { GodSnapshot, GodTicketRow } from '@/server/admin/god';

function slaDueLabelI18n(
  slaDueAt: string | null,
  createdAt: string,
  tg: (key: string, params?: Record<string, unknown>) => string,
): { label: string; tone: 'ok' | 'warn' | 'breach' } {
  const dueMs = slaDueAt ? new Date(slaDueAt).getTime() : new Date(createdAt).getTime() + 24 * 3600000;
  const now = Date.now();
  if (now >= dueMs) return { label: tg('slaBreach'), tone: 'breach' };
  const leftHrs = Math.floor((dueMs - now) / 3600000);
  if (leftHrs <= 12) return { label: tg('hoursLeft', { count: leftHrs } as never), tone: 'warn' };
  return { label: tg('fresh'), tone: 'ok' };
}

function priorityMeta(tg: (key: string) => string): Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }> {
  return {
    LOW: { label: tg('priorityLow'), icon: Minus, cls: 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:border-white/10 dark:text-zinc-400' },
    NORMAL: { label: tg('priorityNormal'), icon: Minus, cls: 'border-zinc-200 bg-white text-zinc-700 dark:bg-zinc-800 dark:border-white/10 dark:text-zinc-300' },
    HIGH: { label: tg('priorityHigh'), icon: ArrowUpCircle, cls: 'border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:border-amber-900/30 dark:text-amber-300' },
    URGENT: { label: tg('priorityUrgent'), icon: Flame, cls: 'border-red-200 bg-red-50 text-red-700 dark:bg-red-950/30 dark:border-red-900/30 dark:text-red-300' },
  };
}

interface Props {
  tickets: GodTicketRow[];
  operators: GodSnapshot['operators'];
  templates: GodSnapshot['templates'];
  locale: string;
  initialStatusFilter?: 'all' | 'OPEN' | 'PENDING' | 'RESOLVED';
  onTicketsChange?: (next: GodTicketRow[]) => void;
}

export function GodQueue({ tickets: initialTickets, operators, templates, locale, initialStatusFilter, onTicketsChange }: Props) {
  const t = useTranslations('admin.support');
  const tg = useTranslations('admin.support.god');
  const router = useRouter();
  const [tickets, setTickets] = useState<GodTicketRow[]>(initialTickets);
  const [filter, setFilter] = useState<'all' | 'OPEN' | 'PENDING' | 'RESOLVED'>(initialStatusFilter ?? 'all');
  const [q, setQ] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW'>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [active, setActive] = useState<GodTicketRow | null>(null);
  const [replies, setReplies] = useState<Array<{ id: string; body: string; internal: boolean; delivered: boolean; createdAt: string }>>([]);
  const [attachments, setAttachments] = useState<Array<{ id: string; fileName: string; mimeType: string; bytes: number; storageKey: string; createdAt: string }>>([]);
  const [replyBody, setReplyBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [templatePick, setTemplatePick] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setTickets(initialTickets), [initialTickets]);
  useEffect(() => { if (initialStatusFilter) setFilter(initialStatusFilter); }, [initialStatusFilter]);
  const onTicketsChangeRef = useRef<Props['onTicketsChange']>(undefined);
  useEffect(() => { onTicketsChangeRef.current = onTicketsChange; }, [onTicketsChange]);
  useEffect(() => { onTicketsChangeRef.current?.(tickets); }, [tickets]);

  const filtered = useMemo(() => {
    let list = tickets;
    if (filter !== 'all') list = list.filter((x) => x.status === filter);
    if (priorityFilter !== 'all') list = list.filter((x) => x.priority === priorityFilter);
    if (assigneeFilter !== 'all') {
      if (assigneeFilter === 'unassigned') list = list.filter((x) => !x.assigneeId);
      else list = list.filter((x) => x.assigneeId === assigneeFilter);
    }
    if (q.trim()) {
      const qq = q.trim().toLowerCase();
      list = list.filter((x) => `${x.name} ${x.email} ${x.topic} ${x.message} ${x.assigneeName ?? ''}`.toLowerCase().includes(qq));
    }
    return list;
  }, [tickets, filter, q, priorityFilter, assigneeFilter]);

  const openTickets = tickets.filter((x) => x.status === 'OPEN').length;
  const pendingTickets = tickets.filter((x) => x.status === 'PENDING').length;

  const prioMeta = useMemo(() => priorityMeta((k) => tg(k as never)), [tg]);
  const statusAction = useAction(setSupportTicketStatus, {
    onSuccess: () => { toast.success(tg('ticketUpdated')); router.refresh(); },
    onError: ({ error }) => toast.error(typeof error.serverError === 'string' ? error.serverError : tg('ticketFailed')),
  });
  const replyAction = useAction(replyToSupportTicket, {
    onSuccess: () => {
      toast.success(isInternal ? tg('saveInternalNote') : tg('sendReplyByEmail')); setReplyBody('');
      if (active) void openTicket(active);
      router.refresh();
    },
    onError: ({ error }) => toast.error(typeof error.serverError === 'string' ? error.serverError : tg('replyFailed')),
  });

  // i18n-aware timeAgo / sla helpers
  const timeAgo = useCallback((date: Date | string): string => {
    const d = new Date(date); const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return tg('justNow');
    if (mins < 60) return tg('minutesAgo', { count: mins } as never);
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return tg('hoursAgo', { count: hrs } as never);
    return tg('daysAgo', { count: Math.floor(hrs / 24) } as never);
  }, [tg]);

  const openTicket = useCallback(async (ticket: GodTicketRow) => {
    setActive(ticket);
    setLoading(true);
    try {
      const [rRes, aRes] = await Promise.all([
        fetch(`/api/admin/god/ticket?id=${encodeURIComponent(ticket.id)}`, { cache: 'no-store' }),
        fetch(`/api/admin/god/attachments?ticketId=${encodeURIComponent(ticket.id)}`, { cache: 'no-store' }),
      ]);
      if (rRes.ok) {
        const data = (await rRes.json()) as { replies: typeof replies };
        setReplies(data.replies ?? []);
      } else setReplies([]);
      if (aRes.ok) {
        const data = (await aRes.json()) as typeof attachments;
        setAttachments(Array.isArray(data) ? data : []);
      } else setAttachments([]);
    } catch { setReplies([]); setAttachments([]); } finally { setLoading(false); }
  }, []);

  const patchTicket = useCallback(async (id: string, patch: Record<string, unknown>) => {
    // optimistic
    setTickets((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch, ...(patch.assigneeId !== undefined ? { assigneeName: operators.find((o) => o.id === patch.assigneeId)?.name ?? null, assigneeEmail: operators.find((o) => o.id === patch.assigneeId)?.email ?? null } : {}) } as GodTicketRow : x)));
    if (active?.id === id) setActive((prev) => prev ? { ...prev, ...patch } as GodTicketRow : prev);
    try {
      const res = await fetch(`/api/admin/god/tickets/${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error ?? 'Failed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }, [active, operators]);

  const handleStatus = (id: string, status: 'OPEN' | 'PENDING' | 'RESOLVED') => {
    setTickets((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
    statusAction.execute({ id, status });
  };

  const uploadFile = async (file: File) => {
    if (!active) return;
    const form = new FormData();
    form.set('ticketId', active.id);
    form.set('file', file);
    const res = await fetch('/api/admin/god/attachments', { method: 'POST', body: form });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(j.error ?? tg('uploadFailed'));
      return;
    }
    toast.success(tg('attachmentUploaded'));
    const list = await fetch(`/api/admin/god/attachments?ticketId=${encodeURIComponent(active.id)}`, { cache: 'no-store' }).then((r) => r.json()).catch(() => []);
    setAttachments(Array.isArray(list) ? list : []);
    setTickets((prev) => prev.map((x) => x.id === active.id ? { ...x, attachmentsCount: (x.attachmentsCount ?? 0) + 1 } : x));
  };

  return (
    <>
      <Card className="overflow-hidden rounded-[24px] border-[#EDE3D3] bg-white shadow-sm dark:bg-zinc-900 dark:border-white/10">
        <CardHeader className="flex flex-col gap-3 border-b border-zinc-100 bg-zinc-50/50 p-4 dark:bg-zinc-900 dark:border-white/5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-5 w-5 text-amber-600" /> {t('queueTitle')}
                <Badge variant="neutral" size="sm" className="rounded-full font-mono text-[11px]">{tg('queueTotalBadge', { count: tickets.length } as never)}</Badge>
                {openTickets ? <Badge variant="neutral" size="sm" className="rounded-full font-mono text-[11px]">{tg('queueOpenBadge', { count: openTickets } as never)}</Badge> : null}
                {pendingTickets ? <Badge variant="neutral" size="sm" className="rounded-full font-mono text-[11px]">{tg('queuePendingBadge', { count: pendingTickets } as never)}</Badge> : null}
              </CardTitle>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{tg('queueSubtitle')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as never)}
                className="h-9 rounded-full border border-zinc-200 bg-white px-3 text-xs font-semibold dark:bg-zinc-800 dark:border-white/10 dark:text-zinc-200"
                aria-label={tg('priorityLabel')}
              >
                <option value="all">{tg('allPriorities')}</option>
                <option value="URGENT">{tg('priorityUrgent')}</option>
                <option value="HIGH">{tg('priorityHigh')}</option>
                <option value="NORMAL">{tg('priorityNormal')}</option>
                <option value="LOW">{tg('priorityLow')}</option>
              </select>
              <select
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="h-9 rounded-full border border-zinc-200 bg-white px-3 text-xs font-semibold dark:bg-zinc-800 dark:border-white/10 dark:text-zinc-200"
                aria-label={tg('assigneeLabel')}
              >
                <option value="all">{tg('allAssignees')}</option>
                <option value="unassigned">{tg('unassigned')}</option>
                {operators.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tg('filterTicketsPlaceholder')} className="h-9 w-40 rounded-full bg-white pl-8 text-xs dark:bg-zinc-800 dark:border-white/10 sm:w-56" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-full border border-zinc-200 bg-white p-1 dark:bg-zinc-800 dark:border-white/10">
              {(['all', 'OPEN', 'PENDING', 'RESOLVED'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn('rounded-full px-3 py-1.5 text-xs font-bold transition', f === filter ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-white/[0.07] dark:hover:text-zinc-200')}
                >
                  {f === 'all' ? tg('statusAll') : f === 'OPEN' ? tg('statusOpen', { count: openTickets } as never) : f === 'PENDING' ? tg('statusPending', { count: pendingTickets } as never) : tg('statusResolved')}
                </button>
              ))}
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{tg('shownTotal', { shown: filtered.length, total: tickets.length } as never)}</span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800"><CheckCircle2 className="h-6 w-6 text-zinc-400" /></div>
              <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">{t('emptyQueue')}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{tg('tryAnotherFilter')}</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-white/5">
              {filtered.slice(0, 40).map((ticket) => {
                const sla = slaDueLabelI18n(ticket.slaDueAt, ticket.createdAt, (k, p) => tg(k as never, p as never));
                const prio = (prioMeta[ticket.priority] ?? prioMeta.NORMAL)!;
                const PrioIcon = prio.icon;
                return (
                  <div key={ticket.id} className="group flex flex-col gap-3 p-4 hover:bg-zinc-50 dark:hover:bg-white/[0.06] sm:flex-row sm:items-center sm:gap-4 sm:p-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={ticket.status === 'OPEN' ? 'signal' : ticket.status === 'PENDING' ? 'warning' : 'success'} size="sm" className="rounded-full font-bold">{ticket.status}</Badge>
                        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold', prio.cls)}><PrioIcon className="h-3 w-3" /> {prio.label}</span>
                        <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-bold', sla.tone === 'breach' ? 'border-red-200 bg-red-50 text-red-700 dark:bg-red-950/30 dark:border-red-900/30 dark:text-red-300' : sla.tone === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-300' : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:border-white/10 dark:text-zinc-400')}>
                          <Clock3 className="mr-1 inline h-3 w-3" /> {sla.label}
                        </span>
                        {ticket.assigneeName ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-950/20 dark:border-violet-900/30 dark:text-violet-300">
                            <UserPlus className="h-3 w-3" /> {ticket.assigneeName}
                          </span>
                        ) : <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:border-white/10 dark:text-zinc-400">{tg('unassigned')}</span>}
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">{timeAgo(ticket.createdAt)} · {ticket.locale.toUpperCase()} · {tg('repliesSuffix', { count: ticket.repliesCount } as never)}{ticket.attachmentsCount ? ` · ${tg('filesSuffix', { count: ticket.attachmentsCount } as never)}` : ''}</span>
                      </div>
                      <p className="mt-2 truncate text-sm font-bold text-zinc-900 dark:text-white">{ticket.name} <span className="font-normal text-zinc-500">· {ticket.email}</span></p>
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">{ticket.topic}</p>
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{ticket.message}</p>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <select
                          value={ticket.priority}
                          onChange={(e) => void patchTicket(ticket.id, { priority: e.target.value })}
                          className="h-7 rounded-full border border-zinc-200 bg-white px-2 text-xs font-semibold dark:bg-zinc-800 dark:border-white/10 dark:text-zinc-200"
                          aria-label={tg('priorityLabel')}
                        >
                          <option value="LOW">{tg('priorityLow')}</option><option value="NORMAL">{tg('priorityNormal')}</option><option value="HIGH">{tg('priorityHigh')}</option><option value="URGENT">{tg('priorityUrgent')}</option>
                        </select>
                        <select
                          value={ticket.assigneeId ?? ''}
                          onChange={(e) => void patchTicket(ticket.id, { assigneeId: e.target.value || null })}
                          className="h-7 rounded-full border border-zinc-200 bg-white px-2 text-xs font-semibold dark:bg-zinc-800 dark:border-white/10 dark:text-zinc-200"
                          aria-label={tg('assigneeLabel')}
                        >
                          <option value="">{tg('unassigned')}</option>
                          {operators.map((o) => <option key={o.id} value={o.id}>{o.name} · {o.email}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-stretch">
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => void openTicket(ticket)}><Eye className="mr-1 h-3.5 w-3.5" /> {tg('openAction')}</Button>
                      {ticket.status === 'OPEN' ? <Button size="sm" className="rounded-full bg-zinc-900 text-white hover:bg-black dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100" onClick={() => handleStatus(ticket.id, 'PENDING')}>{tg('workOnIt')}</Button> : null}
                      {ticket.status !== 'RESOLVED' ? <Button size="sm" variant="ghost" className="rounded-full text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-white/[0.06] dark:hover:text-emerald-200" onClick={() => handleStatus(ticket.id, 'RESOLVED')}><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> {tg('resolveAction')}</Button> : <Button size="sm" variant="ghost" className="rounded-full" onClick={() => handleStatus(ticket.id, 'OPEN')}>{tg('reopenAction')}</Button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail drawer */}
      <Sheet open={active !== null} onOpenChange={(open) => !open && setActive(null)}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-[680px] bg-white dark:bg-zinc-900">
          <SheetHeader>
            <SheetTitle className="text-left">
              {active ? (
                <span className="flex flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <Badge variant={active.status === 'OPEN' ? 'signal' : active.status === 'PENDING' ? 'warning' : 'success'} size="sm" className="rounded-full">{active.status}</Badge>
                    <span className="text-sm font-bold text-zinc-900 dark:text-white">{active.name}</span>
                  </span>
                  <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">{active.email} · {active.topic} · {active.locale.toUpperCase()} · {new Date(active.createdAt).toLocaleString(locale)}</span>
                </span>
              ) : null}
            </SheetTitle>
          </SheetHeader>

          {active ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-5">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:bg-zinc-800 dark:border-white/10">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-900 dark:text-white">{active.message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {active.status !== 'PENDING' ? <Button size="sm" variant="outline" className="rounded-full" onClick={() => handleStatus(active.id, 'PENDING')}>{tg('markInProgress')}</Button> : null}
                  {active.status !== 'RESOLVED' ? <Button size="sm" className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700 dark:hover:bg-emerald-500" onClick={() => handleStatus(active.id, 'RESOLVED')}>{tg('resolveTicket')}</Button> : <Button size="sm" variant="outline" className="rounded-full" onClick={() => handleStatus(active.id, 'OPEN')}>{tg('reopenAction')}</Button>}
                  <Button size="sm" variant="ghost" className="rounded-full" onClick={() => navigator.clipboard.writeText(active.email).then(() => toast.success(tg('emailCopied')))}>{tg('copyEmail')}</Button>
                </div>
              </div>

              {/* Attachments */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:bg-zinc-800 dark:border-white/10">
                <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-white"><Paperclip className="h-4 w-4" /> {tg('attachmentsTitle')} <Badge variant="neutral" size="sm" className="rounded-full">{attachments.length}</Badge></h3>
                {attachments.length ? (
                  <div className="mt-3 grid gap-2">
                    {attachments.map((a) => (
                      <a key={a.id} href={`/media-proxy/${a.storageKey}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 hover:bg-white dark:bg-zinc-900 dark:border-white/10 dark:hover:bg-white/[0.06]">
                        <FileText className="h-4 w-4 shrink-0 text-zinc-500" />
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-900 dark:text-white">{a.fileName}</span>
                        <span className="text-xs text-zinc-500">{Math.round(a.bytes / 1024)} KB</span>
                      </a>
                    ))}
                  </div>
                ) : <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{tg('noFiles')}</p>}
                <div className="mt-3 flex items-center gap-2">
                  <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp,.avif,.pdf,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFile(f); e.currentTarget.value = ''; }} />
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => fileRef.current?.click()}><Paperclip className="mr-1 h-3.5 w-3.5" /> {tg('uploadFile')}</Button>
                  <span className="text-xs text-zinc-500">{tg('uploadHint')}</span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">{tg('conversationTitle')}</h3>
                {loading ? <p className="mt-2 text-sm text-zinc-500">{tg('sending')}</p> : replies.length === 0 ? <p className="mt-2 rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">{tg('noReplies')}</p> : (
                  <div className="mt-2 flex flex-col gap-2">
                    {replies.map((r) => (
                      <div key={r.id} className={cn('rounded-2xl border p-3', r.internal ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/30' : 'border-zinc-200 bg-white dark:bg-zinc-800 dark:border-white/10')}>
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant={r.internal ? 'warning' : 'neutral'} size="sm" className="rounded-full">{r.internal ? 'Internal note' : 'Reply'} {r.delivered ? '· delivered' : ''}</Badge>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">{new Date(r.createdAt).toLocaleString(locale)}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-900 dark:text-white">{r.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:bg-zinc-800 dark:border-white/10">
                <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-white"><Sparkles className="h-4 w-4 text-amber-600" /> {tg('replyHeading')}</h3>
                {/* Templates */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {templates.slice(0, 8).map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => { setReplyBody(tpl.body); setTemplatePick(tpl.id); }}
                      className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', templatePick === tpl.id ? 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900/30 dark:text-amber-200' : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-white dark:bg-zinc-900 dark:border-white/10 dark:text-zinc-300')}
                    >
                      {tpl.title}
                    </button>
                  ))}
                  {templates.length === 0 ? <span className="text-xs text-zinc-500">{tg('noTemplates')}</span> : null}
                </div>

                <textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder={tg('replyPlaceholderLong')} className="mt-3 min-h-32 w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 dark:bg-zinc-900 dark:border-white/10 dark:text-white" />
                <label className="mt-2 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                  <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} className="h-4 w-4 rounded border-zinc-300" /> {tg('internalNoteCheckbox')}
                </label>
                <Button
                  className="mt-3 w-full rounded-full bg-zinc-900 text-white hover:bg-black dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                  disabled={!replyBody.trim() || replyAction.status === 'executing'}
                  onClick={() => {
                    if (!active || !replyBody.trim()) return;
                    replyAction.execute({ ticketId: active.id, body: replyBody.trim(), internal: isInternal });
                  }}
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" /> {replyAction.status === 'executing' ? tg('sending') : isInternal ? tg('saveInternalNote') : tg('sendReplyByEmail')}
                </Button>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{tg('externalNote')}</p>

                {/* Quick template CRUD */}
                <details className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:bg-zinc-900 dark:border-white/10">
                  <summary className="cursor-pointer text-xs font-bold text-zinc-700 dark:text-zinc-300">{tg('manageTemplates')}</summary>
                  <TemplateManager templates={templates} />
                </details>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function TemplateManager({ templates }: { templates: GodSnapshot['templates'] }) {
  const tg2 = useTranslations('admin.support.god');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [list, setList] = useState(templates);
  useEffect(() => { setList(templates); }, [templates]);

  const create = async () => {
    if (!title.trim() || !body.trim()) return;
    const res = await fetch('/api/admin/god/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim(), body: body.trim(), locale: 'ru' }) });
    if (!res.ok) return toast.error(tg2('templateFailed'));
    const row = (await res.json()) as { id: string; title: string; body: string; locale: string };
    setList((prev) => [row, ...prev]);
    setTitle(''); setBody('');
    toast.success(tg2('templateCreated'));
  };
  const remove = async (id: string) => {
    await fetch(`/api/admin/god/templates?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    setList((prev) => prev.filter((x) => x.id !== id));
    toast.success(tg2('templateDeleted'));
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="grid gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tg2('templateTitlePlaceholder')} className="h-9 rounded-full bg-white dark:bg-zinc-800" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={tg2('templateBodyPlaceholder')} className="min-h-20 rounded-2xl border border-zinc-200 bg-white p-3 text-sm dark:bg-zinc-800 dark:border-white/10 dark:text-white" />
        <Button size="sm" className="rounded-full" onClick={() => void create()}>{tg2('createTemplate')}</Button>
      </div>
      <div className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-zinc-800">
        {list.length === 0 ? <p className="p-3 text-xs text-zinc-500">{tg2('noTemplatesShort')}</p> : list.map((tpl) => (
          <div key={tpl.id} className="flex items-start justify-between gap-2 p-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-zinc-900 dark:text-white">{tpl.title} <span className="font-normal text-zinc-500">· {tpl.locale}</span></p>
              <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-400">{tpl.body}</p>
            </div>
            <Button size="sm" variant="ghost" className="shrink-0 rounded-full" onClick={() => void remove(tpl.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
