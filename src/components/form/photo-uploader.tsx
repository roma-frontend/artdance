'use client';

/**
 * PHOTO UPLOADER — загрузка изображений сущности.
 *
 * Компонент не знает лимитов: тип загрузки (`kind`) определяет и предельный
 * размер, и допустимые форматы, и число файлов на сущность — всё это в
 * `uploadPolicies`. Знание лимита в двух местах означает форму, которая
 * разрешает больше, чем сервер, и отказ после ожидания загрузки.
 *
 * Альтернативный текст обязателен ДО отправки, а не после. Причина не в
 * формальности: `MediaAsset.altText` — обязательное поле схемы, и «добавлю
 * позже» здесь означает либо отказ сервера, либо картинку без описания в
 * каталоге. Одно поле на партию: администратор грузит серию кадров одного зала,
 * и описание у них общее.
 *
 * Файлы отправляются по одному, последовательно. Параллельная отправка десяти
 * восьмимегабайтных кадров кладёт и канал, и обработчик; последовательная даёт
 * честный прогресс «3 из 7».
 */

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { apiRoutes } from '@/config';
import { uploadPolicies, type UploadKind } from '@/config/security';

interface PhotoUploaderProps {
  kind: UploadKind;
  /** Поле-владелец `MediaAsset`: `instructorId`, `venueId`, … */
  ownerField: string;
  ownerId: string;
  /** Сколько кадров уже привязано: показывается предел. */
  existingCount: number;
}

export function PhotoUploader({ kind, ownerField, ownerId, existingCount }: PhotoUploaderProps) {
  const t = useTranslations('admin.media');
  const inputRef = useRef<HTMLInputElement>(null);

  const [altText, setAltText] = useState('');
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(0);

  const policy = uploadPolicies[kind];
  const remaining = Math.max(policy.maxPerEntity - existingCount - uploaded, 0);
  const busy = total > 0 && done < total;

  async function upload(files: FileList): Promise<void> {
    const batch = Array.from(files).slice(0, remaining);
    setTotal(batch.length);
    setDone(0);
    setFailed(null);

    for (const [index, file] of batch.entries()) {
      const body = new FormData();
      body.set('file', file);
      body.set('kind', kind);
      body.set('altText', altText);
      body.set(ownerField, ownerId);

      const response = await fetch(apiRoutes.mediaUpload(), { method: 'POST', body });

      if (!response.ok) {
        setFailed(file.name);
        setTotal(0);
        return;
      }

      setDone(index + 1);
      setUploaded((current) => current + 1);
    }

    setTotal(0);
    if (inputRef.current) inputRef.current.value = '';
    /*
     * Обновление страницы не вызывается: список кадров перечитается при
     * следующем переходе. Дёргать `router.refresh()` посреди партии значит
     * перерисовывать форму, которую человек ещё заполняет.
     */
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-dashed border-border-default bg-surface-raised p-5">
      <div className="flex flex-col gap-2">
        <label htmlFor={`alt-${ownerId}`} className="text-label uppercase text-content-secondary">
          {t('altHint')}
        </label>
        <input
          id={`alt-${ownerId}`}
          type="text"
          value={altText}
          onChange={(event) => setAltText(event.target.value)}
          className="form-input"
        />
      </div>

      <p className="text-caption text-content-tertiary">
        {t('uploadHint', { max: formatBytes(policy.maxBytes) })}
      </p>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={policy.mimeTypes.join(',')}
        disabled={busy || altText.trim().length === 0 || remaining === 0}
        onChange={(event) => {
          const files = event.target.files;
          if (files && files.length > 0) void upload(files);
        }}
        className="text-body-sm text-content-secondary"
      />

      {remaining === 0 ? (
        <p className="text-body-sm text-content-warning">{t('empty')}</p>
      ) : null}

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

/** Человеческий размер файла. Единицы не переводятся: «MB» читается везде. */
function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${Math.round(mb)} MB` : `${Math.round(bytes / 1024)} KB`;
}
