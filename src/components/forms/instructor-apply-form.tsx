'use client';

import { useAction } from 'next-safe-action/hooks';
import { useState } from 'react';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { danceStyles } from '@/domain/enums';
import { applyInstructorAction } from '@/server/actions/instructor-apply';

export function InstructorApplyForm() {
  const tF = useTranslations('footer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [styles, setStyles] = useState<string[]>([]);

  const { execute, status, result } = useAction(applyInstructorAction);
  const pending = status === 'executing';
  const data = result.data as { ok: boolean } | undefined;
  if (data?.ok) return <p role="status" className="rounded-md border border-border-default bg-surface-card p-4 text-content-success">{tF('applicationSent')}</p>;

  const toggle = (s: string) => setStyles((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  return (
    <div className="rounded-xl border border-border-default bg-surface-card p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-body-sm font-semibold">{tF('applyFormLabelName')}<input value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} maxLength={80} className="form-input mt-1" placeholder={tF('namePlaceholder')} /></label>
        <label className="text-body-sm font-semibold">{tF('applyFormLabelEmail')}<input value={email} onChange={(e) => setEmail(e.target.value.slice(0, 254))} maxLength={254} className="form-input mt-1" placeholder="anna@mail.ru" /></label>
      </div>
      <label className="text-body-sm mt-4 block font-semibold">{tF('phonePlaceholder')}<input value={phone} onChange={(e) => setPhone(e.target.value.slice(0, 20))} className="form-input mt-1" placeholder={tF('phonePlaceholder')} /></label>
      <label className="text-body-sm mt-4 block font-semibold">{tF('aboutPlaceholder')}<textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 2000))} maxLength={2000} rows={4} className="form-input mt-1" placeholder={tF('bioPlaceholder')} /></label>
      <fieldset className="mt-4">
        <legend className="text-body-sm font-semibold">{tF('directionsLabel')}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {danceStyles.map((s) => (
            <label key={s} className={`rounded-full border px-3 py-1 text-xs ${styles.includes(s) ? 'border-accent bg-accent text-content-on-accent' : 'border-border-default bg-surface-card'}`}>
              <input type="checkbox" className="sr-only" checked={styles.includes(s)} onChange={() => toggle(s)} />{s}
            </label>
          ))}
        </div>
      </fieldset>
      <Button variant="accent" className="mt-5" disabled={pending || !name.trim() || !email.trim() || styles.length === 0} onClick={() => execute({ name, email, phone, bio, styles: styles as never })}>{pending ? '…' : tF('submit')}</Button>
      {(result.validationErrors || result.serverError) && <p role="alert" className="text-body-sm mt-3 text-content-signal">{String(result.validationErrors ?? result.serverError)}</p>}
    </div>
  );
}
