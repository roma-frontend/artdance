'use client';

import { useAction } from 'next-safe-action/hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter } from '@/i18n/routing';
import { completeOperatorCommand, exportOperatorModel, replyToSupportTicket, resetTranslationOverride, revokeSession, runOperatorCommand, runOperatorJob, saveTranslationOverride, setFeatureFlag, startImpersonation, stopImpersonation } from '@/server/actions/admin/operator';
import type { TerminalCompletion } from '@/server/terminal/commands';
import { terminalCommands } from '@/server/terminal/registry';

export function SessionRevokeButton({ id }: { id: string }) {
  const t = useTranslations('admin.support');
  const router = useRouter();
  const action = useAction(revokeSession, { onSuccess: () => router.refresh() });
  return <Button size="sm" variant="outline" pending={action.status === 'executing'} onClick={() => action.execute({ sessionId: id })}>{t('revokeSession')}</Button>;
}

export function JobButton({ job }: { job: 'booking' | 'holds' | 'trash' | 'digest' | 'sla' }) {
  const t = useTranslations('admin.support');
  const action = useAction(runOperatorJob);
  const label = t(`job${job.charAt(0).toUpperCase()}${job.slice(1)}` as 'jobBooking');
  return <Button size="sm" variant="outline" pending={action.status === 'executing'} onClick={() => action.execute({ job })}>{label} · {t('runJob')}</Button>;
}

export function TranslationEditor({ row }: { row: { key: string; values: Record<string, { text: string; overridden: boolean }> } }) {
  const t = useTranslations('admin.support');
  const router = useRouter();
  const [locale, setLocale] = useState('ru');
  const [value, setValue] = useState(row.values.ru?.text ?? '');
  const save = useAction(saveTranslationOverride, { onSuccess: () => router.refresh() });
  const reset = useAction(resetTranslationOverride, { onSuccess: () => router.refresh() });
  const selected = row.values[locale];
  const changeLocale = (next: string) => { setLocale(next); setValue(row.values[next]?.text ?? ''); };
  return (
    <div className="grid gap-2 md:grid-cols-[minmax(12rem,0.8fr)_5rem_minmax(15rem,1fr)_auto] md:items-center">
      <code className="truncate text-caption text-content-primary" title={row.key}>{row.key}</code>
      <select className="h-11 rounded-full border border-border-default bg-surface-card px-3 text-caption" value={locale} onChange={(event) => changeLocale(event.target.value)} aria-label={t('translationKey')}>
        {Object.keys(row.values).map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}
      </select>
      <Input value={value} onChange={(event) => setValue(event.target.value)} aria-label={t('translationValue')} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" pending={save.status === 'executing'} onClick={() => save.execute({ key: row.key, locale: locale as 'en' | 'ru' | 'hy', value })}>{t('saveOverride')}</Button>
        {selected?.overridden ? <Button size="sm" variant="ghost" pending={reset.status === 'executing'} onClick={() => reset.execute({ key: row.key, locale: locale as 'en' | 'ru' | 'hy' })}>{t('resetOverride')}</Button> : null}
      </div>
    </div>
  );
}

