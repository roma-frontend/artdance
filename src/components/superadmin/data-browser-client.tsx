'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/routing';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Copy,
  Database,
  Download,
  Heart,
  KeyRound,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface ModelMeta {
  name: string;
  count: number;
}

interface BrowserRow {
  id: string;
  [key: string]: unknown;
}

interface BrowsePayload {
  fields: string[];
  rows: BrowserRow[];
  total: number;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '∅';
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return value.map((v) => cellText(v)).join(', ');
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    return `{ ${entries
      .slice(0, 2)
      .map(([k, v]) => `${k}: ${cellText(v)}`)
      .join(', ')}${entries.length > 2 ? '…' : ''} }`;
  }
  return String(value);
}

function detailText(value: unknown): string {
  if (value === null || value === undefined) return '∅';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return '[object]';
    }
  }
  return String(value);
}

function isIdField(field: string): boolean {
  return /Id$/.test(field) && field !== 'id';
}

interface Props {
  models: ModelMeta[];
  initialModel: string | null;
  initialQuery: string;
  initialPage: number;
  payload: BrowsePayload | null;
}

const PAGE_SIZE = 25;

/* Cozy palette — warm paper, not clinical white; muted ink, not pure black */
const COZY = {
  shell: 'bg-[#FDF8F0] dark:bg-surface-canvas',
  card: 'bg-[#FFFBF5] dark:bg-surface-card',
  cardBorder: 'border-[#EDE3D3] dark:border-border-default',
  muted: 'text-[#8A7D6B] dark:text-content-tertiary',
  heading: 'text-[#3A3226] dark:text-content-primary',
  accent: 'text-[#8B5A2B] dark:text-content-accent',
  accentSoft: 'bg-[#F5E6CC] dark:bg-accent-soft',
  accentBorder: 'border-[#D4B896] dark:border-border-default',
  tableHead: 'bg-[#F5EDE0] dark:bg-surface-sunken',
  tableHeadText: 'text-[#6B5D4D] dark:text-content-secondary',
  // Row hover: warm paper in light, light overlay blend in dark so text stays readable — use hover:bg + keep text colors
  rowHover: 'hover:bg-[#FFF8EB] dark:hover:bg-white/[0.06]',
  rowSelected: 'bg-[#FFF3D6] dark:bg-white/[0.08]',
  inputBg: 'bg-[#FFFBF5] dark:bg-surface-card',
  inputBorder: 'border-[#E8DDD0] dark:border-border-default',
} as const;

