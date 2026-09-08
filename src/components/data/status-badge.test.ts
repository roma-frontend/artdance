/**
 * Тесты представления статусов.
 *
 * Проверяется не вид метки, а полнота карт: у каждого значения каждого из пяти
 * словарей есть тон и подпись во всех трёх локалях. Пропуск здесь не ломает
 * сборку страницы — он даёт бесцветную метку или имя ключа на экране, причём
 * только в том состоянии, до которого не дошли руками.
 *
 * Заодно фиксируются два смысловых решения, о которых легко забыть при правке
 * цветов: провал должен быть сигнальным, а ожидание — предупреждающим.
 */

import { describe, expect, it } from 'vitest';

import { statusPresentation, type StatusBadgeSubject } from './status-badge';
import {
  bookingStatuses,
  moderationStatuses,
  orderStatuses,
  paymentStatuses,
  payoutStatuses,
} from '@/domain/enums';
import en from '@/i18n/messages/en';
import hy from '@/i18n/messages/hy';
import ru from '@/i18n/messages/ru';

type Catalog = Record<string, unknown>;

/** Значение по точечному пути: `status.booking.pending`. */
function lookup(catalog: Catalog, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => {
    if (node && typeof node === 'object') return (node as Catalog)[key];
    return undefined;
  }, catalog);
}

/** Все статусы всех пяти словарей одним списком. */
const subjects: readonly StatusBadgeSubject[] = [
  ...bookingStatuses.map((status) => ({ kind: 'booking', status }) as const),
  ...paymentStatuses.map((status) => ({ kind: 'payment', status }) as const),
  ...orderStatuses.map((status) => ({ kind: 'order', status }) as const),
  ...payoutStatuses.map((status) => ({ kind: 'payout', status }) as const),
  ...moderationStatuses.map((status) => ({ kind: 'moderation', status }) as const),
];

describe('statusPresentation: полнота карт', () => {
  it('покрыты все статусы всех словарей', () => {
    /* Сумма длин словарей — защита от «забыли добавить словарь в тест». */
    expect(subjects).toHaveLength(
      bookingStatuses.length +
        paymentStatuses.length +
        orderStatuses.length +
        payoutStatuses.length +
        moderationStatuses.length,
    );
  });

  it.each(subjects.map((subject) => [`${subject.kind}.${subject.status}`, subject] as const))(
    '%s имеет тон и подпись во всех трёх локалях',
    (_name, subject) => {
      const { tone, labelKey } = statusPresentation(subject);

      expect(tone).toBeTruthy();
      expect(lookup(en as unknown as Catalog, labelKey), `en.${labelKey}`).toBeTypeOf('string');
      expect(lookup(ru as unknown as Catalog, labelKey), `ru.${labelKey}`).toBeTypeOf('string');
      expect(lookup(hy as unknown as Catalog, labelKey), `hy.${labelKey}`).toBeTypeOf('string');
    },
  );

  it('ключ подписи ведёт в namespace своего словаря', () => {
    for (const subject of subjects) {
      expect(statusPresentation(subject).labelKey).toMatch(
        new RegExp(`^status\\.${subject.kind}\\.`),
      );
    }
  });
});

describe('statusPresentation: смысл тонов', () => {
  it('провалы окрашены сигнально', () => {
    const failures: readonly StatusBadgeSubject[] = [
      { kind: 'booking', status: 'NO_SHOW' },
      { kind: 'booking', status: 'CANCELLED_BY_PROVIDER' },
      { kind: 'payment', status: 'FAILED' },
      { kind: 'payment', status: 'CHARGEBACK' },
      { kind: 'order', status: 'RETURNED' },
      { kind: 'payout', status: 'FAILED' },
      { kind: 'moderation', status: 'REJECTED' },
    ];

    for (const subject of failures) {
      expect(statusPresentation(subject).tone, `${subject.kind}.${subject.status}`).toBe('signal');
    }
  });

  it('ожидание окрашено предупреждающе, а не сигнально', () => {
    const waiting: readonly StatusBadgeSubject[] = [
      { kind: 'booking', status: 'PENDING' },
      { kind: 'booking', status: 'WAITLISTED' },
      { kind: 'payment', status: 'PENDING' },
      { kind: 'order', status: 'CREATED' },
      { kind: 'payout', status: 'SCHEDULED' },
      { kind: 'payout', status: 'ON_HOLD' },
      { kind: 'moderation', status: 'PENDING' },
    ];

    for (const subject of waiting) {
      expect(statusPresentation(subject).tone, `${subject.kind}.${subject.status}`).toBe('warning');
    }
  });

  it('благополучный конец окрашен успехом', () => {
    const done: readonly StatusBadgeSubject[] = [
      { kind: 'booking', status: 'COMPLETED' },
      { kind: 'payment', status: 'PAID' },
      { kind: 'order', status: 'DELIVERED' },
      { kind: 'payout', status: 'PAID' },
      { kind: 'moderation', status: 'APPROVED' },
    ];

    for (const subject of done) {
      expect(statusPresentation(subject).tone, `${subject.kind}.${subject.status}`).toBe('success');
    }
  });

  it('отмена клиентом не кричит: это штатный исход, а не авария', () => {
    expect(statusPresentation({ kind: 'booking', status: 'CANCELLED_BY_CUSTOMER' }).tone).toBe(
      'neutral',
    );
    expect(statusPresentation({ kind: 'order', status: 'CANCELLED' }).tone).toBe('neutral');
  });
});
