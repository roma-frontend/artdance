'use client';

/**
 * ADMIN FORM — одна форма на все разделы админки.
 *
 * Форма собирается из описания полей (`AdminFieldSpec`), а не пишется под каждую
 * сущность. Это не экономия строк, а единственный способ удержать одинаковое
 * поведение: цена везде принимает целые драмы, дата везде одного формата, поле с
 * переводами везде выглядит одинаково, обязательность и `aria-*` навешиваются в
 * одном месте. Двадцать написанных руками форм расходятся в первый же месяц.
 *
 * Значения хранятся одной записью (`Record<string, AdminFieldValue>`), а не
 * состоянием на поле: набор полей известен только в рантайме. Проверка — на
 * сервере, схемой того же описания; клиент не дублирует правила, он лишь не даёт
 * отправить форму дважды и показывает, какое поле сервер назвал неверным.
 *
 * Переводы — вкладками по локали, а не тремя копиями формы: администратор
 * заполняет основной язык, а остальные добавляет позже, и переключение языка не
 * должно терять уже введённое.
 */

import { useAction } from 'next-safe-action/hooks';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import type { AdminFieldSpec, AdminOption, AdminResource } from '@/config';
import {
  translationFieldName,
  type AdminFieldValue,
  type AdminFormValues,
} from '@/domain/admin/schema';
import { defaultLocale, localeMeta, type Locale } from '@/i18n/config';
import { useRouter } from '@/i18n/routing';
import type { Translate } from '@/i18n/translate';
import type { MessageKey } from '@/i18n/types';
import { saveAdminResource } from '@/server/actions/admin/resource';
import { cn } from '@/lib/utils';

interface AdminFormProps {
  resource: AdminResource;
  /** Пусто — создание. */
  id?: string;
  fields: readonly AdminFieldSpec[];
  initialValues: AdminFormValues;
  /** Варианты для полей-связей: `{ instructorId: [...] }`. */
  relationOptions: Record<string, readonly AdminOption[]>;
  /** Локали переводов, которые показывает форма. */
  translationLocales: readonly Locale[];
  /** Куда вернуться после сохранения. */
  listHref: string;
  /** Дополнительные блоки: загрузка фотографий, вложенные списки. */
  children?: React.ReactNode;
}

export function AdminForm({
  resource,
  id,
  fields,
  initialValues,
  relationOptions,
  translationLocales: locales,
  listHref,
  children,
}: AdminFormProps) {
  const t = useTranslations('admin.form');
  const tRoot = useTranslations() as unknown as Translate;
  const router = useRouter();

  const [values, setValues] = useState<AdminFormValues>(initialValues);
  const [activeLocale, setActiveLocale] = useState<Locale>(defaultLocale);
  const [saved, setSaved] = useState(false);

  const { execute, status, result } = useAction(saveAdminResource, {
    onSuccess: ({ data }) => {
      setSaved(true);
      if (data?.created === true) router.push(listHref);
      else router.refresh();
    },
  });

  const isSubmitting = status === 'executing';
  const serverError = result.serverError;
  const invalidField = serverError?.field;

  function setValue(name: string, value: AdminFieldValue): void {
    setSaved(false);
    setValues((current) => ({ ...current, [name]: value }));
  }

  const localizedFieldNames = fields.filter((field) => field.localized === true).map((field) => field.name);
  const showTranslations = localizedFieldNames.length > 0 && locales.length > 0;

  return (
    <form
      noValidate
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        execute({ resource, ...(id ? { id } : {}), values });
      }}
    >
      <section aria-labelledby="admin-form-general" className="flex flex-col gap-5">
        <h2 id="admin-form-general" className="text-card-title text-content-primary">
          {t('generalSection')}
        </h2>

        <div className="grid gap-5 md:grid-cols-2">
          {fields.map((field) => (
            <FieldControl
              key={field.name}
              field={field}
              name={field.name}
              value={values[field.name] ?? null}
              options={field.options ?? relationOptions[field.name] ?? []}
              invalid={invalidField === field.name}
              disabled={isSubmitting}
              onChange={setValue}
              t={tRoot}
              placeholder={t('selectPlaceholder')}
            />
          ))}
        </div>
      </section>

      {showTranslations ? (
        <section aria-labelledby="admin-form-translations" className="flex flex-col gap-4">
          <h2 id="admin-form-translations" className="text-card-title text-content-primary">
            {t('translationsSection')}
          </h2>
          <p className="text-body-sm text-content-secondary">
            {t('translationsHint', { locale: localeMeta[defaultLocale].nativeName })}
          </p>

          <div role="tablist" aria-label={t('translationsSection')} className="flex gap-2">
            {locales.map((locale) => (
              <button
                key={locale}
                type="button"
                role="tab"
                aria-selected={activeLocale === locale}
                onClick={() => setActiveLocale(locale)}
                className={cn(
                  'text-button rounded-full px-4 py-2 transition-colors duration-fast',
                  activeLocale === locale
                    ? 'bg-accent text-content-on-accent'
                    : 'bg-surface-sunken text-content-secondary hover:text-content-primary',
                )}
              >
                {localeMeta[locale].nativeName}
              </button>
            ))}
          </div>

          {locales.map((locale) => (
            <div
              key={locale}
              hidden={activeLocale !== locale}
              className="grid gap-5 md:grid-cols-2"
            >
              {fields
                .filter((field) => field.localized === true)
                .map((field) => {
                  const name = translationFieldName(field.name, locale);

                  return (
                    <FieldControl
                      key={name}
                      field={{ ...field, required: false, hintKey: undefined }}
                      name={name}
                      value={values[name] ?? null}
                      options={field.options ?? []}
                      invalid={invalidField === name}
                      disabled={isSubmitting}
                      onChange={setValue}
                      t={tRoot}
                      placeholder={t('selectPlaceholder')}
                      labelSuffix={localeMeta[locale].nativeName}
                    />
                  );
                })}
            </div>
          ))}
        </section>
      ) : null}

      {children}

      {serverError ? (
        <p role="alert" className="text-body-sm font-semibold text-content-danger">
          {tRoot(serverError.messageKey as MessageKey, serverError.params)}
        </p>
      ) : null}

      {saved && !serverError ? (
        <p role="status" className="text-body-sm font-semibold text-content-success">
          {t('savedNotice')}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="accent" disabled={isSubmitting}>
          {t('saveCta')}
        </Button>
      </div>
    </form>
  );
}

