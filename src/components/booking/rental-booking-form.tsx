/**
 * ФОРМА АРЕНДЫ ЗАЛА — выбор зала, времени и длительности.
 *
 * Цена считается тем же правилом, что на сервере (`rentalPrice`), но итог берётся
 * с сервера при брони. Порядок: hold на зал, затем бронь из hold. Бронь создаётся
 * PENDING, поэтому дальше человек уходит на страницу подтверждения и оплаты.
 */

'use client';

import { Loader2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState, type FormEvent } from 'react';

import { BookingConsentFields } from '@/components/booking/booking-consent-fields';
import { Button } from '@/components/ui/button';
import { Price } from '@/components/ui/price';
import { apiRoutes, routes, site, type BookingConsentId } from '@/config';
import { zonedDateKey } from '@/domain/availability/compute';
import { bookingConsentErrorField, bookingConsentForm, consentRequestFields, type BookingConsentField } from '@/domain/booking/consent-form';
import { rentalPrice } from '@/domain/rental';
import { useRouter } from '@/i18n/routing';
import { fromZonedParts } from '@/lib/time/schedule';

export interface RentalRoomOption {
  id: string;
  name: string;
  capacity: number;
  pricePerHour: number;
}

interface RentalBookingFormProps {
  rooms: readonly RentalRoomOption[];
  /** Ближайшая доступная дата, `YYYY-MM-DD` в часовом поясе площадки. */
  minDate: string;
  durationOptions: readonly number[];
}

type RentError = 'slotTaken' | 'holdExpired' | 'rateLimited' | 'featureDisabled' | 'invalid' | 'generic';

const ERROR_KEYS = {
  slotTaken: 'errors.slotTaken',
  holdExpired: 'errors.holdExpired',
  rateLimited: 'errors.rateLimited',
  featureDisabled: 'errors.featureDisabled',
  invalid: 'errors.invalid',
  generic: 'errors.generic',
} as const;

const fieldClass =
  'text-body h-11 w-full rounded-md border border-border-default bg-surface-card px-3 text-content-primary';

function errorFromResponse(status: number, code: string | undefined): RentError {
  if (status === 429) return 'rateLimited';
  if (code === 'SLOT_CONFLICT' || code === 'SLOT_UNAVAILABLE') return 'slotTaken';
  if (code === 'HOLD_EXPIRED') return 'holdExpired';
  if (code === 'FEATURE_DISABLED') return 'featureDisabled';
  if (code === 'VALIDATION_FAILED') return 'invalid';
  return 'generic';
}

