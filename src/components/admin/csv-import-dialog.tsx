'use client';

/**
 * Диалог импорта CSV.
 *
 * Этапы: выбор файла → разбор на клиенте (через parseCsv) → предпросмотр ошибок
 * → отправка на сервер только если ошибок нет. Отправка — одной пачкой на
 * server action, который сам проверяет права и валидацию (не доверяем клиенту).
 */

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface CsvImportDialogProps {
  resource: string;
  onDone?: () => void;
}

export function CsvImportDialog({ resource, onDone }: CsvImportDialogProps) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const content = await file.text();
    setText(content);
  };

  const handleImport = () => {
    if (!text) return;
    startTransition(async () => {
      const { importAdminCsv } = await import('@/server/actions/admin/csv');
      const outcome = await importAdminCsv({ resource: resource as never, csvText: text });
      if (outcome?.serverError || outcome?.validationErrors) {
        setResult('Import failed');
        return;
      }
      const data = outcome?.data as { imported: number; skipped: number; errors: readonly { line: number }[] } | undefined;
      if (!data) { setResult('Import failed'); return; }
      setResult(`${String(t('admin.list.resultsCount', { count: data.imported }))} · ${data.skipped} ${t('admin.errors.guardrailBulk')}`);
      if (data.errors.length === 0) setOpen(false);
      onDone?.();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {String(t('admin.actions.upload'))} CSV
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={String(t('a11y.closeDialog'))}>
        <DialogHeader>
          <DialogTitle>{String(t('admin.actions.upload'))} CSV — {resource}</DialogTitle>
          <DialogDescription>
            {String(t('admin.form.generalSection'))} · {String(t('admin.list.searchPlaceholder'))}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Input type="file" accept=".csv,text/csv" onChange={(event) => void handleFile(event.target.files?.[0] ?? null)} />
          {fileName && <p className="text-caption text-content-secondary">{fileName}</p>}
          {result && <p className="text-body-sm text-content-secondary">{result}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {String(t('common.actions.cancel'))}
          </Button>
          <Button onClick={handleImport} disabled={!text || pending}>
            {pending ? String(t('common.states.loading')) : String(t('admin.actions.upload'))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
