'use client';

/**
 * MEDIA CROP & PREVIEW DIALOG — превью карточек (1:1, 4:3, 16:9), настройка точки фокуса
 * (`focalPoint` → `object-position`) и кадрирование/поворот/зум изображения через Canvas.
 *
 * Позволяет:
 * 1. Сразу увидеть, как загруженный кадр выглядит в карточке инструктора/аватаре (1:1),
 *    карточке занятия/зала (4:3) и на широком фоне страницы 16:9 (PageHero).
 * 2. Поднять или опустить фокус (например, если голова инструктора обрезается сверху)
 *    простым перетаскиванием по любому из превью или ползунками X/Y — без перезагрузки файла.
 * 3. Физически обрезать (crop), приблизить (zoom), сдвинуть, повернуть на ±90° или отразить
 *    изображение и перезаписать файл.
 */

import { useState, type PointerEvent } from 'react';
import { useAction } from 'next-safe-action/hooks';
import { useTranslations } from 'next-intl';
import { CropIcon, FlipHorizontalIcon, FocusIcon, RotateCcwIcon, RotateCwIcon } from 'lucide-react';

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
import { apiRoutes } from '@/config/routes';
import type { MediaPurpose, UploadKind } from '@/config/security';
import { useRouter } from '@/i18n/routing';
import { updateMediaFocalPoint } from '@/server/actions/admin/resource';

export interface MediaCropDialogProps {
  /** Если передан `assetId`, редактируем уже сохранённый `MediaAsset`. */
  assetId?: string;
  imageUrl: string;
  altText: string;
  initialFocalPoint?: string | null;
  kind: UploadKind;
  ownerField: string;
  ownerId: string;
  purpose?: MediaPurpose | null;
  /** Колбэк при работе с локальным превью до отправки на сервер. */
  onLocalUpdate?: (result: { focalPoint: string; croppedFile?: File; previewUrl?: string }) => void;
}

type AspectPreset = '1:1' | '4:3' | '3:4' | '16:9';

const ASPECT_RATIOS: Record<AspectPreset, number> = {
  '1:1': 1,
  '4:3': 4 / 3,
  '3:4': 3 / 4,
  '16:9': 16 / 9,
};

const OUTPUT_WIDTHS: Record<AspectPreset, number> = {
  '1:1': 1080,
  '4:3': 1280,
  '3:4': 1080,
  '16:9': 1920,
};

export function parseFocalPoint(raw?: string | null): { x: number; y: number } {
  if (!raw) return { x: 50, y: 50 };
  const match = raw.trim().match(/^(\d{1,3})%\s+(\d{1,3})%$/);
  if (!match) return { x: 50, y: 50 };
  const x = Math.min(100, Math.max(0, Number(match[1])));
  const y = Math.min(100, Math.max(0, Number(match[2])));
  return { x, y };
}

async function renderCroppedWebp(options: {
  imageUrl: string;
  aspect: AspectPreset;
  zoom: number;
  panX: number;
  panY: number;
  rotation: number;
  flipH: boolean;
}): Promise<File> {
  const { imageUrl, aspect, zoom, panX, panY, rotation, flipH } = options;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Failed to load image for cropping'));
    el.src = imageUrl;
  });

  const ratio = ASPECT_RATIOS[aspect];
  const targetW = OUTPUT_WIDTHS[aspect];
  const targetH = Math.round(targetW / ratio);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  const isRotated90 = Math.abs(rotation % 180) === 90;
  const srcW = isRotated90 ? img.naturalHeight : img.naturalWidth;
  const srcH = isRotated90 ? img.naturalWidth : img.naturalHeight;

  const baseScale = Math.max(targetW / Math.max(srcW, 1), targetH / Math.max(srcH, 1));
  const totalScale = baseScale * zoom;

  const drawW = srcW * totalScale;
  const drawH = srcH * totalScale;

  const maxOffsetX = Math.max(0, (drawW - targetW) / 2);
  const maxOffsetY = Math.max(0, (drawH - targetH) / 2);

  const offsetX = (panX / 100) * maxOffsetX;
  const offsetY = (panY / 100) * maxOffsetY;

  ctx.save();
  ctx.translate(targetW / 2 - offsetX, targetH / 2 - offsetY);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(flipH ? -totalScale : totalScale, totalScale);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  ctx.restore();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))),
      'image/webp',
      0.92,
    );
  });

  return new File([blob], `cropped-${Date.now()}.webp`, { type: 'image/webp' });
}

