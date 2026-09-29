/**
 * Парсер CSV для импорта каталога (E-03).
 *
 * Совместим с экспортом `toCsv` (разделитель `;`, BOM, кавычки `""`), но принимает
 * и запятую: файл мог прийти из Google Sheets / из выгрузки другой системы.
 * Декодирует BOM, если он есть. Ошибки построчные — ни одна запись не пишется,
 * пока хотя бы одна строка не прошла проверку.
 */

import type { z } from 'zod';

export interface CsvParseError {
  line: number; // 1-based, включая заголовок (ошибки начинаются с 2)
  issues: readonly string[];
}

export interface CsvParseResult<T> {
  rows: readonly T[];
  errors: readonly CsvParseError[];
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function detectDelimiter(header: string): string {
  // Если есть `;`, считаем что разделитель `;`, иначе `,`.
  return header.includes(';') ? ';' : ',';
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else current += char;
    } else {
      if (char === '"') inQuotes = true;
      else if (char === delimiter) { cells.push(current); current = ''; }
      else current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

/**
 * Разбор текста CSV в объекты по схеме Zod.
 *
 * `header` маппится 1:1 на ключи схемы (snake/camel как в схеме). Пустые строки
 * игнорируются. Если заголовка нет — весь результат в errors. Пустые ячейки
 * передаются как `""` (схема сама делает `optionalize`/coercion, как в формах).
 */
export function parseCsv<S extends z.ZodTypeAny>(text: string, rowSchema: S): CsvParseResult<z.infer<S>> {
  const stripped = stripBom(text);
  const rawLines = stripped.split(/\r\n|\n|\r/).filter((line) => line.trim().length > 0);
  if (rawLines.length === 0) return { rows: [], errors: [{ line: 1, issues: ['Пустой файл'] }] };

  const headerLine = rawLines[0]!;
  const delimiter = detectDelimiter(headerLine);
  const headers = splitCsvLine(headerLine, delimiter);
  const rows: z.infer<S>[] = [];
  const errors: CsvParseError[] = [];

  for (let index = 1; index < rawLines.length; index++) {
    const cells = splitCsvLine(rawLines[index]!, delimiter);
    const raw: Record<string, string> = {};
    for (let col = 0; col < headers.length; col++) raw[headers[col]!] = cells[col] ?? '';

    const parsed = rowSchema.safeParse(raw);
    if (parsed.success) rows.push(parsed.data);
    else {
      errors.push({
        line: index + 1,
        issues: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'row'}: ${issue.message}`),
      });
    }
  }

  return { rows, errors };
}