export function DataBrowserClient({ models, initialModel, initialQuery, initialPage, payload }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedModel, setSelectedModel] = useState<string | null>(initialModel);
  const [tableQuery, setTableQuery] = useState('');
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [page, setPage] = useState(initialPage);
  const [fullscreen, setFullscreen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailRow, setDetailRow] = useState<BrowserRow | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string; value: string } | null>(null);
  const [creatingRow, setCreatingRow] = useState(false);
  const [createJson, setCreateJson] = useState('{\n  \n}');
  const [refreshing, setRefreshing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);

  const exitFullscreen = useCallback(() => setFullscreen(false), []);
  const [fsRender, setFsRender] = useState(false);
  const [fsEnter, setFsEnter] = useState(false);
  useEffect(() => {
    if (fullscreen) {
      setFsRender(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setFsEnter(true)));
      return () => cancelAnimationFrame(id as unknown as number);
    }
    setFsEnter(false);
    const t = setTimeout(() => setFsRender(false), 320);
    return () => clearTimeout(t);
  }, [fullscreen]);

  // ESC closes fullscreen; body scroll lock while fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !detailRow && !creatingRow) exitFullscreen();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [fullscreen, detailRow, creatingRow, exitFullscreen]);

  /* Fullscreen is a desktop-only layout; close it if a window is resized to a phone width. */
  useEffect(() => {
    const mobile = window.matchMedia('(width < 640px)');
    const closeOnMobile = () => {
      if (mobile.matches) setFullscreen(false);
    };
    closeOnMobile();
    mobile.addEventListener('change', closeOnMobile);
    return () => mobile.removeEventListener('change', closeOnMobile);
  }, []);

  const pushState = (next: { model?: string | null; q?: string; page?: number }) => {
    const params = new URLSearchParams(searchParams.toString());
    const model = next.model !== undefined ? next.model : selectedModel;
    const q = next.q !== undefined ? next.q : searchInput;
    const p = next.page !== undefined ? next.page : page;
    if (model) params.set('model', model);
    else params.delete('model');
    if (q) params.set('q', q);
    else params.delete('q');
    if (p > 1) params.set('page', String(p));
    else params.delete('page');
    router.push(`?${params.toString()}`);
  };

  useEffect(() => {
    queueMicrotask(() => {
      setSelectedModel(initialModel);
      setSearchInput(initialQuery);
      setPage(initialPage);
      setSelectedIds(new Set());
      setEditingCell(null);
      setDetailRow(null);
    });
  }, [initialModel, initialQuery, initialPage]);

  useEffect(() => {
    if (searchInput === initialQuery) return;
    const id = setTimeout(() => pushState({ q: searchInput, page: 1 }), 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const sortedModels = useMemo(() => [...models].sort((a, b) => a.name.localeCompare(b.name)), [models]);

  const visibleModels = useMemo(() => {
    const q = tableQuery.trim().toLowerCase();
    if (!q) return sortedModels;
    return sortedModels.filter((m) => m.name.toLowerCase().includes(q));
  }, [sortedModels, tableQuery]);

  const selectModel = (name: string) => {
    setSelectedModel(name);
    setSearchInput('');
    setPage(1);
    setSelectedIds(new Set());
    setEditingCell(null);
    setDetailRow(null);
    pushState({ model: name, q: '', page: 1 });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 600);
  };

  const fields = payload?.fields ?? [];
  const rows = payload?.rows ?? [];
  const total = payload?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isAllSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        rows.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        rows.forEach((r) => next.add(r.id));
        return next;
      });
    }
  };

  const handleExport = async () => {
    if (!selectedModel) return;
    const params = new URLSearchParams({ model: selectedModel });
    if (searchInput) params.set('q', searchInput);
    const res = await fetch(`/api/admin/database/export?${params.toString()}`);
    if (!res.ok) {
      toast.error('Export failed');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedModel.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File) => {
    if (!selectedModel) {
      toast.error('Select a table first');
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const docs = Array.isArray(parsed) ? parsed : [];
      if (docs.length === 0) {
        toast.error('No rows found');
        return;
      }
      const res = await fetch('/api/admin/database/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel, docs }),
      });
      const data = (await res.json()) as { inserted?: number; failed?: number };
      if (!res.ok) throw new Error(String((data as unknown as { error?: string }).error ?? 'Import failed'));
      toast.success(`Imported ${data.inserted ?? 0} rows${data.failed ? `, ${data.failed} failed` : ''}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreate = async () => {
    if (!selectedModel) return;
    let doc: Record<string, unknown>;
    try {
      doc = JSON.parse(createJson) as Record<string, unknown>;
    } catch {
      toast.error('Invalid JSON');
      return;
    }
    const res = await fetch('/api/admin/database/rows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: selectedModel, doc }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(err.error ?? 'Create failed');
      return;
    }
    toast.success('Row created');
    setCreatingRow(false);
    setCreateJson('{\n  \n}');
    router.refresh();
  };

  const handleDelete = async (row: BrowserRow) => {
    if (!selectedModel) return;
    const res = await fetch(`/api/admin/database/rows?model=${encodeURIComponent(selectedModel)}&id=${encodeURIComponent(row.id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(err.error ?? 'Delete failed');
      return;
    }
    toast.success('Row deleted');
    router.refresh();
  };

  const handleBulkDelete = async () => {
    if (!selectedModel || selectedIds.size === 0) return;
    const res = await fetch('/api/admin/database/rows/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: selectedModel, ids: [...selectedIds] }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(err.error ?? 'Bulk delete failed');
      return;
    }
    const data = (await res.json()) as { deleted?: number };
    toast.success(`${data.deleted ?? selectedIds.size} rows deleted`);
    setSelectedIds(new Set());
    router.refresh();
  };

  const handleCellSave = async () => {
    if (!editingCell || !selectedModel) return;
    const { rowId, field, value } = editingCell;
    let parsed: unknown;
    const trimmed = value.trim();
    if (trimmed === '') parsed = null;
    else {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        parsed = value;
      }
    }
    const res = await fetch('/api/admin/database/rows', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: selectedModel, id: rowId, patch: { [field]: parsed } }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(err.error ?? 'Save failed');
      return;
    }
    toast.success('Row updated');
    setEditingCell(null);
    router.refresh();
  };

  const handleDuplicate = async (row: BrowserRow) => {
    if (!selectedModel) return;
    const { id: _id, ...doc } = row;
    void _id;
    const res = await fetch('/api/admin/database/rows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: selectedModel, doc }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(err.error ?? 'Duplicate failed');
      return;
    }
    toast.success('Row duplicated');
    router.refresh();
  };

  const openCellEditor = (row: BrowserRow, field: string) => {
    setEditingCell({ rowId: row.id, field, value: cellText(row[field]) });
  };

  const openDetail = useCallback((row: BrowserRow) => {
    const el = tableScrollRef.current;
    const top = el?.scrollTop ?? null;
    const left = el?.scrollLeft ?? null;
    setDetailRow(row);
    // Restore scroll after radix focus-lock + portal mount (rAF x2)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (el && top !== null) {
          el.scrollTop = top;
          if (left !== null) el.scrollLeft = left;
        }
      });
    });
  }, []);

  const quickTabs = useMemo(
    () => sortedModels.filter((m) => ['User', 'Booking', 'Order', 'DanceClass', 'Venue', 'Product'].includes(m.name)),
    [sortedModels],
  );

  const browserBody = (
    <>
      <div className={cn('grid h-full gap-3 transition-[grid-template-columns] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none', fullscreen ? 'grid-cols-[280px_minmax(0,1fr)]' : 'grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]')}>
        {/* Sidebar — cozy */}
        <Card className={cn('flex min-h-0 flex-col overflow-hidden py-0 shadow-[0_2px_12px_rgba(58,50,38,0.06)] dark:shadow-none', COZY.card, COZY.cardBorder)}>
          <CardContent className="flex min-h-0 flex-col p-2">
            <div className="mb-2 flex items-center justify-between px-2 pt-2">
              <p className={cn('flex items-center gap-2 text-sm font-semibold', COZY.heading)}>
                <span className="flex size-7 items-center justify-center rounded-lg bg-[#F5E6CC] dark:bg-accent-soft border border-[#E8DDD0] dark:border-border-default">
                  <Database className="h-3.5 w-3.5 text-[#8B5A2B] dark:text-content-accent" />
                </span>
                Tables
                <span className="rounded-full bg-[#F5EDE0] dark:bg-surface-sunken px-2 py-0.5 font-mono text-[10px] font-medium text-[#8A7D6B] dark:text-content-tertiary border border-[#EDE3D3] dark:border-border-default">{models.length}</span>
              </p>
            </div>

            <div className="relative mb-2 px-1">
              <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#B8A99A] dark:text-content-tertiary" />
              <Input
                value={tableQuery}
                onChange={(e) => setTableQuery(e.target.value)}
                placeholder="Find a table…"
                className={cn('h-8 pl-8 text-xs rounded-full', COZY.inputBg, COZY.inputBorder, 'placeholder:text-[#B8A99A] dark:text-content-tertiary focus-visible:ring-[#D4B896]/40')}
              />
            </div>

            <div className="mb-2 flex flex-wrap gap-1 px-1">
              {quickTabs.map((m) => (
                <button
                  key={m.name}
                  type="button"
                  onClick={() => selectModel(m.name)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors duration-200 ease-out motion-reduce:transition-none',
                    selectedModel === m.name
                      ? 'border-[#D4B896] dark:border-border-default bg-[#F5E6CC] dark:bg-accent-soft text-[#6B3A1F] dark:text-content-accent'
                      : 'border-[#E8DDD0] dark:border-border-default text-[#8A7D6B] dark:text-content-tertiary hover:border-[#D4B896] dark:hover:border-border-strong hover:text-[#3A3226] dark:hover:text-content-primary bg-[#FFFBF5] dark:bg-surface-card',
                  )}
                >
                  {m.name}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-0.5">
              {visibleModels.map((m) => (
                <button
                  key={m.name}
                  type="button"
                  onClick={() => selectModel(m.name)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors duration-200 ease-out motion-reduce:transition-none',
                    selectedModel === m.name
                      ? 'bg-[#FFF3D6] dark:bg-accent-soft font-medium text-[#6B3A1F] dark:text-content-accent border border-[#E8DDD0] dark:border-border-default shadow-sm'
                      : 'text-[#8A7D6B] dark:text-content-tertiary hover:bg-[#FDF6E8] dark:hover:bg-white/[0.06] hover:text-[#3A3226] dark:hover:text-content-primary border border-transparent',
                  )}
                >
                  <Database className="h-3.5 w-3.5 shrink-0 opacity-50" />
                  <span className="truncate font-mono text-xs">{m.name}</span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-[#B8A99A] dark:text-content-tertiary">{m.count}</span>
                </button>
              ))}
              {visibleModels.length === 0 && (
                <p className="px-3 py-6 text-center text-xs text-[#B8A99A] dark:text-content-tertiary">No table matches &quot;{tableQuery}&quot;</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Grid */}
        <div className="flex min-h-0 min-w-0 flex-col">
          {!selectedModel ? (
            <Card className={cn('flex h-full flex-col shadow-[0_2px_12px_rgba(58,50,38,0.06)]', COZY.card, COZY.cardBorder)}>
              <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-[#FDF6E8] dark:bg-surface-sunken border border-[#EDE3D3] dark:border-border-default">
                  <Database className="h-7 w-7 text-[#B8A99A] dark:text-content-tertiary" />
                </span>
                <p className={cn('font-medium', COZY.heading)}>Select a table to browse its rows</p>
                <p className="text-sm text-[#8A7D6B] dark:text-content-tertiary">Search 70+ Prisma models with full row control</p>
                <Heart className="h-4 w-4 text-[#D4B896] dark:text-content-metal opacity-60" />
              </CardContent>
            </Card>
          ) : (
            <Card className={cn('flex min-h-0 flex-1 flex-col overflow-hidden py-0 shadow-[0_2px_16px_rgba(58,50,38,0.07)] dark:shadow-none', COZY.card, COZY.cardBorder)}>
              {/* Table toolbar — warm, not stark */}
              <div className="flex flex-wrap items-center gap-2 border-b border-[#EDE3D3] dark:border-border-default bg-[#FDF8F0] dark:bg-surface-canvas/60 px-3 py-2.5">
                <p className={cn('flex items-center gap-2 font-mono text-sm font-semibold', COZY.heading)}>
                  <span className="flex size-7 items-center justify-center rounded-lg bg-[#F5E6CC] dark:bg-accent-soft border border-[#E8DDD0] dark:border-border-default">
                    <KeyRound className="h-3.5 w-3.5 text-[#8B5A2B] dark:text-content-accent" />
                  </span>
                  {selectedModel}
                  <span className="rounded-full bg-[#F5EDE0] dark:bg-surface-sunken px-2 py-0.5 font-mono text-[10px] font-medium text-[#8A7D6B] dark:text-content-tertiary border border-[#EDE3D3] dark:border-border-default">{total} rows</span>
                </p>

                <div className="relative ml-auto">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#B8A99A] dark:text-content-tertiary" />
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search rows…"
                    className="h-8 w-48 pl-8 text-xs rounded-full bg-[#FFFBF5] dark:bg-surface-card border-[#E8DDD0] dark:border-border-default placeholder:text-[#B8A99A] dark:text-content-tertiary focus-visible:ring-[#D4B896]/40"
                  />
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-full border-[#E8DDD0] dark:border-border-default bg-[#FFFBF5] dark:bg-surface-card text-[#8A7D6B] dark:text-content-tertiary hover:bg-[#F5EDE0] dark:hover:bg-white/[0.08] hover:text-[#3A3226] dark:hover:text-content-primary transition-colors duration-200 ease-out"
                  disabled={refreshing}
                  onClick={handleRefresh}
                  aria-label="Refresh"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
                </Button>

                <Button size="sm" className="h-8 gap-1.5 rounded-full bg-[#8B5A2B] dark:bg-accent text-white hover:bg-[#6B3A1F] dark:hover:bg-accent-hover shadow-sm" onClick={() => setCreatingRow(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  New row
                </Button>

                {selectedIds.size > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 rounded-full border-[#E8DDD0] dark:border-border-default bg-[#FFFBF5] dark:bg-surface-card text-[#8B5A2B] dark:text-content-accent hover:bg-[#FFF3D6] dark:hover:bg-accent-soft"
                    onClick={() => void handleBulkDelete()}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete {selectedIds.size}
                  </Button>
                )}
              </div>

              <div ref={tableScrollRef} className="min-h-0 flex-1 overflow-auto scroll-smooth overscroll-contain bg-[#FFFBF5] dark:bg-surface-card">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className={cn('border-b', COZY.tableHead, 'border-[#EDE3D3] dark:border-border-default')}>
                      <th className="w-10 px-2 py-2">
                        <input type="checkbox" checked={isAllSelected} onChange={toggleSelectAll} className="h-3.5 w-3.5 accent-[#8B5A2B] rounded" aria-label="Select all" />
                      </th>
                      <th className={cn('px-2 py-2 text-left font-semibold', COZY.tableHeadText)}>ID</th>
                      {fields
                        .filter((f) => f !== 'id')
                        .map((col) => (
                          <th key={col} className={cn('min-w-35 whitespace-nowrap px-2 py-2 text-left font-semibold', COZY.tableHeadText)}>
                            <span className="flex items-center gap-1">
                              {col}
                              {isIdField(col) && <KeyRound className="h-3 w-3 text-[#C9A86A] dark:text-content-metal" />}
                            </span>
                          </th>
                        ))}
                      <th className={cn('sticky right-0 px-2 py-2 text-right font-semibold shadow-[-4px_0_8px_rgba(0,0,0,0.04)]', COZY.tableHead, COZY.tableHeadText)}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={fields.length + 2} className="px-4 py-16 text-center text-sm text-[#8A7D6B] dark:text-content-tertiary">
                          No rows match — try a different search
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr
                          key={row.id}
                          className={cn('group border-b border-[#F0E6D3] dark:border-border-subtle last:border-0 transition-colors duration-200 ease-out', selectedIds.has(row.id) ? COZY.rowSelected : COZY.rowHover)}
                        >
                          <td className="px-2 py-1.5">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(row.id)}
                              onChange={() => toggleSelected(row.id)}
                              className="h-3.5 w-3.5 accent-[#8B5A2B] rounded"
                              aria-label="Select row"
                            />
                          </td>
                          <td className="max-w-40 px-2 py-1.5">
                            <button
                              type="button"
                              onClick={() => openDetail(row)}
                              className="block w-full truncate rounded-full px-2 py-0.5 text-left font-mono text-[11px] text-[#8B5A2B] dark:text-content-accent hover:bg-white dark:hover:bg-white/10 border border-transparent hover:border-[#EDE3D3] dark:hover:border-white/20 transition-colors duration-200 ease-out"
                              title={row.id}
                            >
                              {row.id}
                            </button>
                          </td>
                          {fields
                            .filter((f) => f !== 'id')
                            .map((col) => {
                              const value = row[col];
                              const isEditing = editingCell?.rowId === row.id && editingCell.field === col;
                              return (
                                <td key={col} className="max-w-60 px-2 py-1.5">
                                  {isEditing ? (
                                    <div className="flex items-center gap-1">
                                      <input
                                        autoFocus
                                        value={editingCell.value}
                                        onChange={(e) => setEditingCell((c) => (c ? { ...c, value: e.target.value } : c))}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') void handleCellSave();
                                          if (e.key === 'Escape') setEditingCell(null);
                                        }}
                                        className="h-7 w-full rounded-full border border-[#D4B896] dark:border-border-default bg-[#FFFBF5] dark:bg-surface-card px-2.5 font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-[#D4B896]/30"
                                      />
                                      <Button
                                        size="icon"
                                        className="h-7 w-7 shrink-0 rounded-full bg-[#8B5A2B] dark:bg-accent text-white hover:bg-[#6B3A1F] dark:hover:bg-accent-hover"
                                        onClick={() => void handleCellSave()}
                                        aria-label="Save"
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => openCellEditor(row, col)}
                                      className={cn(
                                        'block w-full truncate rounded-full px-2 py-0.5 text-left font-mono text-[11px] transition-colors border border-transparent',
                                        isIdField(col) && typeof value === 'string'
                                          ? 'text-[#8B5A2B] dark:text-content-accent hover:bg-white dark:hover:bg-white/10 hover:border-[#EDE3D3] dark:hover:border-white/20'
                                          : 'text-[#6B5D4D] dark:text-content-secondary hover:bg-white dark:hover:bg-white/10 hover:border-[#EDE3D3] dark:hover:border-white/20',
                                      )}
                                      title={detailText(value)}
                                    >
                                      {cellText(value)}
                                    </button>
                                  )}
                                </td>
                              );
                            })}
                          <td className="sticky right-0 px-2 py-1.5 relative bg-[#FFFBF5] dark:bg-surface-card shadow-[-8px_0_12px_#FFFBF5] dark:shadow-[-8px_0_12px_#1F1D1B] before:absolute before:inset-y-0 before:-left-4 before:w-4 before:bg-gradient-to-r before:from-transparent before:to-[#FFFBF5] dark:before:to-[#1F1D1B] before:pointer-events-none">
                            <div className="flex items-center justify-end gap-1 transition-opacity duration-200 ease-out motion-reduce:transition-none">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-full text-[#8A7D6B] dark:text-content-tertiary hover:bg-[#F5EDE0] dark:hover:bg-white/[0.08] hover:text-[#3A3226] dark:hover:text-content-primary transition-colors duration-200 ease-out"
                                onClick={() => void handleDuplicate(row)}
                                aria-label="Duplicate"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-full text-[#B07A6A] dark:text-content-danger hover:bg-[#FFF0EB] dark:hover:bg-danger-soft hover:text-[#8B3A2B] dark:text-content-danger transition-colors duration-200"
                                onClick={() => void handleDelete(row)}
                                aria-label="Delete"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-[#EDE3D3] dark:border-border-default bg-[#FDF8F0] dark:bg-surface-canvas/50 px-3 py-2">
                <p className="text-[11px] text-[#8A7D6B] dark:text-content-tertiary">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-full border-[#E8DDD0] dark:border-border-default bg-[#FFFBF5] dark:bg-surface-card text-xs text-[#6B5D4D] dark:text-content-secondary hover:bg-[#F5EDE0] dark:hover:bg-surface-sunken"
                    disabled={page <= 1}
                    onClick={() => pushState({ page: page - 1 })}
                  >
                    Prev
                  </Button>
                  <span className="rounded-full bg-[#F5EDE0] dark:bg-surface-sunken px-3 py-1 text-xs font-medium text-[#6B5D4D] dark:text-content-secondary border border-[#EDE3D3] dark:border-border-default">
                    {page} / {pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-full border-[#E8DDD0] dark:border-border-default bg-[#FFFBF5] dark:bg-surface-card text-xs text-[#6B5D4D] dark:text-content-secondary hover:bg-[#F5EDE0] dark:hover:bg-surface-sunken"
                    disabled={page >= pageCount}
                    onClick={() => pushState({ page: page + 1 })}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* New row sheet */}
      <Sheet open={creatingRow} onOpenChange={(open) => !open && setCreatingRow(false)}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg bg-[#FFFBF5] dark:bg-surface-card border-l border-[#EDE3D3] dark:border-border-default data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right duration-300">

          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 font-mono text-sm text-[#3A3226] dark:text-content-primary">
              <Plus className="h-4 w-4 text-[#8B5A2B] dark:text-content-accent" />
              New row · {selectedModel}
            </SheetTitle>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
            <p className="text-xs text-[#8A7D6B] dark:text-content-tertiary">Paste a JSON object. Only fields the table defines are accepted.</p>
            <textarea
              value={createJson}
              onChange={(e) => setCreateJson(e.target.value)}
              spellCheck={false}
              className="h-[50dvh] w-full resize-none rounded-2xl border border-[#E8DDD0] dark:border-border-default bg-white dark:bg-surface-card p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#D4B896]/30"
            />
            <div className="mt-auto flex items-center justify-end gap-2">
              <Button variant="outline" className="rounded-full border-[#E8DDD0] dark:border-border-default bg-white dark:bg-surface-card" onClick={() => setCreatingRow(false)}>
                <X className="mr-1 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={() => void handleCreate()} className="gap-2 rounded-full bg-[#8B5A2B] dark:bg-accent text-white hover:bg-[#6B3A1F] dark:hover:bg-accent-hover">
                <Plus className="h-4 w-4" />
                Save
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Detail drawer — prevent scroll jump on open */}
      <Sheet modal={false} open={detailRow !== null} onOpenChange={(open) => !open && setDetailRow(null)}>
        <SheetContent
          side="right"
          className="flex w-full flex-col sm:max-w-xl bg-[#FFFBF5] dark:bg-surface-card border-l border-[#EDE3D3] dark:border-border-default shadow-2xl data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right duration-300"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {detailRow && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 font-mono text-sm text-[#3A3226] dark:text-content-primary">
                  <KeyRound className="h-4 w-4 text-[#8B5A2B] dark:text-content-accent" />
                  {selectedModel}
                  <span className="max-w-65 truncate text-[#8A7D6B] dark:text-content-tertiary">· {detailRow.id}</span>
                </SheetTitle>
              </SheetHeader>
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
                <pre className="overflow-auto whitespace-pre-wrap rounded-2xl border border-[#E8DDD0] dark:border-border-default bg-white dark:bg-surface-card p-3 font-mono text-xs leading-relaxed text-[#3A3226] dark:text-content-primary">
                  {JSON.stringify(detailRow, null, 2)}
                </pre>
                <div className="mt-auto flex items-center justify-end gap-2">
                  <Button onClick={() => void handleDuplicate(detailRow)} variant="outline" className="gap-1.5 rounded-full border-[#E8DDD0] dark:border-border-default bg-white dark:bg-surface-card">
                    <Copy className="h-4 w-4" />
                    Duplicate
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-1.5 rounded-full border-[#E8DDD0] dark:border-border-default bg-white dark:bg-surface-card text-[#B07A6A] dark:text-content-danger hover:bg-[#FFF0EB] dark:hover:bg-danger-soft"
                    onClick={() => {
                      void handleDelete(detailRow);
                      setDetailRow(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportFile(file);
        }}
      />
    </>
  );

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-[#3A3226] dark:text-content-primary sm:text-3xl">
          <span className="flex size-8 items-center justify-center rounded-xl bg-[#F5E6CC] dark:bg-accent-soft border border-[#E8DDD0] dark:border-border-default">
            <Database className="h-4 w-4 text-[#8B5A2B] dark:text-content-accent" />
          </span>
          Data Browser
          <Heart className="h-4 w-4 text-[#D4B896] dark:text-content-metal opacity-50" />
        </h1>
        <p className="text-sm text-[#8A7D6B] dark:text-content-tertiary">Browse, edit and export any table — cozy god-mode</p>
      </div>
      <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
        <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2 rounded-full border-[#E8DDD0] dark:border-border-default bg-[#FFFBF5] dark:bg-surface-card text-[#6B5D4D] dark:text-content-secondary hover:bg-[#F5EDE0] dark:hover:bg-surface-sunken">
          <Upload className="h-4 w-4" />
          Import
        </Button>
        <Button onClick={() => void handleExport()} className="gap-2 rounded-full bg-[#8B5A2B] dark:bg-accent text-white hover:bg-[#6B3A1F] dark:hover:bg-accent-hover shadow-sm">
          <Download className="h-4 w-4" />
          Export
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setFullscreen((f) => !f)}
          aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          className="hidden h-9 w-9 rounded-full border-[#E8DDD0] dark:border-border-default bg-[#FFFBF5] dark:bg-surface-card hover:bg-[#F5EDE0] dark:hover:bg-white/[0.08] transition-colors duration-200 ease-out sm:inline-flex"
        >
          {fullscreen ? <Minimize2 className="h-4 w-4 text-[#6B5D4D] dark:text-content-secondary" /> : <Maximize2 className="h-4 w-4 text-[#6B5D4D] dark:text-content-secondary" />}
        </Button>
      </div>
    </div>
  );

  if (fsRender && typeof document !== 'undefined') {
    return createPortal(
      <div className={`fixed inset-0 z-[200] flex flex-col overflow-hidden bg-[#FDF8F0] dark:bg-surface-canvas transition-[opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${fsEnter ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        {/* Top bar — always visible, cozy, with two exit paths */}
        <div className={`flex shrink-0 items-center justify-between gap-3 border-b border-[#EDE3D3] dark:border-border-default bg-[#FFFBF5] dark:bg-surface-card px-4 py-3 shadow-sm sm:px-6 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${fsEnter ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"}`}>
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="outline"
              size="sm"
              onClick={exitFullscreen}
              className="shrink-0 gap-1.5 rounded-full border-[#D4B896] dark:border-white/20 bg-white dark:bg-white/10 text-[#6B3A1F] dark:text-white hover:bg-[#FFF3D6] dark:hover:bg-white dark:hover:text-[#1F1D1B] shadow-sm"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <span className="hidden h-6 w-px bg-[#EDE3D3] sm:block" aria-hidden />
            <span className="flex size-8 items-center justify-center rounded-xl bg-[#F5E6CC] dark:bg-accent-soft border border-[#E8DDD0] dark:border-border-default shrink-0">
              <Database className="h-4 w-4 text-[#8B5A2B] dark:text-content-accent" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-none text-[#3A3226] dark:text-content-primary sm:text-lg">Data Browser</h1>
              <p className="hidden text-xs text-[#8A7D6B] dark:text-content-tertiary sm:block">Fullscreen — press Esc or Back to exit</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 overflow-visible">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="hidden gap-2 rounded-full border-[#E8DDD0] dark:border-border-default bg-white dark:bg-surface-card sm:inline-flex"
              size="sm"
            >
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Button onClick={() => void handleExport()} className="hidden gap-2 rounded-full bg-[#8B5A2B] dark:bg-accent text-white hover:bg-[#6B3A1F] dark:hover:bg-accent-hover sm:inline-flex" size="sm">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <button
              type="button"
              onClick={exitFullscreen}
              aria-label="Exit fullscreen"
              title="Exit fullscreen (Esc)"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#141414] text-white hover:bg-black border border-black/10 dark:bg-white dark:text-[#141414] dark:hover:bg-[#F7F4EF] dark:border-white/20 shadow-md transition-colors"
            >
              <X className="h-4 w-4 shrink-0" aria-hidden />
            </button>
          </div>
        </div>
        <div className={`min-h-0 flex-1 overflow-hidden p-3 sm:p-4 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${fsEnter ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`}>{browserBody}</div>
      </div>,
      document.body,
    );
  }

  return (
    <div className={cn('flex min-h-0 flex-col transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none', fsRender ? 'opacity-0 pointer-events-none h-0 overflow-hidden' : 'opacity-100 lg:h-[calc(100dvh-6rem)]')}>
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col">
        <div className="-mx-4 mb-4 shrink-0 border-b border-[#EDE3D3] dark:border-border-default/60 bg-[#FDF8F0] dark:bg-surface-canvas/40 px-4 py-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">{header}</div>
        <div className="min-h-0 flex-1">{browserBody}</div>
      </div>
    </div>
  );
}