/* ─────────────────────────────── Одно поле ─────────────────────────────── */

interface FieldControlProps {
  field: AdminFieldSpec;
  name: string;
  value: AdminFieldValue;
  options: readonly AdminOption[];
  invalid: boolean;
  disabled: boolean;
  onChange: (name: string, value: AdminFieldValue) => void;
  t: Translate;
  placeholder: string;
  labelSuffix?: string;
}

function FieldControl({
  field,
  name,
  value,
  options,
  invalid,
  disabled,
  onChange,
  t,
  placeholder,
  labelSuffix,
}: FieldControlProps) {
  const label = labelSuffix ? `${t(field.labelKey)} (${labelSuffix})` : t(field.labelKey);

  return (
    <FormField
      name={name}
      labelKey={field.labelKey}
      labelText={label}
      hintKey={field.hintKey}
      errorKey={invalid ? 'validation.required' : null}
      required={field.required}
      className={field.full === true || field.kind === 'textarea' ? 'md:col-span-2' : undefined}
    >
      {(control) => (
        <FieldWidget
          field={field}
          name={name}
          value={value}
          options={options}
          disabled={disabled}
          onChange={onChange}
          placeholder={placeholder}
          id={control.id}
          describedBy={control.describedBy}
          invalid={control.invalid}
          t={t}
        />
      )}
    </FormField>
  );
}

interface WidgetProps {
  field: AdminFieldSpec;
  name: string;
  value: AdminFieldValue;
  options: readonly AdminOption[];
  disabled: boolean;
  onChange: (name: string, value: AdminFieldValue) => void;
  placeholder: string;
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  t: Translate;
}

