import { describe, expect, it } from 'vitest';

import { findContactInfo, maskContactInfo, type ContactKind } from './contacts';

const MIN = 9;

const kindsOf = (text: string): ContactKind[] => findContactInfo(text, MIN).map((m) => m.kind);

describe('findContactInfo: телефоны', () => {
  it.each([
    'Звоните 099 12 34 56',
    'Номер +374 99 123 456',
    'Пишите +7 (916) 123-45-67',
    'телефон 37499123456',
  ])('находит номер: %s', (text) => {
    expect(kindsOf(text)).toEqual(['phone']);
  });

  it('порог цифр задаёт вызывающий: короче порога — не номер', () => {
    expect(findContactInfo('Код 1234 5678', MIN)).toEqual([]);
    expect(findContactInfo('Код 1234 5678', 8).map((m) => m.kind)).toEqual(['phone']);
  });
});

describe('findContactInfo: ложные срабатывания', () => {
  it.each([
    ['дата', 'Занятие 2026-09-12'],
    ['дата и время', 'Старт 12.09.2026 19:00'],
    ['дата и время через пробел', 'Сбор 2026-09-12 10:00'],
    ['сумма', 'Цена 120 000 ֏'],
    ['диапазон дат', 'Курс 12.09.2026 - 13.09.2026'],
    ['номер зала и ряд', 'Зал 4, ряд 12'],
    ['эмодзи', '🙂 🙂 🙂'],
  ])('не считает контактом: %s', (_name, text) => {
    expect(findContactInfo(text, MIN)).toEqual([]);
  });
});

describe('findContactInfo: e-mail, ники и ссылки', () => {
  it('находит e-mail целиком и не принимает его за ник', () => {
    const text = 'Пишите anna.dance@example.am';
    expect(findContactInfo(text, MIN)).toEqual([
      { kind: 'email', start: text.indexOf('anna'), end: text.length },
    ]);
  });

  it('находит ник', () => {
    expect(kindsOf('Пишите в Instagram @anna_dance')).toEqual(['handle']);
  });

  it('ссылка на мессенджер побеждает номер внутри неё', () => {
    expect(kindsOf('Пишите https://wa.me/37499123456')).toEqual(['link']);
  });

  it('находит короткую ссылку t.me', () => {
    expect(kindsOf('Канал t.me/anna_dance')).toEqual(['link']);
  });

  it('возвращает совпадения по порядку и без пересечений', () => {
    expect(kindsOf('wa.me/37499123456 или 099 12 34 56')).toEqual(['link', 'phone']);
  });
});

describe('maskContactInfo', () => {
  it('маскирует телефон и сохраняет длину текста', () => {
    const phone = '099 12 34 56';
    expect(maskContactInfo(`Звоните ${phone} после обеда`, MIN)).toBe(
      `Звоните ${'•'.repeat(phone.length)} после обеда`,
    );
  });

  it('маскирует каждый контакт и оставляет остальной текст', () => {
    const phone = '099 12 34 56';
    const email = 'anna@example.am';
    const text = `Адрес: Абовяна 1, ${phone}, ${email}`;

    const masked = maskContactInfo(text, MIN);

    expect(masked).toBe(`Адрес: Абовяна 1, ${'•'.repeat(phone.length)}, ${'•'.repeat(email.length)}`);
    expect(masked.length).toBe(text.length);
  });

  it('не меняет текст без контактов', () => {
    const text = 'Зал на втором этаже, 2026-09-12 10:00';
    expect(maskContactInfo(text, MIN)).toBe(text);
  });

  it('безопасна для пустой строки', () => {
    expect(maskContactInfo('', MIN)).toBe('');
  });
});
