'use client';

/**
 * FILE DROPZONE — переиспользуемый drop-инпут (скопирован из caron StickyProductSummary).
 *
 * Два режима:
 *  • gallery — сетка превью, чекбоксы выбора, bulk-тулбар (Select All/Delete), drag&drop
 *  • single — dashed-кнопка aspect-video, превью + крестик (как в caron categories)
 */

import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';

export interface FileDropzoneProps {
  mode: 'gallery' | 'single';
  images: string[];
  onImagesChange: (next: string[]) => void;
  onUpload: (files: File[]) => Promise<void>;
  uploading: boolean;
  dragHint?: string;
  singleLabel?: string;
  accept?: string;
}

export function FileDropzone({
  mode,
  images,
  onImagesChange,
  onUpload,
  uploading,
  dragHint,
  singleLabel,
  accept = 'image/*',
}: FileDropzoneProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);

  const appendFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files as FileList & File[]);
    if (arr.length === 0) return;
    await onUpload(arr as File[]);
  };

  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (uploading || !e.dataTransfer.files?.length) return;
    await appendFiles(e.dataTransfer.files);
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

  if (mode === 'single') {
    const current = images[0];
    if (current) {
      return (
        <div className="relative aspect-video overflow-hidden rounded-lg border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onImagesChange([])}
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-xs text-white"
          >
            ✕
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={async (e) => {
              if (!e.target.files?.length) return;
              await appendFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      );
    }
    return (
      <>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-content-tertiary hover:border-accent hover:text-accent"
        >
          <ImagePlus className="h-5 w-5" /> {uploading ? '…' : (singleLabel ?? 'Загрузить изображение')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={async (e) => {
            if (!e.target.files?.length) return;
            const file = e.target.files[0];
            if (!file) return;
            await onUpload([file]);
            e.target.value = '';
          }}
        />
      </>
    );
  }

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelected(selected.length === images.length ? [] : images.map((_, i) => i))}
            className="rounded-full border border-border-default bg-surface-card px-3 py-1 text-xs font-medium hover:border-accent hover:text-accent"
          >
            {selected.length === images.length ? 'Снять выбор' : 'Выбрать все'}
          </button>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onImagesChange(images.filter((_, i) => !selected.includes(i)));
                setSelected([]);
              }}
              className="rounded-full border border-destructive bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/20"
            >
              Удалить выбранные ({selected.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onImagesChange([]);
              setSelected([]);
            }}
            className="rounded-full border border-border-default bg-surface-card px-3 py-1 text-xs font-medium hover:border-destructive hover:text-destructive"
          >
            Удалить все
          </button>
        </div>
      )}
      <div
        className={`rounded-xl border-2 border-dashed p-3 transition-colors ${dragActive ? 'border-accent bg-accent/5' : 'border-border-default bg-surface-sunken/40'}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <div className="grid grid-cols-4 gap-2">
          {images.map((img, i) => {
            const isSelected = selected.includes(i);
            return (
              <div
                key={`${img}-${i}`}
                className={`relative aspect-square overflow-hidden rounded-lg border ${isSelected ? 'border-accent ring-2 ring-accent/30' : 'border-border-subtle'}`}
              >
                <button
                  type="button"
                  onClick={() => setSelected((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]))}
                  className={`absolute left-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border text-xs transition ${isSelected ? 'border-accent bg-accent text-white shadow-lg' : 'border-white/80 bg-white/95 text-content-tertiary hover:border-accent hover:text-accent'}`}
                >
                  {isSelected ? '✓' : '+'}
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => onImagesChange(images.filter((_, idx) => idx !== i))}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-white"
                >
                  ✕
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed text-content-tertiary hover:border-accent hover:text-accent"
          >
            <ImagePlus className="h-6 w-6" />
          </button>
        </div>
        {dragHint ? <p className="mt-2 text-xs text-content-tertiary">{dragHint}</p> : null}
      </div>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={async (e) => {
          if (!e.target.files?.length) return;
          await appendFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
