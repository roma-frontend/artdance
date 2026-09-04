/**
 * FORM FIELD — подпись, поле, подсказка, ошибка.
 *
 * В прототипе поля — просто `<input class="form-input">`, и в четырёх формах из
 * пяти подпись заменена placeholder'ом. Это не мелочь: placeholder исчезает при
 * первом же символе, поэтому вернувшийся к форме человек не знает, что он
 * заполнил, а скринридер подпись не читает вовсе (WCAG 3.3.2). Здесь подпись
 * обязательна и связана с полем через `id`.
 *
 * **Три вещи навешивает компонент, а не место вызова**, потому что забыть их —
 * норма, а не исключение: `id`/`htmlFor`, `aria-describedby` до подсказки и
 * ошибки, `aria-invalid` при ошибке. Если поле берёт их у себя, в половине форм
 * их не будет.
 *
 * **Почему children — функция, а не узел.** Обычным `ReactNode` эти атрибуты в
 * поле не передать: их пришлось бы дублировать руками у каждого `<input>` —
 * ровно та ошибка, от которой компонент и защищает. Контекст (как в
 * `ui/form.tsx`) потребовал бы `'use client'` и увёл бы в браузер все формы,
 * включая те, что рендерятся на сервере. Функция отдаёт готовые атрибуты и не
 * стоит ни байта JavaScript.
 *
 * **Почему id выводится из `name`, а не из `useId`.** `useId` — хук, а хук
 * закрывает компоненту дорогу в серверный рендер. Детерминированный id ещё и
 * делает устойчивыми селекторы e2e-тестов. Цена — совпадение при двух полях с
 * одним именем на странице; для такого случая есть проп `id`.
 *
 * **Текст ошибки приходит ключом из `validation.*`**, а не строкой у места
 * вызова: «обязательное поле» обязано звучать одинаково во всех тридцати формах,
 * и переводиться один раз.
 */

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import type { MessageKey } from '@/i18n/types';
import { cn } from '@/lib/utils';

/** Атрибуты, которые поле обязано принять. Отдаются готовыми. */
export interface FormFieldRenderProps {
  id: string;
  /** Список id подсказки и ошибки для `aria-describedby`. */
  describedBy: string | undefined;
  /** Значение для `aria-invalid`. */
  invalid: boolean;
  required: boolean;
  name: string;
}

interface FormFieldProps {
  /** Имя поля. Из него выводится `id`, если он не задан явно. */
  name: string;
  /** Ключ i18n, не текст. */
  labelKey: MessageKey;
  /** Пояснение под полем: формат, ограничение, назначение. */
  hintKey?: MessageKey;
  /** Ключ из namespace `validation` или `errors`. Наличие = поле невалидно. */
  errorKey?: MessageKey | null;
  /** Подстановки для ICU в подписи, подсказке и ошибке. */
  values?: Record<string, string | number>;
  required?: boolean;
  /**
   * Подпись скрыта визуально, но остаётся в дереве доступности. Для строки
   * поиска и промокода, где назначение поля очевидно из соседней кнопки.
   */
  labelHidden?: boolean;
  id?: string;
  className?: string;
  children: (field: FormFieldRenderProps) => ReactNode;
}

export function FormField({
  name,
  labelKey,
  hintKey,
  errorKey,
  values,
  required = false,
  labelHidden = false,
  id,
  className,
  children,
}: FormFieldProps) {
  const t = useTranslations();

  const fieldId = id ?? `field-${name}`;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const invalid = Boolean(errorKey);

  /*
   * Порядок важен: скринридер читает описания в порядке перечисления, и ошибка
   * должна прозвучать последней — она отменяет подсказку, а не дополняет её.
   */
  const describedBy =
    [hintKey ? hintId : null, invalid ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label
        htmlFor={fieldId}
        className={cn(
          'text-label flex items-baseline gap-1.5 uppercase text-content-secondary',
          labelHidden && 'sr-only',
        )}
      >
        {t(labelKey, values)}
        {/*
          Необязательность помечается словом, а не отсутствием звёздочки:
          звёздочка требует легенды «* — обязательно», которой в макете нет, и
          на длинной форме читается как опечатка.
        */}
        {!required && (
          <span className="text-caption font-normal normal-case text-content-tertiary">
            {t('common.labels.optional')}
          </span>
        )}
      </label>

      {children({ id: fieldId, describedBy, invalid, required, name })}

      {hintKey && (
        <p id={hintId} className="text-caption text-content-tertiary">
          {t(hintKey, values)}
        </p>
      )}

      {/*
        `role="alert"` появляется вместе с текстом: ошибка возникает как
        следствие отправки формы, и о ней нужно сообщить сразу, не дожидаясь,
        пока пользователь дойдёт до поля табуляцией.
      */}
      {invalid && errorKey && (
        <p id={errorId} role="alert" className="text-caption font-semibold text-content-danger">
          {t(errorKey, values)}
        </p>
      )}
    </div>
  );
}
