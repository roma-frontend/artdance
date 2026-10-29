import { describe, expect, it } from 'vitest';

import { bookingGuardrails } from './policy';

const PHONE = '099 12 34 56';

describe('bookingGuardrails: до оплаты', () => {
  it('чистый текст показывается как есть и не попадает в очередь', () => {
    expect(bookingGuardrails({ paid: false, text: { partnerName: 'Анна', customerAddress: 'ул. Абовяна 1' } })).toEqual({
      display: { partnerName: 'Анна', customerAddress: 'ул. Абовяна 1' },
      flaggedFields: [],
      kinds: [],
    });
  });

  it('телефон в адресе маскируется для показа и ставит поле в очередь', () => {
    const result = bookingGuardrails({ paid: false, text: { customerAddress: `Звоните ${PHONE}` } });

    expect(result.display.customerAddress).toBe(`Звоните ${'•'.repeat(PHONE.length)}`);
    expect(result.flaggedFields).toEqual(['customerAddress']);
    expect(result.kinds).toEqual(['phone']);
  });

  it('e-mail в имени партнёра и телефон в адресе: оба поля, виды по алфавиту', () => {
    const result = bookingGuardrails({
      paid: false,
      text: { partnerName: 'anna@example.am', customerAddress: `Тел. ${PHONE}` },
    });

    expect(result.flaggedFields).toEqual(['partnerName', 'customerAddress']);
    expect(result.kinds).toEqual(['email', 'phone']);
  });

  it('отсутствующие и пустые поля дают null и не ставятся в очередь', () => {
    expect(bookingGuardrails({ paid: false, text: { partnerName: null } })).toEqual({
      display: { partnerName: null, customerAddress: null },
      flaggedFields: [],
      kinds: [],
    });
  });

  it('дата со временем в адресе не считается контактом', () => {
    expect(bookingGuardrails({ paid: false, text: { customerAddress: 'Старт 12.09.2026 19:00' } }).flaggedFields).toEqual(
      [],
    );
  });

  it('короче порога из конфига не считается телефоном', () => {
    expect(bookingGuardrails({ paid: false, text: { customerAddress: 'Код 1234 5678' } }).flaggedFields).toEqual([]);
  });
});

describe('bookingGuardrails: после оплаты', () => {
  it('контакты открыты и не ставятся в очередь', () => {
    expect(bookingGuardrails({ paid: true, text: { customerAddress: `Звоните ${PHONE}` } })).toEqual({
      display: { partnerName: null, customerAddress: `Звоните ${PHONE}` },
      flaggedFields: [],
      kinds: [],
    });
  });
});
