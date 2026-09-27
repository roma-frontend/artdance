'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/routing';
export function RescheduleBookingButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string|null>(null);
  const onReschedule = async () => {
    if (!startsAt || !endsAt) { setMsg('Укажите новое время'); return; }
    setPending(true); setMsg(null);
    try {
      const res = await fetch(`/api/booking/${bookingId}/reschedule`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ newStartsAt: new Date(startsAt).toISOString(), newEndsAt: new Date(endsAt).toISOString() })});
      const body = await res.json().catch(()=>null) as { error?:string; messageKey?:string; booking?:{reference:string}} | null;
      if (!res.ok) { setMsg(body?.messageKey ?? body?.error ?? 'Не удалось перенести'); return; }
      setMsg('Перенесено'); router.refresh();
    } finally { setPending(false); }
  };
  return (<div className="mt-4 rounded-lg border border-border-default p-4">
    <div className="text-body-sm font-semibold">Перенос</div>
    <div className="mt-2 flex gap-2"><input type="datetime-local" value={startsAt} onChange={e=>setStartsAt(e.target.value)} className="form-input text-body-sm" /><input type="datetime-local" value={endsAt} onChange={e=>setEndsAt(e.target.value)} className="form-input text-body-sm" /></div>
    <Button className="mt-3" variant="outline" disabled={pending} onClick={onReschedule}>{pending ? 'Переносим…' : 'Перенести'}</Button>
    {msg && <p className="text-body-sm mt-2 text-content-secondary">{msg}</p>}
  </div>);
}
