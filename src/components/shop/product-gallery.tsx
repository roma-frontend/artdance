/**
 * PRODUCT GALLERY — галерея товара.
 *
 * Первая картинка — приоритетная (LCP), ховер-кадр — второй.
 */

import { Media } from '@/components/ui/media';
import { resolveMedia, type MediaRef } from '@/domain/content';
import type { Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

interface ProductGalleryProps {
  gallery: readonly MediaRef[];
  locale: Locale;
  className?: string;
}

export function ProductGallery({ gallery, locale, className }: ProductGalleryProps) {
  if (gallery.length === 0) {
    return (
      <div className={cn('aspect-square rounded-lg bg-surface-muted', className)} aria-hidden />
    );
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="overflow-hidden rounded-lg border border-border-default bg-surface-card">
        <Media {...resolveMedia(gallery[0]!, locale)} preset="productCard" fallback="product" />
      </div>
      {gallery.length > 1 && (
        <ul className="grid grid-cols-4 gap-2">
          {gallery.slice(1).map((ref, i) => (
            <li key={i} className="overflow-hidden rounded-md border border-border-default">
              <Media {...resolveMedia(ref, locale)} preset="thumbnail" fallback="product" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
