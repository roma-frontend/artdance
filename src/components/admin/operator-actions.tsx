'use client';

import { useAction } from 'next-safe-action/hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter } from '@/i18n/routing';
import { exportOperatorModel, replyToSupportTicket, resetTranslationOverride, revokeSession, runOperatorCommand, runOperatorJob, saveTranslationOverride, setFeatureFlag, startImpersonation, stopImpersonation } from '@/server/actions/admin/operator';
import { terminalCommands } from '@/server/terminal/registry';

export function SessionRevokeButton({ id }: { id: string }) {
  const t = useTranslations('admin.support');
  const router = useRouter();
  const action = useAction(revokeSession, { onSuccess: () => router.refresh() });
  return <Button size="sm" variant="outline" pending={action.status === 'executing'} onClick={() => action.execute({ sessionId: id })}>{t('revokeSession')}</Button>;
}

export function JobButton({ job }: { job: 'booking' | 'holds' | 'trash' | 'digest' }) {
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
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<Array<{ cmd: string; lines: string[]; ok: boolean }>>([]);
  const [cursor, setCursor] = useState(-1);
  const [dismissed, setDismissed] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const paletteInputRef = useRef<HTMLInputElement>(null);

  const completions = useMemo(() => {
    const raw = command.trimStart().toLowerCase();
    if (!raw) return terminalCommands.map((c) => c.name);
    if (!raw.includes(' ')) return terminalCommands.map((c) => c.name).filter((n) => n.startsWith(raw));
    if (raw.startsWith('db ')) {
      const rest = raw.slice(3).trim();
      const subs = ['models', 'counts', 'count', 'find', 'help'];
      if (!rest) return subs;
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
    if (raw.startsWith('classes')) return ['classes salsa --take 5', 'classes --take 10'];
    if (raw.startsWith('media ')) return ['media DanceClass ', 'media Product ', 'media Instructor '];
    if (raw.startsWith('open ')) return ['open /en/classes/'];
    return [];
  }, [command]);

  const suggestRaw = useMemo(() => {
    const trimmed = command.trim();
    if (!trimmed || trimmed.includes(' ')) return [] as string[];
    const matches = completions;
    return matches.length === 1 && matches[0] === trimmed.toLowerCase() ? [] : matches.slice(0, 6);
  }, [command, completions]);
  const suggest = dismissed === command ? [] : suggestRaw;

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [history]);

  const paletteCommands = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    if (!q) return terminalCommands;
    return terminalCommands.filter((c) => c.name.includes(q) || c.usage.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
  }, [paletteQuery]);

  useEffect(() => {
    if (!paletteOpen) return;
    paletteInputRef.current?.focus();
  }, [paletteOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        if (!paletteOpen) setPaletteQuery('');
      }
      if (e.key === 'Escape' && paletteOpen) setPaletteOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen]);

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
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Ctrl+Space palette — above site header (header=1000, drawer=1200, modal=1300, commandPalette=1700) */}
      {paletteOpen ? (
        <div className="fixed inset-0 z-[1700] flex items-start justify-center bg-black/50 p-4 pt-[max(1.25rem,calc(var(--layout-nav-height)+0.75rem))]" onClick={() => setPaletteOpen(false)}>
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border-default bg-surface-card shadow-2xl dark:border-zinc-700 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-border-default p-3 dark:border-zinc-700">
              <span className="font-mono text-caption text-content-tertiary dark:text-zinc-500">⌘</span>
              <input
                ref={paletteInputRef}
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                placeholder={String(t('terminalPaletteSearch' as never) ?? 'Search commands…')}
                className="flex-1 bg-transparent font-mono text-caption text-content-primary placeholder:text-content-tertiary focus:outline-none dark:text-zinc-100"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && paletteCommands[0]) {
                    const first = paletteCommands[0]!;
                    setCommand(first.name === 'clear' ? 'clear' : first.usage.split('[')[0]!.trim() + ' ');
                    setPaletteOpen(false);
                    setPaletteQuery('');
                    inputRef.current?.focus();
                  }
                }}
              />
              <button type="button" onClick={() => setPaletteOpen(false)} className="rounded-full border border-border-default px-2 py-1 font-mono text-caption text-content-secondary dark:border-zinc-700 dark:text-zinc-400">
                Esc
              </button>
            </div>
            <div className="max-h-80 overflow-auto p-2">
              {paletteCommands.map((cmd) => (
                <button
                  key={cmd.name}
                  type="button"
                  onClick={() => {
                    setCommand(cmd.name === 'clear' ? 'clear' : cmd.usage.split('[')[0]!.trim() + ' ');
                    setPaletteOpen(false);
                    setPaletteQuery('');
                    inputRef.current?.focus();
                  }}
                  className="flex w-full flex-col gap-0.5 rounded-xl px-3 py-2 text-left hover:bg-surface-sunken dark:hover:bg-zinc-800"
                >
                  <span className="font-mono text-caption font-semibold text-content-primary dark:text-zinc-100">{cmd.usage}</span>
                  <span className="text-caption text-content-secondary dark:text-zinc-400">{String(t(cmd.name === 'clear' ? ('terminalCmdClear' as never) : (`terminalCmd${cmd.name.charAt(0).toUpperCase()}${cmd.name.slice(1)}` as never)) ?? cmd.description)}</span>
                </button>
              ))}
              {paletteCommands.length === 0 ? <p className="px-3 py-4 text-center text-caption text-content-tertiary">{String(t('terminalPaletteEmpty' as never) ?? 'Nothing found')}</p> : null}
            </div>
            <p className="border-t border-border-default px-3 py-2 font-mono text-caption text-content-tertiary dark:border-zinc-700 dark:text-zinc-500">{String(t('terminalPaletteHint' as never) ?? 'Ctrl+Space — open · Enter — insert · Esc — close')}</p>
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
              onClick={() => {
                setPaletteOpen(true);
                setPaletteQuery('');
              }}
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
          <p className="mt-2 font-mono text-caption leading-relaxed text-content-tertiary dark:text-zinc-500">{String(t('terminalInputHint' as never) ?? 'Tab — complete · ↑/↓ — history · Enter — run · Esc — hide suggestions')}</p>
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
