/**
 * СТАТИЧЕСКАЯ КАРТИНКА КАРТЫ (2.10) — листинги и карточки площадок.
 *
 * Картинка Google Static Maps вместо JS-карты: в каталоге интерактив не нужен,
 * а Maps SDK — ~120 KB и блокировка потока (docs/10 §4). Картинка рисуется
 * через единственный компонент `Media` (прямой `next/image` запрещён линтом:
 * рассинхрон `sizes` и сетки — причина проваленного LCP).
 *
 * Без ключа `NEXT_PUBLIC_MAPS_API_KEY` рендерится аккуратный fallback — адрес
 * и ссылка «открыть в картах», без битого изображения. Ключ публичный
 * (`NEXT_PUBLIC_`): встраивается в бандл, на стороне Google его ограничивают
 * HTTP-реферерами (docs/launch/production-setup.md).
 */

import { MapPinIcon } from 'lucide-react';

import { Media } from '@/components/ui/media';
import { clientEnv } from '@/config/env';

export interface StaticMapImageProps {
  latitude: number;
  longitude: number;
  /** Подпись на изображении: название площадки или «студия на выезде». */
  label: string;
  /** `Media`: картинка как LCP-элемент экрана. */
  priority?: boolean;
}

export function StaticMapImage({ latitude, longitude, label, priority = false }: StaticMapImageProps) {
  const apiKey = clientEnv.NEXT_PUBLIC_MAPS_API_KEY;

  if (!apiKey) {
    /*
     * Без ключа карта не нужна: честная заглушка из токенов (без литеральных
     * цветов и без произвольных размеров) — координаты и ссылка, без 404.
     */
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface-sunken p-4" role="img" aria-label={`Карта: ${label}`}>
        <span className="flex items-center gap-2 text-caption font-medium text-content-tertiary">
          <MapPinIcon aria-hidden className="size-4 shrink-0 text-content-accent" />
          Местоположение
        </span>
        <span className="text-body font-semibold text-content-primary">{label}</span>
        <span className="text-caption tabular-nums text-content-secondary">
          {latitude.toFixed(4)}, {longitude.toFixed(4)}
        </span>
      </div>
    );
  }

  const params = new URLSearchParams({
    center: `${latitude},${longitude}`,
    zoom: '15',
    size: '800x480',
    map_type: 'roadmap',
    markers: `label:*,${latitude},${longitude}`,
    key: apiKey,
  });
  const src = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;

  return (
    <Media
      src={src}
      alt={`Карта: ${label}`}
      preset="mapThumb"
      priority={priority}
      fallback="studio"
    />
  );
}