export function RentalBookingForm({ rooms, minDate, durationOptions }: RentalBookingFormProps) {
  const t = useTranslations('studio.rent');
  const tStudio = useTranslations('studio');
  const router = useRouter();
  const roomFieldId = useId();
  const dateFieldId = useId();
  const timeFieldId = useId();
  const durationFieldId = useId();

  const [roomId, setRoomId] = useState(rooms[0]?.id ?? '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(durationOptions[0] ?? 60);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<RentError | null>(null);
  const [now] = useState(() => new Date());
  const [birthDate, setBirthDate] = useState('');
  const [consentIds, setConsentIds] = useState<BookingConsentId[]>([]);
  const [consentError, setConsentError] = useState<BookingConsentField | null>(null);

  const room = rooms.find((item) => item.id === roomId);
  const total = room ? rentalPrice(room.pricePerHour, duration) : 0;
  const consentForm = bookingConsentForm({ subject: 'STUDIO_RENTAL', birthDate, checked: consentIds, now, timeZone: site.timeZone });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || !consentForm.ready) return;
    if (!room || !date || !time) {
      setError('invalid');
      return;
    }
    const [year, month, day] = date.split('-').map(Number) as [number, number, number];
    const [hours, minutes] = time.split(':').map(Number) as [number, number];
    if ([year, month, day, hours, minutes].some((value) => !Number.isFinite(value))) {
      setError('invalid');
      return;
    }

    const startsAt = fromZonedParts(
      { year, month, day, minutesOfDay: hours * 60 + minutes },
      site.timeZone,
    );
    const endsAt = new Date(startsAt.getTime() + duration * 60_000);

    setPending(true);
    setError(null);
    setConsentError(null);
    try {
      const holdRes = await fetch(apiRoutes.slotHold(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          durationMinutes: duration,
        }),
      });
      const holdBody = (await holdRes.json().catch(() => null)) as { hold?: { id: string }; error?: string } | null;
      if (!holdRes.ok || !holdBody?.hold) {
        setError(errorFromResponse(holdRes.status, holdBody?.error));
        return;
      }

      const bookRes = await fetch(apiRoutes.booking(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holdId: holdBody.hold.id, ...consentRequestFields(consentForm, birthDate) }),
      });
      const bookBody = (await bookRes.json().catch(() => null)) as { booking?: { id: string }; error?: string; field?: string } | null;
      const consentField = bookingConsentErrorField(bookBody?.field);
      if (consentField) {
        setConsentError(consentField);
        return;
      }
      if (!bookRes.ok || !bookBody?.booking) {
        setError(errorFromResponse(bookRes.status, bookBody?.error));
        return;
      }

      router.push(routes.bookingConfirm(bookBody.booking.id));
    } catch {
      setError('generic');
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="grid gap-5 rounded-xl border border-border-default bg-surface-card p-6 shadow-md"
    >
      <div className="grid gap-2">
        <label htmlFor={roomFieldId} className="text-body-sm font-semibold text-content-primary">
          {t('roomLabel')}
        </label>
        <select id={roomFieldId} value={roomId} onChange={(event) => setRoomId(event.target.value)} className={fieldClass}>
          {rooms.map((item) => (
            <option key={item.id} value={item.id}>
              {`${item.name} — ${tStudio('capacityNote', { count: item.capacity })}`}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <label htmlFor={dateFieldId} className="text-body-sm font-semibold text-content-primary">
            {t('dateLabel')}
          </label>
          <input
            id={dateFieldId}
            type="date"
            required
            min={minDate}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={fieldClass}
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor={timeFieldId} className="text-body-sm font-semibold text-content-primary">
            {t('timeLabel')}
          </label>
          <input
            id={timeFieldId}
            type="time"
            required
            step={1800}
            value={time}
            onChange={(event) => setTime(event.target.value)}
            className={fieldClass}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <label htmlFor={durationFieldId} className="text-body-sm font-semibold text-content-primary">
          {t('durationLabel')}
        </label>
        <select
          id={durationFieldId}
          value={duration}
          onChange={(event) => setDuration(Number(event.target.value))}
          className={fieldClass}
        >
          {durationOptions.map((minutes) => (
            <option key={minutes} value={minutes}>
              {t('durationOption', { minutes })}
            </option>
          ))}
        </select>
      </div>

      {consentForm.active && (
        <BookingConsentFields
          form={consentForm}
          birthDate={birthDate}
          today={zonedDateKey(now, site.timeZone)}
          error={consentError}
          onBirthDateChange={(value) => {
            setBirthDate(value);
            setConsentError(null);
          }}
          onToggle={(id, checked) => {
            setConsentError(null);
            setConsentIds((prev) => (checked ? [...prev.filter((item) => item !== id), id] : prev.filter((item) => item !== id)));
          }}
        />
      )}

      <div className="flex items-center justify-between gap-4 border-t border-border-default pt-4">
        <span className="text-body-sm text-content-tertiary">{t('total')}</span>
        <Price amount={total} emphasis="total" />
      </div>

      <p className="text-caption text-content-tertiary">{t('hint')}</p>

      {error ? (
        <p role="alert" className="text-body-sm font-semibold text-content-danger">
          {t(ERROR_KEYS[error])}
        </p>
      ) : null}

      <Button type="submit" variant="accent" size="lg" block disabled={pending || !room || !consentForm.ready} aria-busy={pending}>
        {pending ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : null}
        {pending ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
