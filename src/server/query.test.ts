/**
 * Тесты ключа кеша.
 *
 * Проверяется не «работает ли кеш» (это делает Next), а два свойства, ошибка в
 * которых незаметна и дорога: один и тот же запрос обязан давать один ключ, а
 * время в аргументах обязано быть отвергнуто. Второе — не педантизм: `Date`
 * в ключе означает уникальный ключ на каждый вызов, то есть кеш с нулём
 * попаданий, который при этом занимает память и создаёт видимость работы.
 */

import { describe, expect, it } from 'vitest';

import { stableKey } from './query';

describe('stableKey', () => {
  it('порядок ключей объекта не меняет ключ кеша', () => {
    expect(stableKey({ page: 2, style: 'salsa' })).toBe(stableKey({ style: 'salsa', page: 2 }));
  });

  it('разные значения дают разные ключи', () => {
    expect(stableKey({ page: 1 })).not.toBe(stableKey({ page: 2 }));
  });

  it('вложенные объекты и массивы нормализуются тоже', () => {
    const left = stableKey({ filters: { styles: ['salsa', 'ballet'], level: 'BEGINNER' } });
    const right = stableKey({ filters: { level: 'BEGINNER', styles: ['salsa', 'ballet'] } });
    expect(left).toBe(right);
  });

  it('порядок элементов массива значим: это разные запросы', () => {
    expect(stableKey(['a', 'b'])).not.toBe(stableKey(['b', 'a']));
  });

  it('undefined-поля не влияют на ключ', () => {
    expect(stableKey({ page: 1, sort: undefined })).toBe(stableKey({ page: 1 }));
  });

  it('null и undefined различаются', () => {
    expect(stableKey(null)).not.toBe(stableKey(undefined));
  });

  it('время в аргументах отклоняется', () => {
    expect(() => stableKey(new Date())).toThrow(/время не передаётся аргументом/);
    expect(() => stableKey({ now: new Date() })).toThrow(/время не передаётся аргументом/);
  });

  it('функция в аргументах отклоняется', () => {
    expect(() => stableKey({ map: () => 1 })).toThrow(/функция/);
  });

  it('строка и число с одинаковым видом не путаются', () => {
    expect(stableKey('1')).not.toBe(stableKey(1));
  });
});
