'use client';

import { cn } from '@/lib/utils';

/**
 * QR CODE — презентационный слой пропуска.
 * Генерация SVG — на сервере (qr/render.ts), здесь только оболочка и статусы.
 */

export function QrSvg({ svg, size = 192, className }: { svg: string; size?: number; className?: string }) {
  return (
    <div
      className={cn('overflow-hidden rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/5', className)}
      style={{ width: size, height: size }}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export type QrStatus = 'ok' | 'used' | 'expired' | 'invalid' | 'forbidden';

export function statusBadgeClass(status: QrStatus): string {
  switch (status) {
    case 'ok':
      return 'bg-success-soft text-content-success';
    case 'used':
      return 'bg-metal-soft text-content-metal';
    case 'expired':
      return 'bg-warning-soft text-content-warning';
    case 'invalid':
    case 'forbidden':
      return 'bg-danger-soft text-content-danger';
    default:
      return 'bg-surface-sunken text-content-secondary';
  }
}
