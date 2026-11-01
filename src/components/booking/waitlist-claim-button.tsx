'use client';

/**
 * ЗАНЯТЬ МЕСТО — кнопка на странице из письма «место освободилось».
 *
 * Сервер выдаёт удержание (`/api/waitlist/claim`), дальше пользователь попадает на
 * подтверждение брони по тому же холду, что и при обычной записи.
 */

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { apiRoutes, routes } from '@/config/routes';
import { useRouter } from '@/i18n/routing';

interface WaitlistClaimButtonProps {
  sessionId: string;
  label: string;
  failedLabel: string;
}

export function WaitlistClaimButton({ sessionId, label, failedLabel }: WaitlistClaimButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function claim() {
    setPending(true);
    setFailed(false);
    try {
      const response = await fetch(apiRoutes.waitlistClaim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = (await response.json().catch(() => null)) as { hold?: { id?: string } } | null;
      if (!response.ok || !data?.hold?.id) {
        setFailed(true);
        return;
      }
      router.push(routes.bookingConfirm(data.hold.id));
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      <Button type="button" onClick={claim} disabled={pending}>
        {label}
      </Button>
      {failed ? (
        <p role="alert" className="text-body-sm text-content-danger">
          {failedLabel}
        </p>
      ) : null}
    </div>
  );
}
