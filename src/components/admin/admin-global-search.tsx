'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CalendarDays, Eye, MapPin, MessageSquare, Package, Search, UserRound, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link, useRouter } from '@/i18n/routing';

type SearchHit = { label: string; href: string; kind: string; entityId?: string; entityType?: string };
type EntityPreview = { model: string; id: string; title: string; subtitle: string; status: string | null; fields: Array<{ label: string; value: string }> };

const icons: Record<string, typeof UserRound> = {
  users: UserRound,
  bookings: CalendarDays,
  orders: Package,
  classes: CalendarDays,
  venues: MapPin,
  tickets: MessageSquare,
};

function kindLabel(kind: string): string {
  return kind.replace(/s$/, '');
}

export function AdminGlobalSearch() {
  const t = useTranslations('admin.support');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState<EntityPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      setOpen((value) => !value);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    return () => requestRef.current?.abort();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    requestRef.current?.abort();
    const value = query.trim();
    if (value.length < 2) {
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    debounceRef.current = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/god/search?q=${encodeURIComponent(value)}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('search failed');
        const data = (await response.json()) as SearchHit[];
        setHits(Array.isArray(data) ? data : []);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') { setHits([]); setFailed(true); }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); controller.abort(); };
  }, [open, query]);

  const close = () => { setOpen(false); setQuery(''); setHits([]); setFailed(false); setPreview(null); };

  const loadPreview = async (hit: SearchHit) => {
    if (!hit.entityId || !hit.entityType || !['User', 'Order', 'Booking', 'SupportTicket'].includes(hit.entityType)) return;
    setPreviewLoading(true);
    try {
      const response = await fetch(`/api/admin/god/entity?model=${encodeURIComponent(hit.entityType)}&key=${encodeURIComponent(hit.entityId)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('preview failed');
      setPreview((await response.json()) as EntityPreview);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-full items-center gap-2 rounded-full border border-border-default bg-surface-card px-3 text-body-sm text-content-tertiary shadow-sm transition hover:border-border-strong hover:bg-surface-sunken sm:min-w-60 lg:max-w-md"
        aria-label={t('adminSearchPlaceholder')}
      >
        <Search className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">{t('adminSearchPlaceholder')}</span>
        <kbd className="hidden rounded border border-border-subtle bg-surface-sunken px-1.5 py-0.5 font-mono text-caption text-content-tertiary sm:inline">Ctrl K</kbd>
      </button>

      {open ? (
        <div className="fixed inset-0 z-modal flex items-start justify-center bg-black/50 p-3 pt-4" onClick={close}>
          <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-border-default bg-surface-card shadow-2xl dark:border-zinc-700 dark:bg-zinc-900" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-border-default px-4 py-3 dark:border-zinc-700">
              <Search className="size-5 shrink-0 text-accent" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  const value = event.target.value;
                  setQuery(value);
                  setSelected(0);
                  setFailed(false);
                  if (value.trim().length < 2) { setHits([]); setLoading(false); }
                  else setLoading(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') { event.preventDefault(); close(); }
                  if (event.key === 'ArrowDown') { event.preventDefault(); setSelected((value) => Math.min(value + 1, Math.max(0, hits.length - 1))); }
                  if (event.key === 'ArrowUp') { event.preventDefault(); setSelected((value) => Math.max(value - 1, 0)); }
                  if (event.key === 'Enter' && hits[selected]) { event.preventDefault(); router.push(hits[selected]!.href as never); close(); }
                }}
                placeholder={t('adminSearchPlaceholder')}
                className="min-w-0 flex-1 bg-transparent text-body-lg text-content-primary outline-none placeholder:text-content-tertiary dark:text-zinc-100"
                autoComplete="off"
                spellCheck={false}
              />
              <button type="button" onClick={close} className="rounded-full border border-border-default p-2 text-content-tertiary hover:bg-surface-sunken" aria-label={t('adminSearchClose')}>
                <X className="size-4" />
              </button>
            </div>
            <div className={preview ? 'grid gap-0 lg:grid-cols-2' : ''}>
            <div className="max-h-96 overflow-y-auto p-2">
              {loading ? <p className="px-4 py-10 text-center text-body-sm text-content-tertiary">{t('adminSearchLoading')}</p> : null}
              {!loading && failed ? <p className="px-4 py-10 text-center text-body-sm text-content-warning">{t('adminSearchFailed')}</p> : null}
              {!loading && !failed && query.trim().length < 2 ? <p className="px-4 py-10 text-center text-body-sm text-content-tertiary">{t('adminSearchHint')}</p> : null}
              {!loading && !failed && query.trim().length >= 2 && hits.length === 0 ? <p className="px-4 py-10 text-center text-body-sm text-content-tertiary">{t('adminSearchEmpty')}</p> : null}
              {!loading && !failed ? hits.map((hit, index) => {
                const Icon = icons[hit.kind] ?? Search;
                return (
                  <div key={`${hit.kind}-${hit.href}`} className={`flex items-center gap-3 rounded-2xl px-3 py-3 transition ${index === selected ? 'bg-surface-sunken dark:bg-zinc-800' : 'hover:bg-surface-sunken dark:hover:bg-zinc-800'}`}>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent"><Icon className="size-4" /></span>
                    <Link href={hit.href} onClick={close} className="min-w-0 flex-1 truncate text-body-sm font-semibold text-content-primary hover:underline dark:text-zinc-100">{hit.label}</Link>
                    <span className="rounded-full border border-border-subtle px-2 py-1 font-mono text-caption uppercase tracking-wide text-content-tertiary">{kindLabel(hit.kind)}</span>
                    {hit.entityId && hit.entityType && ['User', 'Order', 'Booking', 'SupportTicket'].includes(hit.entityType) ? <button type="button" onClick={() => void loadPreview(hit)} className="rounded-full border border-border-default p-2 text-content-tertiary hover:bg-surface-card hover:text-content-primary" aria-label={`${t('adminSearchPreview')}: ${hit.label}`}><Eye className="size-4" /></button> : null}
                  </div>
                );
              }) : null}
            </div>
            {preview ? <aside className="border-t border-border-default p-4 dark:border-zinc-700 lg:border-l lg:border-t-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="font-mono text-caption uppercase tracking-wide text-content-tertiary">{preview.model}</p><h2 className="mt-1 truncate text-heading-4 text-content-primary dark:text-zinc-100">{preview.title}</h2><p className="truncate text-body-sm text-content-secondary">{preview.subtitle}</p></div>
                {previewLoading ? <span className="text-caption text-content-tertiary">Loading…</span> : preview.status ? <span className="rounded-full border border-border-subtle px-2 py-1 text-caption text-content-secondary">{preview.status}</span> : null}
              </div>
              <dl className="mt-5 space-y-2">{preview.fields.map((field) => <div key={field.label} className="flex items-start justify-between gap-3 border-b border-border-subtle pb-2"><dt className="text-caption text-content-tertiary">{field.label}</dt><dd className="max-w-[60%] truncate text-right text-body-sm text-content-primary dark:text-zinc-200">{field.value}</dd></div>)}</dl>
              <div className="mt-5 flex flex-wrap gap-2"><Link href={hits.find((hit) => hit.entityId === preview.id)?.href ?? '#'} onClick={close} className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-2 text-caption font-semibold text-white">{t('adminSearchOpenRecord')} <ArrowUpRight className="size-3.5" /></Link><button type="button" onClick={() => setPreview(null)} className="rounded-full border border-border-default px-3 py-2 text-caption text-content-secondary">{t('adminSearchClosePreview')}</button></div>
            </aside> : null}
            </div>
            <div className="flex items-center justify-between border-t border-border-default px-4 py-2.5 font-mono text-caption text-content-tertiary dark:border-zinc-700">
              <span>↑/↓ {t('adminSearchNavigate')} · Enter {t('adminSearchOpen')}</span>
              <span>Esc {t('adminSearchClose')}</span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
