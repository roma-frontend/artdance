'use client';

import { useAction } from 'next-safe-action/hooks';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter } from '@/i18n/routing';
import { exportOperatorModel, replyToSupportTicket, resetTranslationOverride, revokeSession, runOperatorCommand, runOperatorJob, saveTranslationOverride, setFeatureFlag, startImpersonation, stopImpersonation } from '@/server/actions/admin/operator';

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
  const [command, setCommand] = useState('help');
  const [lines, setLines] = useState<string[]>([]);
  const run = async () => {
    const result = await action.executeAsync({ command });
    if (result?.data) setLines(result.data.lines);
  };
  return (
    <div className="overflow-hidden rounded-2xl border border-border-strong bg-surface-inverse p-4 text-content-inverse shadow-lg">
      <div className="mb-4 flex min-h-32 flex-col justify-end gap-1 font-mono text-caption">
        {lines.length === 0 ? <p className="text-content-on-cinema-muted">{t('commandHelp')}</p> : lines.map((line, index) => <p key={`${line}-${index}`} className="text-content-on-cinema">{line}</p>)}
      </div>
      <div className="flex gap-2">
        <Input value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void run(); }} aria-label={t('terminalPlaceholder')} className="border-border-on-cinema bg-surface-inverse font-mono text-content-inverse" />
        <Button variant="onCinema" pending={action.status === 'executing'} onClick={() => void run()}>{t('runJob')}</Button>
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
