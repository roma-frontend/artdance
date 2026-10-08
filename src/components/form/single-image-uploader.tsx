'use client';

/**
 * SINGLE IMAGE UPLOADER — обёртка над загрузкой одного изображения.
 *
 * Используется для полей cover/banner/avatar (maxPerEntity=1).
 * Показывает превью, подсказки по форматам и лимитам, выбор назначения (card/background).
 */

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { ImagePlus } from 'lucide-react';

import { apiRoutes } from '@/config/routes';
import { uploadPolicies, type UploadKind, type MediaPurpose } from '@/config/security';

interface SingleImageUploaderProps {
  kind: UploadKind;
  ownerField: string;
  ownerId: string;
  currentUrl?: string | null;
  currentAlt?: string | null;
  hint?: string;
  purpose?: MediaPurpose | null;
  onPurposeChange?: (p: MediaPurpose) => void;
  showPurpose?: boolean;
}

export function SingleImageUploader({
  kind,
  ownerField,
  ownerId,
  currentUrl,
  currentAlt,
  hint,
  purpose,
  onPurposeChange,
  showPurpose = true,
}: SingleImageUploaderProps) {
  const t = useTranslations('admin.media');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [altText, setAltText] = useState(currentAlt ?? '');
  const [localPurpose, setLocalPurpose] = useState<MediaPurpose>(purpose ?? 'card');
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const policy = uploadPolicies[kind];
  const effectivePurpose = onPurposeChange ? (purpose ?? localPurpose) : localPurpose;

  const hintLabel = t.has(`hints.${kind}`) ? t(`hints.${kind}` as never) : (policy.hint ?? '');

  const uploadHint =
    hint ??
    hintLabel ??
    `До 5 MB, форматы: ${policy.extensions.join(', ').toUpperCase()}. Рекомендация: ${effectivePurpose === 'background' ? t('purposeBackground') : t('purposeCard')}`;

  async function handleFile(file: File) {
    if (!file) return;
    if (altText.trim().length === 0) {
      setError(t('fillAltBeforeUpload'));
      return;
    }
    setUploading(true);
    setError(null);
    setDone(false);

    // локальное превью мгновенно
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    const body = new FormData();
    body.set('file', file);
    body.set('kind', kind);
    body.set('altText', altText.trim());
    body.set(ownerField, ownerId);
    body.set('purpose', effectivePurpose);

    try {
      const res = await fetch(apiRoutes.mediaUpload(), { method: 'POST', body });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data.error as string) ?? t('uploadErrorStatus', { status: String(res.status) }));
        setPreview(null);
        return;
      }
      setDone(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('uploadGenericError'));
      setPreview(null);
    } finally {
      setUploading(false);
      URL.revokeObjectURL(objectUrl);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const displayUrl = preview ?? currentUrl ?? null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border-default bg-surface-card p-4">
      {displayUrl ? (
        <div className={`relative overflow-hidden rounded-lg border ${effectivePurpose === 'background' ? 'aspect-video' : 'aspect-square'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={displayUrl} alt={altText || 'preview'} className="h-full w-full object-cover" />
          {!preview && (
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-sm text-white hover:bg-destructive"
              aria-label={t('removePreview')}
            >
              ✕
            </button>
          )}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor={`alt-${ownerId}`} className="text-xs font-semibold uppercase tracking-wider text-content-secondary">
          {t('altLabelRequired')}
        </label>
        <input
          id={`alt-${ownerId}`}
          type="text"
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
          placeholder={t('altPlaceholderLong')}
          className="form-input"
        />
      </div>

      {showPurpose ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              const next: MediaPurpose = 'card';
              setLocalPurpose(next);
              onPurposeChange?.(next);
            }}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${effectivePurpose === 'card' ? 'border-accent bg-accent/10 text-accent' : 'border-border-default bg-surface-sunken text-content-secondary hover:border-accent/50'}`}
          >
            {t('purposeCard')}
          </button>
          <button
            type="button"
            onClick={() => {
              const next: MediaPurpose = 'background';
              setLocalPurpose(next);
              onPurposeChange?.(next);
            }}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${effectivePurpose === 'background' ? 'border-accent bg-accent/10 text-accent' : 'border-border-default bg-surface-sunken text-content-secondary hover:border-accent/50'}`}
          >
            {t('purposeBackground')}
          </button>
        </div>
      ) : null}

      <p className="text-xs text-content-tertiary">{uploadHint}</p>
      <p className="text-xs text-content-tertiary">
        {t('cardTargetHint', {
          target: effectivePurpose === 'background' ? t('cardTargetBackground') : t('cardTargetCard'),
        })}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={policy.mimeTypes.join(',')}
        disabled={uploading}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => {
          if (altText.trim().length === 0) {
            setError(t('fillAltBeforeUpload'));
            return;
          }
          inputRef.current?.click();
        }}
        disabled={uploading}
        className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-default px-4 py-3 text-sm font-medium text-content-secondary hover:border-accent hover:text-accent disabled:opacity-50"
      >
        <ImagePlus className="h-4 w-4" />
        {uploading ? t('uploadingSingle') : displayUrl ? t('replaceImage') : t('uploadImage')}
      </button>

      {error ? (
        <p role="alert" className="text-sm font-semibold text-content-danger">
          {error}
        </p>
      ) : null}
      {done && !error ? <p className="text-sm font-semibold text-content-success">{t('uploadedRefreshHint')}</p> : null}
    </div>
  );
}