export function MediaCropDialog({
  assetId,
  imageUrl,
  altText,
  initialFocalPoint,
  kind,
  ownerField,
  ownerId,
  purpose,
  onLocalUpdate,
}: MediaCropDialogProps) {
  const t = useTranslations('admin.media');
  const tCommon = useTranslations('common.actions');
  const router = useRouter();

  const initialFp = parseFocalPoint(initialFocalPoint);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'preview' | 'crop'>('preview');

  const [focalX, setFocalX] = useState(initialFp.x);
  const [focalY, setFocalY] = useState(initialFp.y);
  const [focalSaved, setFocalSaved] = useState(false);

  const [aspect, setAspect] = useState<AspectPreset>(
    purpose === 'background' || kind === 'venuePhoto' ? '16:9' : kind === 'classPhoto' ? '4:3' : '1:1',
  );
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [cropping, setCropping] = useState(false);
  const [cropError, setCropError] = useState<string | null>(null);

  const { execute: saveFocal, status: focalStatus } = useAction(updateMediaFocalPoint, {
    onSuccess: () => {
      setFocalSaved(true);
      router.refresh();
    },
  });

  const focalString = `${Math.round(focalX)}% ${Math.round(focalY)}%`;
  const savingFocal = focalStatus === 'executing';

  function updateFocalFromPointer(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = Math.min(100, Math.max(0, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
    const y = Math.min(100, Math.max(0, Math.round(((e.clientY - rect.top) / rect.height) * 100)));
    setFocalX(x);
    setFocalY(y);
    setFocalSaved(false);
  }

  function handleSaveFocal() {
    if (onLocalUpdate && !assetId) {
      onLocalUpdate({ focalPoint: focalString });
      setFocalSaved(true);
      setOpen(false);
      return;
    }
    if (assetId) {
      saveFocal({ id: assetId, focalPoint: focalString });
    }
  }

  async function handleApplyCrop() {
    setCropping(true);
    setCropError(null);
    try {
      const croppedFile = await renderCroppedWebp({
        imageUrl,
        aspect,
        zoom,
        panX,
        panY,
        rotation,
        flipH,
      });

      if (onLocalUpdate && !assetId) {
        const previewUrl = URL.createObjectURL(croppedFile);
        onLocalUpdate({ focalPoint: focalString, croppedFile, previewUrl });
        setOpen(false);
        return;
      }

      const body = new FormData();
      body.set('file', croppedFile);
      body.set('kind', kind);
      body.set('altText', altText.trim() || 'image');
      body.set(ownerField, ownerId);
      if (purpose) body.set('purpose', purpose);
      body.set('focalPoint', focalString);
      if (assetId) body.set('replaceAssetId', assetId);

      const res = await fetch(apiRoutes.mediaUpload(), { method: 'POST', body });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCropError((data.error as string) ?? t('uploadErrorStatus', { status: String(res.status) }));
        return;
      }

      setOpen(false);
      router.refresh();
    } catch (err) {
      setCropError(err instanceof Error ? err.message : t('uploadGenericError'));
    } finally {
      setCropping(false);
    }
  }

  const aspectClass =
    aspect === '1:1'
      ? 'aspect-square max-w-xs'
      : aspect === '4:3'
        ? 'aspect-4/3 max-w-md'
        : aspect === '3:4'
          ? 'aspect-3/4 max-w-xs'
          : 'aspect-video max-w-lg';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <CropIcon className="size-3.5" aria-hidden />
          {t('editorOpen')}
        </Button>
      </DialogTrigger>

      <DialogContent closeLabel={tCommon('close')} className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('editorTitle')}</DialogTitle>
          <DialogDescription>{t('editorSubtitle')}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 border-b border-border-subtle pb-3">
          <Button
            type="button"
            variant={tab === 'preview' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab('preview')}
            className="gap-1.5"
          >
            <FocusIcon className="size-3.5" aria-hidden />
            {t('editorTabPreview')}
          </Button>
          <Button
            type="button"
            variant={tab === 'crop' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab('crop')}
            className="gap-1.5"
          >
            <CropIcon className="size-3.5" aria-hidden />
            {t('editorTabCrop')}
          </Button>
        </div>

        {tab === 'preview' ? (
          <div className="flex flex-col gap-4">
            <p className="text-caption text-content-secondary">{t('editorFocalHint')}</p>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* 1:1 Card & Avatar preview */}
              <div className="flex flex-col gap-1.5">
                <span className="text-caption font-medium text-content-secondary">
                  {t('editorPreviewCard1x1')}
                </span>
                <div
                  role="presentation"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    updateFocalFromPointer(e);
                  }}
                  onPointerMove={(e) => {
                    if (e.buttons === 1) updateFocalFromPointer(e);
                  }}
                  className="relative aspect-square w-full cursor-crosshair overflow-hidden rounded-lg border border-border-default bg-surface-sunken select-none"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt={altText}
                    draggable={false}
                    className="size-full object-cover pointer-events-none"
                    style={{ objectPosition: focalString }}
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent/80 shadow-md"
                    style={{ left: `${focalX}%`, top: `${focalY}%` }}
                  />
                </div>
              </div>

              {/* 4:3 Class / Studio card preview */}
              <div className="flex flex-col gap-1.5">
                <span className="text-caption font-medium text-content-secondary">
                  {t('editorPreviewCard4x3')}
                </span>
                <div
                  role="presentation"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    updateFocalFromPointer(e);
                  }}
                  onPointerMove={(e) => {
                    if (e.buttons === 1) updateFocalFromPointer(e);
                  }}
                  className="relative aspect-4/3 w-full cursor-crosshair overflow-hidden rounded-lg border border-border-default bg-surface-sunken select-none"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt={altText}
                    draggable={false}
                    className="size-full object-cover pointer-events-none"
                    style={{ objectPosition: focalString }}
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent/80 shadow-md"
                    style={{ left: `${focalX}%`, top: `${focalY}%` }}
                  />
                </div>
              </div>
            </div>

            {/* 16:9 PageHero background preview */}
            <div className="flex flex-col gap-1.5">
              <span className="text-caption font-medium text-content-secondary">
                {t('editorPreviewHero16x9')}
              </span>
              <div
                role="presentation"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  updateFocalFromPointer(e);
                }}
                onPointerMove={(e) => {
                  if (e.buttons === 1) updateFocalFromPointer(e);
                }}
                className="relative aspect-video w-full cursor-crosshair overflow-hidden rounded-lg border border-border-default bg-surface-cinema select-none"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={altText}
                  draggable={false}
                  className="size-full object-cover brightness-75 pointer-events-none"
                  style={{ objectPosition: focalString }}
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-linear-to-t from-surface-cinema/90 via-surface-cinema/40 to-transparent"
                />
                <div className="pointer-events-none absolute inset-x-4 bottom-3 flex items-end justify-between">
                  <span className="text-body-sm font-semibold text-content-on-cinema truncate">
                    {altText}
                  </span>
                  <span className="text-caption text-content-on-cinema-muted">{focalString}</span>
                </div>
                <span
                  aria-hidden
                  className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent/80 shadow-md"
                  style={{ left: `${focalX}%`, top: `${focalY}%` }}
                />
              </div>
            </div>

            {/* Sliders for exact focal point control */}
            <div className="grid gap-4 rounded-lg border border-border-subtle bg-surface-sunken p-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-caption text-content-secondary">
                <span>
                  {t('editorFocalX')}: <strong>{focalX}%</strong>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={focalX}
                  onChange={(e) => {
                    setFocalX(Number(e.target.value));
                    setFocalSaved(false);
                  }}
                />
              </label>

              <label className="flex flex-col gap-1 text-caption text-content-secondary">
                <span>
                  {t('editorFocalY')}: <strong>{focalY}%</strong>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={focalY}
                  onChange={(e) => {
                    setFocalY(Number(e.target.value));
                    setFocalSaved(false);
                  }}
                />
              </label>
            </div>

            {focalSaved ? (
              <p className="text-caption font-semibold text-content-success">{t('editorFocalSaved')}</p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFocalX(50);
                  setFocalY(50);
                  setFocalSaved(false);
                }}
              >
                {t('editorFocalReset')}
              </Button>
              <Button type="button" size="sm" disabled={savingFocal} onClick={handleSaveFocal}>
                {savingFocal ? t('editorApplying') : t('editorFocalSave')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Aspect Ratio buttons */}
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: '1:1', label: t('editorAspect1x1') },
                  { id: '4:3', label: t('editorAspect4x3') },
                  { id: '3:4', label: t('editorAspect3x4') },
                  { id: '16:9', label: t('editorAspect16x9') },
                ] as const
              ).map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  size="sm"
                  variant={aspect === item.id ? 'default' : 'outline'}
                  onClick={() => setAspect(item.id)}
                >
                  {item.label}
                </Button>
              ))}
            </div>

            {/* Interactive Crop Preview Box */}
            <div className="flex justify-center rounded-lg border border-border-default bg-surface-sunken p-4">
              <div className={`relative w-full overflow-hidden rounded-md border border-border-strong bg-surface-cinema ${aspectClass}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={altText}
                  draggable={false}
                  className="size-full object-cover transition-transform duration-75"
                  style={{
                    objectPosition: `${50 + panX / 2}% ${50 + panY / 2}%`,
                    transform: `scale(${zoom}) rotate(${rotation}deg) scaleX(${flipH ? -1 : 1})`,
                  }}
                />
              </div>
            </div>

            {/* Zoom & Pan controls */}
            <div className="grid gap-3 rounded-lg border border-border-subtle bg-surface-sunken p-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-caption text-content-secondary">
                <span>
                  {t('editorZoom')}: <strong>{zoom.toFixed(2)}×</strong>
                </span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                />
              </label>

              <label className="flex flex-col gap-1 text-caption text-content-secondary">
                <span>
                  {t('editorPanX')}: <strong>{panX}%</strong>
                </span>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={1}
                  value={panX}
                  onChange={(e) => setPanX(Number(e.target.value))}
                />
              </label>

              <label className="flex flex-col gap-1 text-caption text-content-secondary">
                <span>
                  {t('editorPanY')}: <strong>{panY}%</strong>
                </span>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={1}
                  value={panY}
                  onChange={(e) => setPanY(Number(e.target.value))}
                />
              </label>
            </div>

            {/* Rotate & Flip buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRotation((r) => (r - 90) % 360)}
                className="gap-1.5"
              >
                <RotateCcwIcon className="size-3.5" aria-hidden />
                {t('editorRotateLeft')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="gap-1.5"
              >
                <RotateCwIcon className="size-3.5" aria-hidden />
                {t('editorRotateRight')}
              </Button>
              <Button
                type="button"
                variant={flipH ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFlipH((f) => !f)}
                className="gap-1.5"
              >
                <FlipHorizontalIcon className="size-3.5" aria-hidden />
                {t('editorFlipH')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setZoom(1);
                  setPanX(0);
                  setPanY(0);
                  setRotation(0);
                  setFlipH(false);
                }}
              >
                {t('editorResetCrop')}
              </Button>
            </div>

            {cropError ? (
              <p role="alert" className="text-body-sm font-semibold text-content-danger">
                {cropError}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="button" size="sm" disabled={cropping} onClick={() => void handleApplyCrop()}>
                {cropping ? t('editorApplying') : t('editorApplyCrop')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
