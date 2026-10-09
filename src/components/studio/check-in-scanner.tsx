'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

type Peek = {
  ok: true;
  alreadyCheckedIn: boolean;
  booking: {
    reference: string;
    status: string;
    startsAt: string;
    endsAt: string;
    customerName: string;
    customerEmail: string;
    instructorName: string | null;
    venueName: string | null;
    checkInAt: string | null;
  };
};

function extractToken(input: string): string {
  const s = input.trim();
  if (!s) return '';
  // Полный URL из QR: .../studio/check-in?token=xxx
  try {
    const u = new URL(s);
    const t = u.searchParams.get('token');
    if (t) return t;
  } catch {}
  // token=xxx в строке
  const m = s.match(/token=([^&\s]+)/);
  if (m) return decodeURIComponent(m[1] ?? '');
  // уже токен
  if (s.includes('.') && s.length > 40) return s;
  return s;
}

export function CheckInScanner({ initialToken, hint }: { initialToken?: string | null; hint: string }) {
  const t = useTranslations('footer');
  const locale = useLocale();
  const [raw, setRaw] = useState(initialToken ? decodeURIComponent(initialToken) : '');
  const [peek, setPeek] = useState<Peek | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [doneAt, setDoneAt] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const doPeek = useCallback(async (token: string) => {
    setError(null);
    setPeek(null);
    setDoneAt(null);
    const tok = extractToken(token);
    if (!tok) {
      setError(t('checkInEnterToken'));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/booking/pass/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tok, action: 'peek' }),
      });
      const data = (await res.json()) as Peek | { ok: false; reason?: string };
      if (!res.ok || (data as { ok: boolean }).ok === false) {
        setError((data as { reason?: string }).reason ?? t('checkInInvalidToken'));
        return;
      }
      setPeek(data as Peek);
    } catch {
      setError(t('checkInNetworkError'));
    } finally {
      setBusy(false);
    }
  }, [t]);

  const doCheckIn = useCallback(async () => {
    const tok = extractToken(raw);
    if (!tok) {
      setError(t('checkInNoToken'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/booking/pass/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tok, action: 'checkIn' }),
      });
      const data = (await res.json()) as { ok: boolean; reason?: string; checkInAt?: string };
      if (!res.ok || !data.ok) {
        setError(data.reason ?? t('checkInFailed'));
        return;
      }
      setDoneAt(data.checkInAt ?? new Date().toISOString());
      // обновляем peek чтобы показать checkedInAt
      await doPeek(tok);
    } catch {
      setError(t('checkInNetworkError'));
    } finally {
      setBusy(false);
    }
  }, [raw, doPeek, t]);

  // Камера: лёгкий скан через BarcodeDetector если доступен, иначе только ручной ввод
  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t('checkInCameraUnavailable'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);

      const hasDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
      if (!hasDetector) return;

      // @ts-expect-error — BarcodeDetector не типизирован
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      const tick = async () => {
        if (!videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes?.[0]?.rawValue) {
            const val: string = codes[0].rawValue;
            setRaw(val);
            stopCamera();
            await doPeek(val);
            return;
          }
        } catch {}
        rafRef.current = requestAnimationFrame(() => void tick());
      };
      void tick();
    } catch {
      setError(t('checkInNoCameraAccess'));
    }
  }, [doPeek, stopCamera, t]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const initialTokenRef = useRef<string | null>(initialToken ?? null);
  useEffect(() => {
    const tok = initialTokenRef.current;
    if (tok) void doPeek(decodeURIComponent(tok));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount by design
  }, []);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="rounded-xl border border-border-default bg-surface-card p-4 shadow-sm">
        <p className="text-body-sm text-content-secondary">{hint}</p>

        <div className="mt-4 flex gap-2">
          <input
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={t('checkInPlaceholder')}
            className="min-w-0 flex-1 rounded-lg border border-border-default bg-surface-card px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <Button variant="outline" onClick={() => void doPeek(raw)} disabled={busy || !raw.trim()}>
            {t('checkInVerify')}
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 print:hidden">
          {!cameraOn ? (
            <Button variant="outline" onClick={() => void startCamera()} type="button">
              {t('checkInScanCamera')}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => void stopCamera()} type="button">
              {t('checkInStop')}
            </Button>
          )}
          {raw.trim() ? (
            <Button variant="ghost" onClick={() => setRaw('')}>
              {t('checkInClear')}
            </Button>
          ) : null}
        </div>

        {cameraOn ? (
          <div className="mt-4 overflow-hidden rounded-xl bg-black">
            {/* eslint-disable-next-line no-restricted-syntax -- scanner video needs raw <video>, hero/video-player are not suitable */}
            <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-body-sm font-medium text-content-danger">
            {error}
          </p>
        ) : null}
      </div>

      {peek ? (
        <div className="overflow-hidden rounded-2xl border border-border-default bg-surface-card shadow-md">
          <div className="flex items-center justify-between gap-3 bg-surface-sunken px-5 py-3">
            <p className="font-mono text-sm font-semibold tracking-wide">{peek.booking.reference}</p>
            <span
              className={`rounded-full px-3 py-1 text-caption font-semibold ${peek.alreadyCheckedIn ? 'bg-metal-soft text-content-metal' : 'bg-success-soft text-content-success'}`}
            >
              {peek.alreadyCheckedIn ? t('qrCheckedIn') : peek.booking.status}
            </span>
          </div>
          <div className="space-y-2 px-5 py-4 text-body-sm">
            <div className="flex justify-between gap-4">
              <span className="text-content-tertiary">{t('checkInCustomer')}</span>
              <span className="font-medium">
                {peek.booking.customerName} · {peek.booking.customerEmail}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-content-tertiary">{t('checkInStarts')}</span>
              <span className="font-semibold">{new Date(peek.booking.startsAt).toLocaleString(locale)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-content-tertiary">{t('checkInEnds')}</span>
              <span className="font-semibold">{new Date(peek.booking.endsAt).toLocaleString(locale)}</span>
            </div>
            {peek.booking.venueName ? (
              <div className="flex justify-between gap-4">
                <span className="text-content-tertiary">{t('checkInVenue')}</span>
                <span className="font-medium">{peek.booking.venueName}</span>
              </div>
            ) : null}
            {peek.booking.instructorName ? (
              <div className="flex justify-between gap-4">
                <span className="text-content-tertiary">{t('checkInInstructor')}</span>
                <span className="font-medium">{peek.booking.instructorName}</span>
              </div>
            ) : null}
            {peek.booking.checkInAt ? (
              <div className="flex justify-between gap-4">
                <span className="text-content-tertiary">{t('checkInCheckedInAt')}</span>
                <span className="font-medium">{new Date(peek.booking.checkInAt).toLocaleString(locale)}</span>
              </div>
            ) : null}
          </div>
          <div className="flex gap-3 px-5 pb-5 print:hidden">
            <Button variant="accent" onClick={() => void doCheckIn()} disabled={busy || peek.alreadyCheckedIn}>
              {peek.alreadyCheckedIn ? t('checkInAlreadyCheckedIn') : t('checkInMarkAttendance')}
            </Button>
            {doneAt ? <span className="self-center text-caption font-semibold text-content-success">{t('checkInDone')} · {doneAt}</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
