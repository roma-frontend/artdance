'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/routing';
export function RescheduleBookingButton({ bookingId }: { bookingId: string }) {
  const t = useTranslations('booking');
  const tCommon = useTranslations('common');
  const tValidation = useTranslations('validation');
  const router = useRouter();
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string|null>(null);
  const onReschedule = async () => {
    if (!startsAt || !endsAt) { setMsg(tValidation('required')); return; }
    setPending(true); setMsg(null);
    try {
      const res = await fetch(`/api/booking/${bookingId}/reschedule`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ newStartsAt: new Date(startsAt).toISOString(), newEndsAt: new Date(endsAt).toISOString() })});
      const body = await res.json().catch(()=>null) as { error?:string; messageKey?:string; booking?:{reference:string}} | null;
      if (!res.ok) { setMsg(body?.messageKey ?? t('conflictError')); return; }
      setMsg(t('rescheduleTitle')); router.refresh();
    } finally { setPending(false); }
  };
  return (<div className="mt-4 min-w-0 overflow-hidden rounded-lg border border-border-default p-4">
    <div className="text-body-sm font-semibold">{t('rescheduleTitle')}</div>
    <div className="mt-2 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2"><input type="datetime-local" value={startsAt} onChange={e=>setStartsAt(e.target.value)} className="form-input min-w-0 text-body-sm" /><input type="datetime-local" value={endsAt} onChange={e=>setEndsAt(e.target.value)} className="form-input min-w-0 text-body-sm" /></div>
    <Button className="mt-3 max-w-full" variant="outline" disabled={pending} onClick={onReschedule}>{pending ? tCommon('states.processing') : tCommon('actions.reschedule')}</Button>
    {msg && <p className="text-body-sm mt-2 break-words text-content-secondary [overflow-wrap:anywhere]">{msg}</p>}
  </div>);
}
