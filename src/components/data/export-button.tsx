'use client';

/**
 * EXPORT BUTTON — выгрузка отчёта в CSV.
 *
 * Файл собирает сервер и возвращает строкой, а браузер сохраняет её как файл.
 * Почему не ссылка на route handler: выгрузка — это операция с правом
 * `data.export`, ограничением частоты и записью в журнал, то есть ровно server
 * action. Ссылка потребовала бы второго слоя авторизации и второй проверки лимита.
 *
 * Формирование CSV (кавычки, разделитель, защита от formula injection) целиком в
 * `toCsv`; здесь только сохранение.
 */

import { useAction } from 'next-safe-action/hooks';
import { useTranslations } from 'next-intl';

import { ActionError } from '@/components/admin/status-actions';
import { Button } from '@/components/ui/button';
import type { Translate } from '@/i18n/translate';
import { exportOrdersCsv } from '@/server/actions/admin/people';

interface ExportButtonProps {
  range: '30' | '90' | '365';
}

export function ExportButton({ range }: ExportButtonProps) {
  const t = useTranslations('admin.reports');
  const tRoot = useTranslations() as unknown as Translate;

  const { execute, status, result } = useAction(exportOrdersCsv, {
    onSuccess: ({ data }) => {
      if (!data) return;
      download(data.filename, data.csv);
    },
  });

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={status === 'executing'}
        onClick={() => execute({ range })}
      >
        {tRoot('admin.actions.export')}
      </Button>
      <p className="text-caption text-content-tertiary">{t('exportHint')}</p>
      <ActionError error={result.serverError} t={tRoot} />
    </div>
  );
}

/**
 * Сохранение строки как файла. `Blob` с типом CSV и UTF-8: без явного типа
 * браузер предлагает открыть файл как текст, а Excel теряет кириллицу (BOM
 * добавляет `toCsv`).
 */
function download(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}
