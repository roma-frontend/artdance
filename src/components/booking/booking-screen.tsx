/**
 * BOOKING SCREEN — сборка экрана бронирования.
 *
 * Слева календарь и слоты, справа сводка.
 * Выбор слота удерживает слот через POST /api/booking/hold (TTL booking.holdTtlMinutes).
 * Смена слота/даты освобождает предыдущий hold DELETE-ом — держится ровно один слот.
 * Гонку решает уникальный индекс SlotHold в БД (3.2). Истечение — уведомление, освобождает сервер.
 * Гость держит слот по anonymousId из localStorage (ARTDANCE_ANON_ID), XOR с userId.
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookingCalendar } from '@/components/booking/booking-calendar';
import { BookingSummary } from '@/components/booking/booking-summary';
import { LocationOptionPicker } from '@/components/booking/location-option-picker';
import { TimeSlotPicker } from '@/components/booking/time-slot-picker';
import { apiRoutes, booking, routes, site, type BookingLocationOption } from '@/config';
import { zonedDateKey } from '@/domain/availability/compute';
import { useRouter } from '@/i18n/routing';
import { getAnonymousId } from '@/lib/client/anonymous-id';
import { parseClock } from '@/lib/time/clock';
import { fromZonedParts, zonedParts } from '@/lib/time/schedule';
import type { BookingContent } from '@/server/content/booking';

interface BookingScreenProps { content: BookingContent; }
type HoldState = { status: 'idle' } | { status: 'holding'; holdId: string; expiresAt: string } | { status: 'error'; justTaken: string | null };

export function BookingScreen({ content }: BookingScreenProps) {
  const router = useRouter();
  const initialDay = content.days.find((day) => day.dateKey === content.initialDateKey);
  const [date, setDate] = useState<Date | undefined>(() => (initialDay ? new Date(initialDay.dateIso) : undefined));
  const [startTime, setStartTime] = useState<string | undefined>(content.preselectedSlot ?? undefined);
  const [location, setLocation] = useState<BookingLocationOption>('STUDIO');
  const [hold, setHold] = useState<HoldState>({ status: 'idle' });
  const [submitting, setSubmitting] = useState(false);
  const prevHoldRef = useRef<string | null>(null);
  const preselectedHeldRef = useRef(false);
  useEffect(() => { if (hold.status === 'holding') prevHoldRef.current = hold.holdId; }, [hold]);
  const releasePrevHold = useCallback(async (holdId: string | null) => {
    if (!holdId) return;
    try {
      const anon = getAnonymousId();
      const qs = new URLSearchParams({ holdId });
      if (anon) qs.set('anonymousId', anon);
      await fetch('/api/booking/hold?' + qs.toString(), { method: 'DELETE' });
    } catch {}
  }, []);
  useEffect(() => {
    return () => {
      const id = prevHoldRef.current;
      if (!id) return;
      try {
        const anon = typeof window !== 'undefined' ? window.localStorage.getItem('ARTDANCE_ANON_ID') : null;
        const qs = new URLSearchParams({ holdId: id });
        if (anon) qs.set('anonymousId', anon);
        const url = '/api/booking/hold?' + qs.toString();
        const nb = navigator as unknown as { sendBeacon?: (u: string) => boolean };
        if (typeof navigator !== 'undefined' && typeof nb.sendBeacon === 'function') nb.sendBeacon(url);
        else fetch(url, { method: 'DELETE' });
      } catch {}
    };
  }, []);
  const holdSlot = useCallback(async (day: Date, slot: string) => {
    const prevId = prevHoldRef.current;
    setSubmitting(true);
    setHold({ status: 'idle' });
    try {
      const parts = zonedParts(day, site.timeZone);
      const minutes = parseClock(slot);
      const startsAt = fromZonedParts({ year: parts.year, month: parts.month, day: parts.day, minutesOfDay: minutes }, site.timeZone);
      const endsAt = new Date(startsAt.getTime() + content.durationMinutes * 60_000);
      const anonymousId = getAnonymousId();
      if (prevId) await releasePrevHold(prevId);
      const res = await fetch(apiRoutes.slotHold(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructorId: content.instructorId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), durationMinutes: content.durationMinutes, anonymousId }),
      });
      const body = (await res.json().catch(() => null)) as { hold?: { id: string; expiresAt: string }; error?: string } | null;
      if (!res.ok || !body?.hold) {
        const taken = body?.error === 'SLOT_CONFLICT' || body?.error === 'SLOT_UNAVAILABLE' ? slot : null;
        setHold({ status: 'error', justTaken: taken });
        return;
      }
      setHold({ status: 'holding', holdId: body.hold.id, expiresAt: body.hold.expiresAt });
      prevHoldRef.current = body.hold.id;
    } catch {
      setHold({ status: 'error', justTaken: null });
    } finally { setSubmitting(false); }
  }, [content.durationMinutes, content.instructorId, releasePrevHold]);
  useEffect(() => {
    if (preselectedHeldRef.current) return;
    if (!content.preselectedSlot || !initialDay) return;
    if (hold.status !== 'idle') return;
    preselectedHeldRef.current = true;
    const dayDate = new Date(initialDay.dateIso);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void holdSlot(dayDate, content.preselectedSlot);
  }, [content.preselectedSlot, initialDay, hold.status, holdSlot]);
  const availableDates = useMemo(() => content.days.map((day) => day.dateKey), [content.days]);
  const slots = useMemo(() => {
    if (!date) return [];
    const key = zonedDateKey(date, site.timeZone);
    return content.days.find((day) => day.dateKey === key)?.slots ?? [];
  }, [content.days, date]);
  const selectSlot = (start: string) => { setStartTime(start); if (!date) return; void holdSlot(date, start); };
  const selectDate = (next: Date | undefined) => {
    setDate(next);
    setStartTime(undefined);
    const prevId = prevHoldRef.current;
    setHold({ status: 'idle' });
    preselectedHeldRef.current = false;
    if (prevId) { prevHoldRef.current = null; void releasePrevHold(prevId); }
  };
  const handleHoldExpired = useCallback(() => {
    const prevId = prevHoldRef.current;
    prevHoldRef.current = null;
    setHold({ status: 'idle' });
    setStartTime(undefined);
    if (prevId) void releasePrevHold(prevId);
  }, [releasePrevHold]);
  const travelFee = location === 'CUSTOMER_LOCATION' ? booking.travelFee : 0;
  const justTaken = hold.status === 'error' ? hold.justTaken : null;
  const effectiveHoldExpiresAt = hold.status === 'holding' ? hold.expiresAt : null;
  const handleContinue = () => { if (hold.status !== 'holding' || !hold.holdId) return; router.push(routes.bookingConfirm(hold.holdId)); };
  return (
    <div className="booking-detail-grid">
      <div className="flex flex-col gap-6">
        <div className="rounded-xl border border-border-default bg-surface-card p-6 shadow-md md:p-8">
          <BookingCalendar selected={date} onSelect={selectDate} availableDates={availableDates} />
          <div className="mt-6 border-t border-border-default pt-6">
            <TimeSlotPicker slots={slots} selected={startTime} onSelect={selectSlot} date={date} durationMinutes={content.durationMinutes} justTaken={justTaken} />
            {hold.status === 'error' && (
              <p role="alert" className="text-caption mt-3 font-medium text-content-signal">
                {hold.justTaken ? 'Слот только что заняли — выберите другое время.' : 'Не удалось удержать слот. Попробуйте снова.'}
              </p>
            )}
          </div>
        </div>
        <LocationOptionPicker value={location} onChange={setLocation} studioName={content.studioName} acceptsTravel={content.acceptsTravel} acceptsOnline={content.acceptsOnline} />
      </div>
      <BookingSummary classTitle={content.classTitle} instructorName={content.instructorName} date={date} startTime={startTime} durationMinutes={content.durationMinutes} location={{ option: location, name: content.studioName }} fee={content.fee} travelFee={travelFee} holdExpiresAt={effectiveHoldExpiresAt} onHoldExpired={handleHoldExpired} submitting={submitting} onContinue={handleContinue} />
    </div>
  );
}
