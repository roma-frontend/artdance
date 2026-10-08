'use client';

/**
 * PHOTO UPLOADER — загрузка изображений сущности.
 *
 * Паттерны caron: drag&drop, bulk-toolbar (Select All / Delete), grid превью,
 * чекбоксы ✓/+, скрытый input multiple + fileRef.click(), последовательный цикл for..await.
 */

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { ImagePlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { apiRoutes } from '@/config';
import { uploadPolicies, type UploadKind, type MediaPurpose } from '@/config/security';

interface PhotoUploaderProps {
  kind: UploadKind;
  ownerField: string;
  ownerId: string;
  existingCount: number;
  purpose?: MediaPurpose;
}

export function PhotoUploader({ kind, ownerField, ownerId, existingCount, purpose }: PhotoUploaderProps) {
  const t = useTranslations('admin.media');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [altText, setAltText] = useState('');
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);

  const policy = uploadPolicies[kind];
  const remaining = Math.max(policy.maxPerEntity - existingCount - uploaded, 0);
  const busy = total > 0 && done < total;

  const hintLabel = t.has(`hints.${kind}`) ? t(`hints.${kind}` as never) : (policy.hint ?? '');

  async function handleFiles(files: FileList | File[]) {
    if (altText.trim().length === 0) {
      setFailed(t('fillAltFirst'));
      return;
    }
    const batch = Array.from(files as FileList & File[]).slice(0, remaining) as File[];
    if (batch.length === 0) return;
    // локальные превью до загрузки (caron-стиль)
    const urls = batch.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    setTotal(batch.length);
    setDone(0);
    setFailed(null);

    for (const [index, file] of batch.entries()) {
      const body = new FormData();
      body.set('file', file);
      body.set('kind', kind);
      body.set('altText', altText.trim());
      body.set(ownerField, ownerId);
      if (purpose) body.set('purpose', purpose);

      const response = await fetch(apiRoutes.mediaUpload(), { method: 'POST', body });

      if (!response.ok) {
        setFailed(file.name);
        setTotal(0);
        urls.forEach((u) => URL.revokeObjectURL(u));
        setPreviews([]);
        return;
      }

      setDone(index + 1);
      setUploaded((current) => current + 1);
    }

    setTotal(0);
    urls.forEach((u) => URL.revokeObjectURL(u));
    setPreviews([]);
    if (inputRef.current) inputRef.current.value = '';
    router.refresh();
  }

  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (busy || altText.trim().length === 0 || remaining === 0) return;
    if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
  };
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragActive) setDragActive(true);
  };
  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  return (
    <div
      className={`flex flex-col gap-4 rounded-lg border-2 p-5 transition-colors ${dragActive ? 'border-accent bg-accent/5 border-solid' : 'border-dashed border-border-default bg-surface-raised'}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor={`alt-${ownerId}`} className="text-label uppercase text-content-secondary">
          {t('altHint')}
        </label>
        <input
          id={`alt-${ownerId}`}
          type="text"
          value={altText}
          onChange={(event) => setAltText(event.target.value)}
          placeholder={t('altPlaceholder')}
          className="form-input"
        />
      </div>

      <p className="text-caption text-content-tertiary">
        {t('uploadHint', { max: formatBytes(policy.maxBytes) })} · {hintLabel} · {t('slotsRemaining', { remaining })}
      </p>
      <p className="text-caption text-content-tertiary">{t('dropHintDetailed')}</p>

      {previews.length > 0 ? (
        <div className="grid grid-cols-4 gap-2">
          {previews.map((src, i) => (
            <div key={i} className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">{i < done ? '✓' : '…'}</span>
            </div>
          ))}
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={policy.mimeTypes.join(',')}
        disabled={busy || remaining === 0}
        onChange={(event) => {
          const files = event.target.files;
          if (files && files.length > 0) void handleFiles(files);
        }}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => {
          if (altText.trim().length === 0) {
            setFailed(t('fillAltBeforeUpload'));
            return;
          }
          inputRef.current?.click();
        }}
        disabled={busy || remaining === 0}
        className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-default px-4 py-3 text-sm font-medium text-content-secondary hover:border-accent hover:text-accent disabled:opacity-50"
      >
        <ImagePlus className="h-5 w-5" /> {t('selectFiles')}
      </button>

      {remaining === 0 ? <p className="text-body-sm text-content-warning">{t('empty')}</p> : null}

      {busy ? (
        <p role="status" aria-live="polite" className="text-body-sm text-content-secondary">
          {t('uploading', { done, total })}
        </p>
      ) : null}

      {uploaded > 0 && !busy ? (
        <p role="status" className="text-body-sm font-semibold text-content-success">
          {t('uploaded', { count: uploaded })}
        </p>
      ) : null}

      {failed ? (
        <p role="alert" className="text-body-sm font-semibold text-content-danger">
          {t('failed', { name: failed })}
        </p>
      ) : null}

      {uploaded > 0 ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => window.location.reload()}>
          {t('title')}
        </Button>
      ) : null}
    </div>
  );
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${Math.round(mb)} MB` : `${Math.round(bytes / 1024)} KB`;
}