export function ExportModelButton({ model }: { model: string }) {
  const t = useTranslations('admin.support');
  const action = useAction(exportOperatorModel);
  const run = async () => {
    const result = await action.executeAsync({ model });
    if (!result?.data) return;
    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${model.toLowerCase()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return <Button size="sm" variant="outline" pending={action.status === 'executing'} onClick={() => void run()}>{t('exportData')}</Button>;
}

export function ImpersonationButton({ userId }: { userId: string }) {
  const t = useTranslations('admin.support');
  const action = useAction(startImpersonation, { onSuccess: () => window.location.reload() });
  return <Button size="sm" variant="outline" pending={action.status === 'executing'} onClick={() => action.execute({ userId })}>{t('impersonate')}</Button>;
}

export function StopImpersonationButton() {
  const t = useTranslations('admin.support');
  const action = useAction(stopImpersonation, { onSuccess: () => window.location.reload() });
  return <Button size="sm" variant="outline" pending={action.status === 'executing'} onClick={() => action.execute({})}>{t('stopImpersonation')}</Button>;
}

export function OperatorTerminal() {
  const t = useTranslations('admin.support');
  const action = useAction(runOperatorCommand);
  const completionAction = useAction(completeOperatorCommand);
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<Array<{ cmd: string; lines: string[]; ok: boolean }>>([]);
  const [cursor, setCursor] = useState(-1);
  const [dismissed, setDismissed] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteMode, setPaletteMode] = useState<'commands' | 'context' | 'history'>('commands');
  const [contextCompletions, setContextCompletions] = useState<TerminalCompletion[] | null>(null);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const paletteInputRef = useRef<HTMLInputElement>(null);

  const completions = useMemo(() => {
    const raw = command.trimStart().toLowerCase();
    if (!raw) return terminalCommands.map((c) => c.name);
    if (!raw.includes(' ')) return terminalCommands.map((c) => c.name).filter((n) => n.startsWith(raw));
    if (raw.startsWith('db ')) {
      const after = raw.slice(3);
      if (/^\s*create\s+\S+\s*/.test(after)) {
        const flags = ['--data', '--dry-run'];
        const last = after.trim().split(/\s+/).pop() ?? '';
        if (last.startsWith('--')) return flags.filter((f) => f.startsWith(last));
        return flags;
      }
      if (/^\s*update\s+\S+\s+\S+\s*/.test(after)) {
        const flags = ['--set', '--dry-run'];
        const last = after.trim().split(/\s+/).pop() ?? '';
        if (last.startsWith('--')) return flags.filter((f) => f.startsWith(last));
        return flags;
      }
      if (/^\s*delete\s+\S+\s+\S+/.test(after)) {
        const flags = ['--force', '--hard', '--dry-run'];
        const last = after.trim().split(/\s+/).pop() ?? '';
        if (last.startsWith('--')) return flags.filter((f) => f.startsWith(last));
        return flags.filter((f) => !after.includes(f));
      }
      if (/^\s*(get|fields)\s+\S*/.test(after)) return [];
      if (/^\s*(find|count)\b/.test(after)) {
        const flags = ['--where', '--take', '--q'];
        const last = after.trim().split(/\s+/).pop() ?? '';
        if (last.startsWith('--')) return flags.filter((f) => f.startsWith(last));
        return [];
      }
      const subs = ['models', 'counts', 'count', 'find', 'get', 'fields', 'create', 'update', 'delete', 'restore', 'help'];
      const rest = after.trim();
      if (!rest) return subs;
      if (rest.includes(' ')) {
        const first = rest.split(/\s+/)[0] ?? '';
        return subs.filter((s) => s.startsWith(first));
      }
      return subs.filter((s) => s.startsWith(rest));
    }
    if (raw.startsWith('carts ')) {
      const rest = raw.slice(6).trim();
      if (!rest) return ['stats', 'purge', 'help'];
      if (rest.startsWith('purge')) {
        const last = rest.split(/\s+/).pop() ?? '';
        const flags = ['--empty', '--anon', '--older-than', '--dry-run', '--force'];
        if (last.startsWith('--')) return flags.filter((f) => f.startsWith(last));
        return flags.filter((f) => !rest.includes(f));
      }
      return ['stats', 'purge', 'help'].filter((s) => s.startsWith(rest));
    }
    if (raw.startsWith('inspect ')) {
      const rest = raw.slice(8).trim();
      if (!rest || !rest.includes(' ')) return ['User', 'Order', 'Booking', 'SupportTicket'].filter((s) => s.toLowerCase().startsWith(rest));
      return [];
    }
    if (raw.startsWith('classes')) return ['classes salsa --take 5', 'classes --take 10'];
    if (raw.startsWith('media ')) return ['media DanceClass ', 'media Product ', 'media Instructor '];
    if (raw.startsWith('open ')) return ['open /en/classes/'];
    return [];
  }, [command]);

  type Hint = { label: string; desc: string; sample: string };

  const hint: Hint | null = useMemo(() => {
    const tr = (key: string): string => {
      try { return String((t as unknown as (k: string) => string)(key)); } catch { return key; }
    };
    const raw = command.trimStart();
    if (raw === '') return { label: String(tr('terminalHintStartLabel')), desc: String(tr('terminalHintStartDesc')), sample: 'db ' };
    const hasTrailingSpace = raw.endsWith(' ');
    const parts = raw.trim().split(/\s+/);
    const head = (parts[0] ?? '').toLowerCase();
    if (head !== 'db') {
      if (parts.length === 1 && !hasTrailingSpace) {
        const m = terminalCommands.find((c) => c.name.toLowerCase() === head);
        if (m) return { label: m.usage, desc: m.description, sample: m.examples?.[0] ?? m.usage };
      }
      if (head === 'carts') {
        const sub = (parts[1] ?? '').toLowerCase();
        if (!sub || (!hasTrailingSpace && parts.length === 2)) {
          if (!sub) return { label: 'carts <sub>', desc: String(tr('terminalHintCartsSubDesc')), sample: 'carts stats' };
          if ('stats'.startsWith(sub)) return { label: 'carts stats', desc: String(tr('terminalHintCartsStatsDesc')), sample: 'carts stats' };
          if ('purge'.startsWith(sub)) return { label: 'carts purge --empty [--anon] [--older-than 7d] [--dry-run] [--force]', desc: String(tr('terminalHintCartsPurgeDesc')), sample: 'carts purge --empty --dry-run' };
        }
        if (sub === 'purge' && hasTrailingSpace) return { label: '--empty [--anon] [--older-than 7d] [--dry-run] [--force]', desc: String(tr('terminalHintCartsPurgeFlagsDesc')), sample: 'carts purge --empty --force' };
      }
      return null;
    }
    const after = raw.slice(raw.toLowerCase().indexOf('db') + 2);
    const tokens = after.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return { label: 'db <sub>', desc: String(tr('terminalHintDbSubDesc')), sample: 'db find DanceClass --take 5' };
    if (tokens.length === 1 && !hasTrailingSpace) {
      const sub = tokens[0]!.toLowerCase();
      const subs: Record<string, Hint> = {
        models: { label: 'db models', desc: String(tr('terminalHintDbModelsDesc')), sample: 'db models' },
        counts: { label: 'db counts [Model]', desc: String(tr('terminalHintDbCountsDesc')), sample: 'db counts User' },
        count: { label: 'db count [Model] [--where JSON]', desc: String(tr('terminalHintDbCountDesc')), sample: 'db count User --where {"isActive":true}' },
        find: { label: 'db find [Model] [--where JSON] [--take N] [--q \u0442\u0435\u043A\u0441\u0442]', desc: String(tr('terminalHintDbFindDesc')), sample: 'db find User --take 5' },
        get: { label: 'db get [Model] [id]', desc: String(tr('terminalHintDbGetDesc')), sample: 'db get User [id]' },
        fields: { label: 'db fields [Model]', desc: String(tr('terminalHintDbFieldsDesc')), sample: 'db fields User' },
        create: { label: 'db create [Model] --data JSON', desc: String(tr('terminalHintDbCreateDesc')), sample: 'db create Banner --data {"key":"x","title":"Hi"}' },
        update: { label: 'db update [Model] [id] --set JSON', desc: String(tr('terminalHintDbUpdateDesc')), sample: 'db update User [id] --set {"name":"New"}' },
        delete: { label: 'db delete [Model] [id] --force [--hard]', desc: String(tr('terminalHintDbDeleteDesc')), sample: 'db delete Banner [id] --force' },
        restore: { label: 'db restore [Model] [id]', desc: String(tr('terminalHintDbRestoreDesc')), sample: 'db restore Banner [id]' },
        help: { label: 'db help', desc: String(tr('terminalHintDbHelpDesc')), sample: 'db help' },
      };
      const hit = subs[sub];
      if (hit) return hit;
      const matches = Object.keys(subs).filter((k) => k.startsWith(sub));
      if (matches.length) return { label: 'db ' + matches.join(' | '), desc: String(tr('terminalHintDbContinueDesc')), sample: 'db ' + matches[0] };
      return { label: 'db <unknown>', desc: String(tr('terminalHintDbUnknownDesc')) + ' ' + Object.keys(subs).join(', '), sample: 'db help' };
    }
    const sub = (tokens[0] ?? '').toLowerCase();
    const pos = tokens.slice(1);
    const need = (msg: Hint) => msg;
    if (sub === 'counts') {
      if (pos.length === 0 && hasTrailingSpace) return need({ label: 'db counts [Model]', desc: String(tr('terminalHintDbCountsTrailingDesc')), sample: 'db counts User' });
      return null;
    }
    if (sub === 'count') {
      if (pos.length === 0) return need({ label: 'db count [Model] [--where JSON]', desc: String(tr('terminalHintDbCountNextModel')), sample: 'db count User --where {"isActive":true}' });
      if (pos.length === 1 && !hasTrailingSpace) return need({ label: 'db count ' + pos[0] + ' [--where JSON]', desc: String(tr('terminalHintDbCountWhereOptional')), sample: 'db count ' + pos[0] + ' --where {"email":{"contains":"@"}}' });
      if (pos.length === 1 && hasTrailingSpace) return need({ label: '--where JSON', desc: String(tr('terminalHintDbCountWhereSample')), sample: '--where {"isActive":true}' });
      return null;
    }
    if (sub === 'find') {
      if (pos.length === 0) return need({ label: 'db find [Model] [--where JSON] [--take N] [--q \u0442\u0435\u043A\u0441\u0442]', desc: String(tr('terminalHintDbNextModelGeneric')), sample: 'db find User --take 5' });
      if (pos.length === 1 && !hasTrailingSpace) return need({ label: 'db find ' + pos[0] + ' [--where JSON] [--take N] [--q \u0442\u0435\u043A\u0441\u0442]', desc: String(tr('terminalHintDbFindFlagsOptional')), sample: 'db find ' + pos[0] + ' --take 5' });
      if (pos.length === 1 && hasTrailingSpace) return need({ label: '[--where JSON] [--take N] [--q \u0442\u0435\u043A\u0441\u0442]', desc: String(tr('terminalHintDbFindAllFlagsOptional')), sample: '--take 5 --q salsa' });
      return null;
    }
    if (sub === 'get' || sub === 'fields' || sub === 'restore') {
      if (pos.length === 0) return need({ label: 'db ' + sub + ' [Model]' + (sub !== 'fields' ? ' [id]' : ''), desc: String(tr('terminalHintDbModelAndId')), sample: 'db ' + sub + ' User' + (sub !== 'fields' ? ' [id]' : '') });
      if (pos.length === 1 && !hasTrailingSpace) return need({ label: 'db ' + sub + ' ' + pos[0] + (sub !== 'fields' ? ' [id]' : ''), desc: sub === 'fields' ? String(tr('terminalHintDbFieldsReady')) : String(tr('terminalHintDbNextId')), sample: 'db ' + sub + ' ' + pos[0] + (sub !== 'fields' ? ' [id]' : '') });
      if (pos.length === 1 && hasTrailingSpace) return need({ label: '[id]', desc: String(tr('terminalHintDbIdRequired')), sample: pos[0] + ' [id]' });
      return null;
    }
    if (sub === 'create') {
      if (pos.length === 0) return need({ label: 'db create [Model] --data JSON', desc: String(tr('terminalHintDbNextModelGeneric')), sample: 'db create User --data {"name":"A","email":"a@a.am"}' });
      if (pos.length === 1 && !hasTrailingSpace) return need({ label: 'db create ' + pos[0] + ' --data JSON', desc: String(tr('terminalHintDbDataRequired')), sample: 'db create ' + pos[0] + ' --data {"key":"x"}' });
      if (pos.length === 1 && hasTrailingSpace) return need({ label: '--data JSON', desc: String(tr('terminalHintDbDataSample')), sample: '--data {"name":"Hi"}' });
      return null;
    }
    if (sub === 'update') {
      if (pos.length === 0) return need({ label: 'db update [Model] [id] --set JSON', desc: String(tr('terminalHintDbNextModelGeneric')), sample: 'db update User [id] --set {"name":"New"}' });
      if (pos.length === 1 && !hasTrailingSpace) return need({ label: 'db update ' + pos[0] + ' [id] --set JSON', desc: String(tr('terminalHintDbNextId')), sample: 'db update ' + pos[0] + ' [id] --set {"name":"New"}' });
      if (pos.length === 1 && hasTrailingSpace) return need({ label: '[id] --set JSON', desc: String(tr('terminalHintDbIdSet')), sample: '[id] --set {"name":"New"}' });
      if (pos.length === 2 && !hasTrailingSpace) return need({ label: 'db update ' + pos[0] + ' ' + pos[1] + ' --set JSON', desc: String(tr('terminalHintDbSetRequired')), sample: '--set {"name":"New"}' });
      if (pos.length === 2 && hasTrailingSpace) return need({ label: '--set JSON', desc: String(tr('terminalHintDbSetSample')), sample: '--set {"name":"New","isActive":false}' });
      return null;
    }
    if (sub === 'delete') {
      if (pos.length === 0) return need({ label: 'db delete [Model] [id] --force [--hard]', desc: String(tr('terminalHintDbNextModelGeneric')), sample: 'db delete Banner [id] --force' });
      if (pos.length === 1 && !hasTrailingSpace) return need({ label: 'db delete ' + pos[0] + ' [id] --force [--hard]', desc: String(tr('terminalHintDbNextId')), sample: 'db delete ' + pos[0] + ' [id] --force' });
      if (pos.length === 1 && hasTrailingSpace) return need({ label: '[id] --force [--hard]', desc: String(tr('terminalHintDbIdForce')), sample: '[id] --force' });
      if (pos.length === 2 && !hasTrailingSpace) return need({ label: 'db delete ' + pos[0] + ' ' + pos[1] + ' --force [--hard]', desc: String(tr('terminalHintDbForceRequired')), sample: '--force' });
      if (pos.length === 2 && hasTrailingSpace) return need({ label: '--force [--hard]', desc: String(tr('terminalHintDbForceHardDesc')), sample: '--force --hard' });
      return null;
    }
    return null;
  }, [command, t]);

  const suggestRaw = useMemo(() => {
    const trimmed = command.trim();
    if (!trimmed || trimmed.includes(' ')) return [] as string[];
    const matches = completions;
    return matches.length === 1 && matches[0] === trimmed.toLowerCase() ? [] : matches.slice(0, 6);
  }, [command, completions]);
  const suggest = dismissed === command ? [] : suggestRaw;

  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: history.length <= 1 ? 'auto' : 'smooth' });
    });
    return () => cancelAnimationFrame(raf);
  }, [history]);

  useEffect(() => {
    if (action.status !== 'executing') return;
    const el = logRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(raf);
  }, [action.status]);

  const paletteCommands = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    if (!q) return terminalCommands;
    return terminalCommands.filter((c) => c.name.includes(q) || c.usage.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
  }, [paletteQuery]);

  const paletteItems = useMemo(() => {
    if (paletteMode === 'commands') {
      return paletteCommands.map((item) => ({ value: item.name, label: item.usage, description: item.description }));
    }
    if (paletteMode === 'history') {
      const q = paletteQuery.trim().toLowerCase();
      return [...history].reverse()
        .filter((item) => !q || item.cmd.toLowerCase().includes(q))
        .map((item) => ({ value: item.cmd, label: item.cmd, description: item.ok ? 'ok' : 'failed' }));
    }
    const q = paletteQuery.trim().toLowerCase();
    return (contextCompletions ?? []).filter((item) => !q || item.value.toLowerCase().includes(q) || item.label.toLowerCase().includes(q));
  }, [contextCompletions, history, paletteCommands, paletteMode, paletteQuery]);

  const insertCompletion = (value: string) => {
    if (paletteMode === 'history') {
      setCommand(value);
      setPaletteOpen(false);
      setPaletteQuery('');
      setPaletteIndex(0);
      inputRef.current?.focus();
      return;
    }
    const current = command;
    const lastSpace = current.lastIndexOf(' ');
    setCommand(`${lastSpace >= 0 ? current.slice(0, lastSpace + 1) : ''}${value} `);
    setPaletteOpen(false);
    setPaletteQuery('');
    setPaletteIndex(0);
    inputRef.current?.focus();
  };

  const openPalette = useCallback(async () => {
    setContextCompletions(null);
    setPaletteMode('context');
    setPaletteQuery('');
    setPaletteIndex(0);
    setPaletteOpen(true);
    const result = await completionAction.executeAsync({ command });
    const items = result?.data?.items ?? [];
    setContextCompletions(items);
  }, [command, completionAction]);

  useEffect(() => {
    if (!paletteOpen) return;
    paletteInputRef.current?.focus();
  }, [paletteOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
        if (!paletteOpen && document.activeElement !== inputRef.current) return;
        e.preventDefault();
        if (paletteOpen) setPaletteOpen(false);
        else void openPalette();
      }
      if (e.key === 'Escape' && paletteOpen) setPaletteOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openPalette, paletteOpen]);

  const run = async (override?: string) => {
    const raw = (override ?? command).trim();
    if (!raw) return;
    if (raw === 'clear') {
      setHistory([]);
      setCommand('');
      setCursor(-1);
      return;
    }
    const result = await action.executeAsync({ command: raw });
    const lines = result?.data?.lines ?? [];
    const ok = Boolean(result?.data?.ok);
    setHistory((prev) => [...prev, { cmd: raw, lines, ok }]);
    setCommand('');
    setCursor(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void run();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const next = cursor === -1 ? history.length - 1 : Math.max(0, cursor - 1);
      setCursor(next);
      setCommand(history[next]?.cmd ?? '');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (cursor === -1) return;
      const next = cursor + 1;
      if (next >= history.length) {
        setCursor(-1);
        setCommand('');
      } else {
        setCursor(next);
        setCommand(history[next]?.cmd ?? '');
      }
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const m = completions[0];
      if (!m) return;
      // complete first token or subcommand
      if (!command.includes(' ')) setCommand(m + ' ');
      else {
        const parts = command.trimEnd().split(/\s+/);
        parts[parts.length - 1] = m;
        setCommand(parts.join(' ') + ' ');
      }
      return;
    }
    if (e.key === 'Escape') setDismissed(command);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      setPaletteMode('history');
      setPaletteQuery('');
      setPaletteIndex(0);
      setPaletteOpen(true);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Ctrl+Space palette — values are resolved against the live DB. */}
      {paletteOpen ? (
        <div className="fixed inset-0 z-[1700] flex items-start justify-center bg-black/50 p-4 pt-[max(1.25rem,calc(var(--layout-nav-height)+0.75rem))]" onClick={() => setPaletteOpen(false)}>
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border-default bg-surface-card shadow-2xl dark:border-zinc-700 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-border-default p-3 dark:border-zinc-700">
              <span className="font-mono text-caption text-content-tertiary dark:text-zinc-500">{paletteMode === 'history' ? 'Ctrl+R' : 'Ctrl+Space'}</span>
              <input
                ref={paletteInputRef}
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                placeholder={paletteMode === 'context' ? 'Filter valid values…' : paletteMode === 'history' ? 'Search command history…' : String(t('terminalPaletteSearch' as never) ?? 'Search commands…')}
                className="flex-1 bg-transparent font-mono text-caption text-content-primary placeholder:text-content-tertiary focus:outline-none dark:text-zinc-100"
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setPaletteIndex((index) => Math.min(index + 1, Math.max(0, paletteItems.length - 1))); }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setPaletteIndex((index) => Math.max(0, index - 1)); }
                  if (e.key === 'Enter' && paletteItems[paletteIndex]) { e.preventDefault(); insertCompletion(paletteItems[paletteIndex]!.value); }
                }}
              />
              <button type="button" onClick={() => setPaletteOpen(false)} className="rounded-full border border-border-default px-2 py-1 font-mono text-caption text-content-secondary dark:border-zinc-700 dark:text-zinc-400">
                Esc
              </button>
            </div>
            <div className="max-h-80 overflow-auto p-2">
              {completionAction.status === 'executing' ? <p className="px-3 py-4 text-center text-caption text-content-tertiary">Loading valid values…</p> : null}
              {paletteItems.map((item, index) => (
                <button
                  key={`${item.value}-${index}`}
                  type="button"
                  onClick={() => insertCompletion(item.value)}
                  className={`flex w-full flex-col gap-0.5 rounded-xl px-3 py-2 text-left hover:bg-surface-sunken dark:hover:bg-zinc-800 ${index === paletteIndex ? 'bg-surface-sunken dark:bg-zinc-800' : ''}`}
                >
                  <span className="font-mono text-caption font-semibold text-content-primary dark:text-zinc-100">{item.label}</span>
                  {item.description ? <span className="text-caption text-content-secondary dark:text-zinc-400">{item.description}</span> : null}
                </button>
              ))}
              {completionAction.status !== 'executing' && paletteItems.length === 0 ? <p className="px-3 py-4 text-center text-caption text-content-tertiary">{paletteMode === 'context' ? 'No valid values at this position.' : String(t('terminalPaletteEmpty' as never) ?? 'Nothing found')}</p> : null}
            </div>
            <p className="border-t border-border-default px-3 py-2 font-mono text-caption text-content-tertiary dark:border-zinc-700 dark:text-zinc-500">↑/↓ — select · Enter — insert · Esc — close</p>
          </div>
        </div>
      ) : null}

      {/* Command reference — follows site theme (light → light card, dark → zinc) */}
      <div className="overflow-hidden rounded-2xl border border-border-default bg-surface-card dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-border-default bg-surface-sunken px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800/50">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-mono text-caption font-semibold tracking-wide text-content-primary dark:text-zinc-100">{String(t('terminalCommandsTitle' as never) ?? 'КОМАНДЫ')}</h2>
            <button
              type="button"
              onClick={() => void openPalette()}
              className="rounded-full border border-border-default bg-surface-card px-3 py-1 font-mono text-caption text-content-secondary hover:bg-surface-sunken dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {String(t('terminalPaletteOpen' as never) ?? 'Ctrl+Space — all commands')}
            </button>
          </div>
          <p className="mt-2 font-mono text-caption leading-relaxed text-content-secondary dark:text-zinc-400">{String(t('terminalCommandsHint' as never) ?? 'Tab — autocomplete · ↑/↓ — history · Ctrl+Space — palette · click card — insert')}</p>
        </div>
        <div className="grid gap-2 p-3 sm:grid-cols-2">
          {terminalCommands.map((cmd) => (
            <button
              key={cmd.name}
              type="button"
              onClick={() => {
                setCommand(cmd.name === 'clear' ? 'clear' : cmd.usage.split('[')[0]!.trim() + ' ');
                inputRef.current?.focus();
              }}
              className="group flex flex-col gap-1 rounded-xl border border-border-subtle bg-surface-sunken px-3 py-3 text-left transition hover:border-border-default hover:bg-surface-card dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
            >
              <span className="font-mono text-caption font-semibold text-content-primary group-hover:text-content-primary dark:text-zinc-100 dark:group-hover:text-white">{cmd.usage}</span>
              <span className="text-caption leading-snug text-content-secondary dark:text-zinc-400">{String(t(`terminalCmd${cmd.name.charAt(0).toUpperCase()}${cmd.name.slice(1)}` as never) ?? cmd.description)}</span>
              {cmd.examples?.length ? <span className="font-mono text-caption text-content-tertiary dark:text-zinc-500">{cmd.examples.join(' · ')}</span> : null}
            </button>
          ))}
        </div>
        <div className="border-t border-border-default bg-surface-sunken px-4 py-3 font-mono text-caption leading-relaxed dark:border-zinc-800 dark:bg-zinc-950">
          <p className="font-semibold text-content-primary dark:text-zinc-100">{String(t('terminalQuickStartTitle' as never) ?? 'Quick start — empty carts')}</p>
          <p className="mt-1 text-content-secondary dark:text-zinc-400">carts stats</p>
          <p className="text-content-secondary dark:text-zinc-400">carts purge --empty --dry-run</p>
          <p className="text-content-primary dark:text-zinc-300">carts purge --empty --force</p>
          <p className="mt-2 text-content-tertiary dark:text-zinc-500">{String(t('terminalQuickStartAnon' as never) ?? 'Only anon older than 7 days: carts purge --empty --anon --older-than 7d --force')}</p>
        </div>
      </div>

      {/* Terminal — follows site theme: light → светлый, dark → zinc-950 */}
      <div className="overflow-hidden rounded-2xl border border-border-default bg-surface-card shadow-lg dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-2xl">
        {/* window chrome */}
        <div className="flex items-center justify-between border-b border-border-default bg-surface-sunken px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-red-500/90" aria-hidden />
            <span className="size-3 rounded-full bg-yellow-500/90" aria-hidden />
            <span className="size-3 rounded-full bg-green-500/90" aria-hidden />
            <span className="ml-3 hidden font-mono text-caption tracking-wide text-content-secondary dark:text-zinc-400 sm:inline">artdance — operator console</span>
            <span className="ml-3 font-mono text-caption tracking-wide text-content-tertiary dark:text-zinc-500 sm:hidden">console</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden font-mono text-caption text-content-tertiary dark:text-zinc-500 sm:inline">audit · rate-limit · allowlist</span>
            {history.length > 0 ? (
              <button
                type="button"
                onClick={() => setHistory([])}
                className="rounded-full border border-border-default bg-surface-card px-3 py-1 font-mono text-caption text-content-secondary hover:bg-surface-sunken dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-white"
              >
                clear
              </button>
            ) : null}
          </div>
        </div>

        <div ref={logRef} className="max-h-[60dvh] min-h-36 overflow-auto bg-surface-card p-4 font-mono text-caption leading-relaxed dark:bg-zinc-950">
          {history.length === 0 ? (
            <div className="space-y-2">
              <p className="text-content-tertiary dark:text-zinc-500">{t('commandHelp')}</p>
              <p className="text-content-tertiary dark:text-zinc-600">{String(t('terminalEmptyHint' as never) ?? 'Type help and press Enter — or click a card above.')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {history.map((entry, idx) => (
                <div key={`${entry.cmd}-${idx}`} className="flex flex-col gap-1">
                  <p className="flex gap-2">
                    <span className="shrink-0 text-accent dark:text-emerald-400">$</span>
                    <span className="break-words text-content-primary dark:text-zinc-100">{entry.cmd}</span>
                  </p>
                  {entry.lines.map((line, i) => (
                    <p key={`${line}-${i}`} className={entry.ok ? 'whitespace-pre-wrap break-words text-content-secondary dark:text-zinc-300' : 'whitespace-pre-wrap break-words text-red-600 dark:text-red-300'}>
                      {line}
                    </p>
                  ))}
                </div>
              ))}
              {action.status === 'executing' ? <p className="animate-pulse text-content-tertiary dark:text-zinc-500">… executing</p> : null}
            </div>
          )}
        </div>

        <div className="border-t border-border-default bg-surface-sunken p-3 dark:border-zinc-800 dark:bg-zinc-900">
          {hint ? (
            <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/30 dark:bg-amber-950/20">
              <span className="font-mono text-caption font-bold tracking-wide text-amber-800 dark:text-amber-200">{String(t('terminalHintNext' as never) ?? 'next →')}</span>
              <span className="font-mono text-caption font-semibold text-zinc-900 dark:text-zinc-100">{hint.label}</span>
              <span className="hidden text-caption text-zinc-500 dark:text-zinc-400 sm:inline">— {hint.desc}</span>
              <button
                type="button"
                onClick={() => {
                  // вставить подсказку: если это usage с плейсхолдером — вставим prefix до первого [ / <
                  const usage = hint.label;
                  const prefix = usage.split(/\s*\[|\s*</)[0]?.trim() ?? usage;
                  const current = command.trimEnd();
                  if (!current) { setCommand(prefix + ' '); }
                  else if (current.toLowerCase() === prefix.toLowerCase()) setCommand(prefix + ' ');
                  else if (prefix.toLowerCase().startsWith(current.toLowerCase())) setCommand(prefix + ' ');
                  else setCommand(current + ' ' + prefix.split(/\s+/).pop() + ' ');
                  inputRef.current?.focus();
                }}
                className="ml-auto hidden rounded-full bg-white px-2 py-1 font-mono text-caption font-bold text-amber-800 shadow-sm hover:bg-amber-50 dark:bg-zinc-800 dark:text-amber-200 dark:hover:bg-zinc-700 sm:inline-flex"
                title={hint.sample}
              >
                {String(t('terminalHintInsert' as never) ?? 'insert')}
              </button>
              <span className="font-mono text-caption text-zinc-400 dark:text-zinc-500 sm:hidden">{hint.sample}</span>
            </div>
          ) : null}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-caption text-accent dark:text-emerald-400">$</span>
              <Input
                ref={inputRef}
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={t('terminalPlaceholder')}
                aria-label={t('terminalPlaceholder')}
                autoComplete="off"
                spellCheck={false}
                className="border-border-default bg-surface-card pl-7 font-mono text-content-primary placeholder:text-content-tertiary focus-visible:ring-border-focus dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus-visible:ring-zinc-700"
              />
              {suggest.length > 0 ? (
                <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                  {suggest.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        if (!command.includes(' ')) setCommand(s + ' ');
                        else {
                          const parts = command.trimEnd().split(/\s+/);
                          parts[parts.length - 1] = s;
                          setCommand(parts.join(' ') + ' ');
                        }
                        inputRef.current?.focus();
                      }}
                      className="block w-full px-3 py-2 text-left font-mono text-caption text-content-secondary hover:bg-surface-sunken hover:text-content-primary dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <Button
              variant="default"
              pending={action.status === 'executing'}
              onClick={() => void run()}
              className="shrink-0 bg-accent font-mono text-white hover:bg-accent-hover dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              run
            </Button>
          </div>
          <p className="mt-2 font-mono text-caption leading-relaxed text-content-tertiary dark:text-zinc-500">{String(t('terminalInputHint' as never) ?? 'Tab — complete · ↑/↓ — history · Ctrl+R — search history · Enter — run · Esc — hide suggestions')}</p>
        </div>
      </div>
    </div>
  );
}

export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const t = useTranslations('admin.support');
  const router = useRouter();
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const action = useAction(replyToSupportTicket, { onSuccess: () => { setBody(''); router.refresh(); } });
  return <div className="flex flex-col gap-3"><textarea className="min-h-32 rounded-2xl border border-border-default bg-surface-card p-4 text-body-sm" value={body} onChange={(event) => setBody(event.target.value)} placeholder={t('replyPlaceholder')} /><label className="flex items-center gap-2 text-caption text-content-secondary"><input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} />{t('internalNote')}</label><Button className="self-start" pending={action.status === 'executing'} onClick={() => action.execute({ ticketId, body, internal })}>{t('sendReply')}</Button></div>;
}

export function FeatureFlagButton({ flag, enabled }: { flag: string; enabled: boolean }) {
  const t = useTranslations('admin.support');
  const router = useRouter();
  const action = useAction(setFeatureFlag, { onSuccess: () => router.refresh() });
  return <Button size="sm" variant={enabled ? 'accent' : 'outline'} pending={action.status === 'executing'} onClick={() => action.execute({ key: flag, enabled: !enabled })}>{enabled ? t('flagEnabled') : t('flagDisabled')}</Button>;
}
