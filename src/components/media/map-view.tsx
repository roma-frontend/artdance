'use client';

/**
 * ИНТЕРАКТИВНАЯ КАРТА (2.10) — страница площадки, где нужна навигация, а не
 * картинка из листинга.
 *
 * Подход: iframe Google Maps (без SDK — 0 KB кастомного JS, без загрузки SDK
 * в начальный бандл). До первого рендера iframe видна заглушка (loading),
 * высота фиксирована, чтобы не было CLS. После загрузки — готовая карта.
 *
 * Ключ обязателен: без `NEXT_PUBLIC_MAPS_API_KEY` карта не отрисуется, вместо
 * неё — аккуратная заглушка с адресом и ссылкой «открыть в Google Maps».
 *
 * Состояния из каталога (08): loading, ready, no-key, load-failed. Кластеризация
 * пинов — на JS-карте, здесь её намеренно нет: экономит бандл и деньги.
 */

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { clientEnv } from '@/config/env';

export interface MapViewProps {
  latitude: number;
  longitude: number;
  label: string;
  /** Высота в px (карта с fixed height, чтобы не было CLS при подгрузке). */
  height?: number;
}

export function MapView({ latitude, longitude, label, height = 280 }: MapViewProps) {
  const t = useTranslations('map');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const apiKey = clientEnv.NEXT_PUBLIC_MAPS_API_KEY;

  if (!apiKey) {
    /* Без ключа нет интерактива: заглушка + ссылка на координаты. */
    return (
      <div
        className="flex w-full flex-col gap-3 rounded-lg border border-border-default bg-surface-card p-5"
        style={{ height }}
        role="region"
        aria-label={`Карта: ${label}`}
      >
        <p className="text-body-sm font-semibold text-content-primary">{label}</p>
        <p className="text-caption text-content-secondary">
          {t('noKey')}
        </p>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-body-sm font-semibold text-content-accent underline"
        >
          {t('openInMaps')}
        </a>
      </div>
    );
  }

  const src =
    `https://maps.google.com/maps?q=${latitude},${longitude}` +
    `&z=15&output=embed&key=${apiKey}`;

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-border-default bg-surface-card" style={{ height }}>
      {!ready ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-sunken" role="status" aria-live="polite">
          <span className="text-caption text-content-tertiary">
            {error ? t('loadFailed') : t('loading')}
          </span>
          {!error && (
            <button
              type="button"
              onClick={() => setReady(true)}
              className="rounded-md border border-border-default bg-surface-raised px-4 py-2 text-body-sm font-medium text-content-primary"
            >
              {t('load')}
            </button>
          )}
        </div>
      ) : (
        <iframe
          title={`Карта: ${label}`}
          src={src}
          style={{ width: '100%', height, border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={() => setReady(true)}
          onError={() => {
            setReady(true);
            setError(true);
          }}
        />
      )}
    </div>
  );
}
