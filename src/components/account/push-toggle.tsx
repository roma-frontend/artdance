'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { clientEnv } from '@/config/env';

const SW_PATH = '/push-sw.js';
const SUBSCRIPTION_PATH = '/api/push/subscription';

type Status = 'checking' | 'unavailable' | 'off' | 'on' | 'denied' | 'error';

/** Публичный VAPID-ключ (base64url) → байты для `applicationServerKey`. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Браузер поддерживает Web Push и на сервере задан публичный ключ. */
function isPushSupported(publicKey: string | undefined): boolean {
  return (
    Boolean(publicKey) &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Включает или выключает push на текущем устройстве. */
export function PushToggle() {
  const t = useTranslations('footer');
  const publicKey = clientEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [status, setStatus] = useState<Status>('checking');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const check = async (): Promise<Status> => {
      if (!isPushSupported(publicKey)) return 'unavailable';
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      return subscription ? 'on' : 'off';
    };
    check()
      .then((next) => {
        if (active) setStatus(next);
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [publicKey]);

  const enable = async () => {
    if (!publicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'denied') {
        setStatus('denied');
        return;
      }
      if (permission !== 'granted') {
        setStatus('off');
        return;
      }
      await navigator.serviceWorker.register(SW_PATH);
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const res = await fetch(SUBSCRIPTION_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) {
        await subscription.unsubscribe();
        setStatus('error');
        return;
      }
      setStatus('on');
    } catch {
      setStatus('error');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const { endpoint } = subscription;
        await subscription.unsubscribe();
        // Если DELETE не дошёл, сервер уберёт строку сам при ответе 410 от push-сервиса.
        await fetch(SUBSCRIPTION_PATH, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        }).catch(() => undefined);
      }
      setStatus('off');
    } catch {
      setStatus('error');
    } finally {
      setBusy(false);
    }
  };

  const showEnable = status === 'off' || status === 'denied' || status === 'error';

  return (
    <section className="min-w-0 rounded-xl border border-border-default bg-surface-card p-5">
      <h2 className="text-card-title">{t('pushTitle')}</h2>
      <p className="text-body-sm mt-2 text-content-secondary">{t('pushHint')}</p>
      {status === 'unavailable' && (
        <p className="text-body-sm mt-3 text-content-secondary">{t('pushUnavailable')}</p>
      )}
      {status === 'on' && (
        <Button type="button" variant="outline" className="mt-4" disabled={busy} onClick={disable}>
          {t('pushDisable')}
        </Button>
      )}
      {showEnable && (
        <Button type="button" variant="accent" className="mt-4" disabled={busy} onClick={enable}>
          {t('pushEnable')}
        </Button>
      )}
      {status === 'denied' && (
        <p role="alert" className="text-body-sm mt-3 text-content-signal">{t('pushDenied')}</p>
      )}
      {status === 'error' && (
        <p role="alert" className="text-body-sm mt-3 text-content-signal">{t('pushError')}</p>
      )}
    </section>
  );
}
