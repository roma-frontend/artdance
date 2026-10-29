'use client';

/**
 * ПОЛЯ СОГЛАСИЙ ПРИ БРОНИ (D-03): дата рождения участника и галочки.
 *
 * Показываются только когда у предмета брони есть правило (`form.active`); без правила
 * родитель вообще не рендерит компонент. Тексты согласий берутся из `booking.consent.*`
 * и пока помечены как черновик, если `form.draft`.
 */

import { useTranslations } from 'next-intl';
import { useId } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { bookingConsentTextKey, type BookingConsentId } from '@/config';
import type { BookingConsentField, BookingConsentForm } from '@/domain/booking/consent-form';

interface BookingConsentFieldsProps {
  form: BookingConsentForm;
  birthDate: string;
  /** Сегодня в часовом поясе площадки (`YYYY-MM-DD`): позже этой даты дату рождения не ввести. */
  today: string;
  /** Поле, которое сервер отверг при последней попытке брони. */
  error: BookingConsentField | null;
  onBirthDateChange: (value: string) => void;
  onToggle: (id: BookingConsentId, checked: boolean) => void;
}

export function BookingConsentFields({ form, birthDate, today, error, onBirthDateChange, onToggle }: BookingConsentFieldsProps) {
  const t = useTranslations();
  const groupId = useId();
  const titleId = `${groupId}-title`;
  const birthDateError = error === 'participantBirthDate' || form.birthDateInvalid ? 'validation.invalidDate' : null;
  const consentsError = error === 'consents';
  const pending = form.ids.length > 0 && !form.ready;

  return (
    <section aria-labelledby={titleId} className="grid gap-5 rounded-xl border border-border-default bg-surface-card p-5 md:p-6">
      <h2 id={titleId} className="text-body-sm font-semibold text-content-primary">
        {t('booking.consent.title')}
      </h2>

      <FormField
        name="participantBirthDate"
        labelKey="booking.consent.birthDateLabel"
        hintKey="booking.consent.birthDateHint"
        errorKey={birthDateError}
        required
      >
        {(field) => (
          <Input
            id={field.id}
            name={field.name}
            type="date"
            value={birthDate}
            max={today}
            required={field.required}
            aria-describedby={field.describedBy}
            aria-invalid={field.invalid || undefined}
            onChange={(event) => onBirthDateChange(event.target.value)}
          />
        )}
      </FormField>

      {form.ids.length > 0 && (
        <fieldset aria-labelledby={titleId} className="grid gap-3">
          {form.ids.map((id) => {
            const inputId = `${groupId}-${id}`;
            return (
              <div key={id} className="flex items-start gap-3">
                <Checkbox
                  id={inputId}
                  className="mt-0.5"
                  checked={form.acceptedIds.includes(id)}
                  aria-invalid={consentsError || undefined}
                  onCheckedChange={(checked) => onToggle(id, checked === true)}
                />
                <label htmlFor={inputId} className="text-body-sm cursor-pointer text-content-primary">
                  {t(bookingConsentTextKey(id))}
                </label>
              </div>
            );
          })}
        </fieldset>
      )}

      {form.draft && <p className="text-caption text-content-tertiary">{t('booking.consent.draftNotice')}</p>}

      {consentsError ? (
        <p role="alert" className="text-caption font-semibold text-content-danger">
          {t('booking.consent.required')}
        </p>
      ) : pending ? (
        <p className="text-caption text-content-tertiary">{t('booking.consent.required')}</p>
      ) : null}
    </section>
  );
}
