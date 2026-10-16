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
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

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
      {/* Command reference — always visible */}
      <div className="rounded-2xl border border-border-default bg-surface-card p-4">
        <h2 className="text-label font-semibold text-content-primary">Команды</h2>
        <p className="mt-1 text-caption text-content-secondary">Подсказки: Tab — автокомплит, ↑/↓ — история, clear — очистить вывод.</p>
        <div className="mt-4 grid gap-3">
          {terminalCommands.map((cmd) => (
            <button
              key={cmd.name}
              type="button"
              onClick={() => {
                setCommand(cmd.name === 'clear' ? 'clear' : cmd.usage.split('[')[0]!.trim() + ' ');
                inputRef.current?.focus();
              }}
              className="flex flex-col gap-1 rounded-xl border border-border-subtle bg-surface-sunken px-3 py-2.5 text-left transition hover:border-border-default hover:bg-surface-card"
            >
              <span className="font-mono text-caption font-semibold text-content-primary">{cmd.usage}</span>
              <span className="text-caption leading-snug text-content-secondary">{cmd.description}</span>
              {cmd.examples?.length ? <span className="font-mono text-caption text-content-tertiary">{cmd.examples.join(' · ')}</span> : null}
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-surface-inverse px-3 py-2.5 font-mono text-caption leading-relaxed text-content-on-cinema">
          <p className="font-semibold text-content-inverse">Быстрый старт — пустые корзины</p>
          <p className="mt-1 text-content-on-cinema-muted">1) carts stats — посмотреть сколько всего</p>
          <p>carts purge --empty --dry-run — сколько удалит</p>
          <p>carts purge --empty --force — удалить пустые</p>
          <p className="mt-2 text-content-on-cinema-muted">Только anon и старше 7 дней: carts purge --empty --anon --older-than 7d --force</p>
        </div>
      </div>

      {/* Terminal */}
      <div className="overflow-hidden rounded-2xl border border-border-strong bg-surface-inverse shadow-lg">
        <div ref={logRef} className="max-h-[60dvh] min-h-36 overflow-auto p-4 font-mono text-caption leading-relaxed">
          {history.length === 0 ? (
            <p className="text-content-on-cinema-muted">{t('commandHelp')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {history.map((entry, idx) => (
                <div key={`${entry.cmd}-${idx}`} className="flex flex-col gap-1">
                  <p className="flex gap-2">
                    <span className="shrink-0 text-content-on-cinema-muted">$</span>
                    <span className="break-words text-content-inverse">{entry.cmd}</span>
                  </p>
                  {entry.lines.map((line, i) => (
                    <p key={`${line}-${i}`} className={entry.ok ? 'whitespace-pre-wrap break-words text-content-on-cinema' : 'whitespace-pre-wrap break-words text-[#ffb4ab]'}>
                      {line}
                    </p>
                  ))}
                </div>
              ))}
              {action.status === 'executing' ? <p className="animate-pulse text-content-on-cinema-muted">…</p> : null}
            </div>
          )}
        </div>

        <div className="border-t border-white/10 p-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-caption text-content-on-cinema-muted">$</span>
              <Input
                ref={inputRef}
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={t('terminalPlaceholder')}
                aria-label={t('terminalPlaceholder')}
                autoComplete="off"
                spellCheck={false}
                className="border-border-on-cinema bg-surface-inverse pl-7 font-mono text-content-inverse placeholder:text-content-on-cinema-muted"
              />
              {suggest.length > 0 ? (
                <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl border border-white/10 bg-surface-inverse shadow-xl">
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
                      className="block w-full px-3 py-2 text-left font-mono text-caption text-content-on-cinema hover:bg-white/10"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <Button variant="onCinema" pending={action.status === 'executing'} onClick={() => void run()} className="shrink-0">
              {t('runJob')}
            </Button>
          </div>
          <p className="mt-2 font-mono text-caption leading-relaxed text-content-on-cinema-muted">Tab — дополнить · ↑/↓ — история · Enter — выполнить · clear — очистить</p>
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
