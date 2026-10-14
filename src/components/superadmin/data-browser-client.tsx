'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';


import { useRouter } from '@/i18n/routing';
import { toast } from 'sonner';
import {
  Copy,
  Database,
  Download,
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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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

  // Keep URL in sync when model/search/page change — full reload via router.push keeps server data fresh.
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

  // Debounced search → URL (300ms like hr-project).
  useEffect(() => {
    if (searchInput === initialQuery) return;
    const id = setTimeout(() => pushState({ q: searchInput, page: 1 }), 300);
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
    setTimeout(() => setRefreshing(false), 400);
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

  const browserBody = (
    <>
      <div className={cn('grid h-full gap-4', fullscreen ? 'grid-cols-[280px_minmax(0,1fr)]' : 'grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]')}>
        {/* Sidebar */}
        <Card className="flex min-h-0 flex-col overflow-hidden py-0">
          <CardContent className="flex min-h-0 flex-col p-2">
            <div className="mb-2 flex items-center justify-between px-2 pt-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Database className="h-4 w-4 text-accent" />
                Tables
                <Badge variant="neutral" size="sm">
                  {models.length}
                </Badge>
              </p>
            </div>

            <div className="relative mb-2 px-1">
              <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={tableQuery} onChange={(e) => setTableQuery(e.target.value)} placeholder="Find a table…" className="h-8 pl-8 text-xs" />
            </div>

            <div className="mb-2 flex flex-wrap gap-1 px-1">
              {sortedModels
                .filter((m) => ['User', 'Booking', 'Order', 'DanceClass', 'Venue', 'Product'].includes(m.name))
                .map((m) => (
                  <button
                    key={m.name}
                    type="button"
                    onClick={() => selectModel(m.name)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                      selectedModel === m.name ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {m.name}
                  </button>
                ))}
            </div>

            <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
              {visibleModels.map((m) => (
                <button
                  key={m.name}
                  type="button"
                  onClick={() => selectModel(m.name)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    selectedModel === m.name ? 'bg-accent-soft font-medium text-accent' : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  <Database className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="truncate font-mono text-xs">{m.name}</span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">{m.count}</span>
                </button>
              ))}
              {visibleModels.length === 0 && <p className="px-3 py-6 text-center text-xs text-muted-foreground">No table matches &quot;{tableQuery}&quot;</p>}
            </div>
          </CardContent>
        </Card>

        {/* Grid */}
        <div className="flex min-h-0 min-w-0 flex-col">
          {!selectedModel ? (
            <Card className="flex h-full flex-col">
              <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center">
                <Database className="h-12 w-12 opacity-30" />
                <p className="font-medium">Select a table to browse its rows</p>
                <p className="text-sm text-muted-foreground">Search 70+ Prisma models with full row control</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden py-0">
              <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
                <p className="flex items-center gap-2 font-mono text-sm font-semibold">
                  <KeyRound className="h-4 w-4 text-accent" />
                  {selectedModel}
                  <Badge variant="neutral" size="sm">
                    {total} rows
                  </Badge>
                </p>

                <div className="relative ml-auto">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search rows…"
                    className="h-8 w-48 pl-8 text-xs"
                  />
                </div>

                <Button variant="outline" size="icon" className="h-8 w-8" disabled={refreshing} onClick={handleRefresh} aria-label="Refresh">
                  <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
                </Button>

                <Button size="sm" className="h-8 gap-1.5" onClick={() => setCreatingRow(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  New row
                </Button>

                {selectedIds.size > 0 && (
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => void handleBulkDelete()}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete {selectedIds.size}
                  </Button>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b bg-muted">
                      <th className="w-10 px-2 py-2">
                        <input type="checkbox" checked={isAllSelected} onChange={toggleSelectAll} className="h-3.5 w-3.5" aria-label="Select all" />
                      </th>
                      <th className="px-2 py-2 text-left font-semibold text-muted-foreground">ID</th>
                      {fields
                        .filter((f) => f !== 'id')
                        .map((col) => (
                          <th key={col} className="min-w-35 whitespace-nowrap px-2 py-2 text-left font-semibold text-muted-foreground">
                            <span className="flex items-center gap-1">
                              {col}
                              {isIdField(col) && <KeyRound className="h-3 w-3 text-amber-500" />}
                            </span>
                          </th>
                        ))}
                      <th className="sticky right-0 bg-muted px-2 py-2 text-right font-semibold text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={fields.length + 2} className="px-4 py-16 text-center text-sm text-muted-foreground">
                          No rows match
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={row.id} className={cn('border-b last:border-0 transition-colors', selectedIds.has(row.id) ? 'bg-accent-soft/50' : 'hover:bg-muted/50')}>
                          <td className="px-2 py-1.5">
                            <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleSelected(row.id)} className="h-3.5 w-3.5" aria-label="Select row" />
                          </td>
                          <td className="max-w-40 px-2 py-1.5">
                            <button
                              type="button"
                              onClick={() => setDetailRow(row)}
                              className="block w-full truncate rounded px-1 py-0.5 text-left font-mono text-[11px] text-accent hover:bg-accent-soft"
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
                                        className="h-7 w-full rounded-md border border-accent bg-background px-1.5 font-mono text-[11px] focus:outline-none"
                                      />
                                      <Button size="icon" className="h-7 w-7 shrink-0" onClick={() => void handleCellSave()} aria-label="Save">
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => openCellEditor(row, col)}
                                      className={cn(
                                        'block w-full truncate rounded px-1 py-0.5 text-left font-mono text-[11px] transition-colors',
                                        isIdField(col) && typeof value === 'string' ? 'text-accent hover:bg-accent-soft' : 'text-muted-foreground hover:bg-muted',
                                      )}
                                      title={detailText(value)}
                                    >
                                      {cellText(value)}
                                    </button>
                                  )}
                                </td>
                              );
                            })}
                          <td className="sticky right-0 bg-card px-2 py-1.5">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => void handleDuplicate(row)} aria-label="Duplicate">
                                <Copy className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => void handleDelete(row)} aria-label="Delete">
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

              <div className="flex items-center justify-between border-t px-3 py-2">
                <p className="text-[11px] text-muted-foreground">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={page <= 1}
                    onClick={() => pushState({ page: page - 1 })}
                  >
                    Prev
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {page} / {pageCount}
                  </span>
                  <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= pageCount} onClick={() => pushState({ page: page + 1 })}>
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
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 font-mono text-sm">
              <Plus className="h-4 w-4 text-accent" />
              New row · {selectedModel}
            </SheetTitle>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
            <p className="text-xs text-muted-foreground">Paste a JSON object. Only fields the table defines are accepted.</p>
            <textarea
              value={createJson}
              onChange={(e) => setCreateJson(e.target.value)}
              spellCheck={false}
              className="h-[50dvh] w-full resize-none rounded-xl border bg-background p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <div className="mt-auto flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setCreatingRow(false)}>
                <X className="mr-1 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={() => void handleCreate()} className="gap-2">
                <Plus className="h-4 w-4" />
                Save
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Detail drawer */}
      <Sheet open={detailRow !== null} onOpenChange={(open) => !open && setDetailRow(null)}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-xl">
          {detailRow && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 font-mono text-sm">
                  <KeyRound className="h-4 w-4 text-accent" />
                  {selectedModel}
                  <span className="max-w-65 truncate text-muted-foreground">· {detailRow.id}</span>
                </SheetTitle>
              </SheetHeader>
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
                <pre className="overflow-auto whitespace-pre-wrap rounded-xl border bg-muted p-3 font-mono text-xs leading-relaxed">
                  {JSON.stringify(detailRow, null, 2)}
                </pre>
                <div className="mt-auto flex items-center justify-end gap-2">
                  <Button onClick={() => void handleDuplicate(detailRow)} variant="outline" className="gap-1.5">
                    <Copy className="h-4 w-4" />
                    Duplicate
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
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
        <h1 className="mb-1 text-2xl font-bold tracking-tight sm:text-3xl">Data Browser</h1>
        <p className="text-sm text-muted-foreground">Browse, edit and export any table — fullscreen god-mode</p>
      </div>
      <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
        <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
          <Upload className="h-4 w-4" />
          Import
        </Button>
        <Button onClick={() => void handleExport()} className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
        <Button variant="outline" size="icon" onClick={() => setFullscreen((f) => !f)} aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} className="h-9 w-9">
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );

  if (fullscreen && typeof document !== 'undefined') {
    return createPortal(
      <div className="fixed inset-0 z-[200] flex flex-col overflow-hidden bg-background">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent-soft">
              <Database className="h-4 w-4 text-accent" />
            </span>
            <div>
              <h1 className="text-lg font-bold">Data Browser</h1>
              <p className="text-xs text-muted-foreground">Fullscreen — rows scroll here, the shell stays behind</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Button onClick={() => void handleExport()} className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" size="icon" onClick={() => setFullscreen(false)} aria-label="Exit fullscreen" className="h-9 w-9">
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-4">{browserBody}</div>
      </div>,
      document.body,
    );
  }

  return (
    <div className="flex min-h-0 flex-col lg:h-[calc(100dvh-6rem)]">
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col">
        <div className="-mx-4 mb-4 shrink-0 border-b px-4 py-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">{header}</div>
        <div className="min-h-0 flex-1">{browserBody}</div>
      </div>
    </div>
  );
}
