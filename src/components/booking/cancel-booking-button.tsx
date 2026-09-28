'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const t = useTranslations('booking');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const onCancel = async () => {
    if (!confirm(t('cancelTitle'))) return;
    setPending(true); setMsg(null);
    try {
      const res = await fetch(`/api/booking/${bookingId}/cancel`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({}) });
      const body = await res.json().catch(()=>null) as { error?: string; messageKey?: string } | null;
      if (!res.ok) { setMsg(body?.messageKey ?? t('cancelForbidden')); return; }
      router.refresh(); setMsg(t('cancelFree'));
    } finally { setPending(false); }
  };
  return (<div className="mt-4"><Button variant="outline" disabled={pending} onClick={onCancel}>{pending ? tCommon('states.processing') : t('cancelTitle')}</Button>{msg && <p className="text-body-sm mt-2 text-content-secondary">{msg}</p>}</div>);
}