function FieldWidget({
  field,
  name,
  value,
  options,
  disabled,
  onChange,
  placeholder,
  id,
  describedBy,
  invalid,
  t,
}: WidgetProps) {
  /** Подпись варианта: самоназвание языка как есть, остальное — через ключ. */
  const optionLabel = (option: AdminOption): string =>
    option.label ?? (option.labelKey ? t(option.labelKey) : option.value);

  const shared = {
    id,
    name,
    disabled,
    'aria-describedby': describedBy,
    'aria-invalid': invalid || undefined,
    required: field.required,
  } as const;

  switch (field.kind) {
    case 'switch':
      return (
        <input
          {...shared}
          type="checkbox"
          checked={value === true}
          onChange={(event) => onChange(name, event.target.checked)}
          className="size-5 rounded-sm border-border-strong accent-accent"
        />
      );

    case 'textarea':
      return (
        <textarea
          {...shared}
          rows={field.rows ?? 4}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(name, event.target.value)}
          className="form-input resize-y"
        />
      );

    case 'list':
      /*
       * Список — многострочный ввод, а не набор полей с кнопкой «добавить».
       * Причина прагматичная: администратор вставляет пункты из документа
       * заказчика целиком, и построчный ввод здесь быстрее любого конструктора.
       */
      return (
        <textarea
          {...shared}
          rows={field.rows ?? 4}
          value={Array.isArray(value) ? value.join('\n') : ''}
          onChange={(event) =>
            onChange(
              name,
              event.target.value
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line.length > 0),
            )
          }
          className="form-input resize-y"
        />
      );

    case 'select':
    case 'relation':
      return (
        <select
          {...shared}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(name, event.target.value)}
          className="form-input"
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {optionLabel(option)}
            </option>
          ))}
        </select>
      );

    case 'multiselect':
      /*
       * Множественный выбор — чекбоксы, а не `<select multiple>`: последний
       * требует ctrl-щелчка, недостижим на телефоне и теряет выбор при
       * случайном щелчке. Восемнадцать направлений в чекбоксах читаются.
       */
      return (
        <fieldset className="flex flex-wrap gap-3" aria-describedby={describedBy}>
          {options.map((option) => {
            const selected = Array.isArray(value) && value.includes(option.value);

            return (
              <label
                key={option.value}
                className="text-body-sm flex items-center gap-2 text-content-secondary"
              >
                <input
                  type="checkbox"
                  name={name}
                  value={option.value}
                  checked={selected}
                  disabled={disabled}
                  onChange={(event) => {
                    const current = Array.isArray(value) ? [...value] : [];
                    onChange(
                      name,
                      event.target.checked
                        ? [...current, option.value]
                        : current.filter((item) => item !== option.value),
                    );
                  }}
                  className="size-4 rounded-sm border-border-strong accent-accent"
                />
                {optionLabel(option)}
              </label>
            );
          })}
        </fieldset>
      );

    case 'number':
    case 'money':
      return (
        <input
          {...shared}
          type="number"
          inputMode="numeric"
          step={1}
          min={field.min}
          max={field.max}
          value={typeof value === 'number' ? String(value) : ''}
          onChange={(event) =>
            onChange(name, event.target.value === '' ? null : Number.parseInt(event.target.value, 10))
          }
          className="form-input"
        />
      );

    case 'rate':
    case 'decimal':
      return (
        <input
          {...shared}
          type="number"
          /*
           * `step="any"` для дробных: шаг 0.01 не даёт ввести координату с шестью
           * знаками, а именно столько нужно, чтобы точка на карте попала в дом.
           */
          step={field.kind === 'rate' ? 0.01 : 'any'}
          min={field.min}
          max={field.max}
          value={typeof value === 'number' ? String(value) : ''}
          onChange={(event) =>
            onChange(name, event.target.value === '' ? null : Number.parseFloat(event.target.value))
          }
          className="form-input"
        />
      );

    case 'date':
      return (
        <input
          {...shared}
          type="date"
          value={typeof value === 'string' ? value.slice(0, 10) : ''}
          onChange={(event) => onChange(name, event.target.value === '' ? null : event.target.value)}
          className="form-input"
        />
      );

    case 'datetime':
      /*
       * `datetime-local` без зоны: платформа работает в одном часовом поясе
       * (`site.timeZone`), и показывать администратору смещение значит заставлять
       * его считать. В ISO значение превращается при отправке.
       */
      return (
        <input
          {...shared}
          type="datetime-local"
          value={typeof value === 'string' ? value.slice(0, 16) : ''}
          onChange={(event) =>
            onChange(name, event.target.value === '' ? null : new Date(event.target.value).toISOString())
          }
          className="form-input"
        />
      );

    case 'time':
      return (
        <input
          {...shared}
          type="time"
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(name, event.target.value)}
          className="form-input"
        />
      );

    case 'email':
      return (
        <input
          {...shared}
          type="email"
          inputMode="email"
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(name, event.target.value)}
          className="form-input"
        />
      );

    case 'slug':
    case 'text':
      return (
        <input
          {...shared}
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(name, event.target.value)}
          className="form-input"
        />
      );
  }
}
