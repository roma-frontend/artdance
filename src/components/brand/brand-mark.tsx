/**
 * BRAND MARK — знак бренда: фигура танцовщицы в прыжке.
 *
 * Inline SVG, а не файл через `Media`: знак нужен в шапке при первой отрисовке
 * (это часть LCP-кадра), он меньше килобайта, и лишний сетевой запрос ради него
 * не оправдан. Цвет — `currentColor`, поэтому знак наследует цвет текста
 * родителя и работает и на светлой шапке, и над тёмным hero без второй копии.
 *
 * Знак декоративен: рядом с ним всегда стоит словесная марка «ArtDance»,
 * поэтому у него `aria-hidden` — иначе скринридер прочитает бренд дважды.
 *
 * Геометрия взята из прототипа без изменений.
 */

import { cn } from '@/lib/utils';

interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      focusable="false"
      className={cn('size-8 shrink-0', className)}
    >
      <circle cx="16" cy="6" r="3.2" fill="currentColor" />
      <path
        d="M16 10.5C16 10.5 9 13.8 7.5 21C6 28 11.5 29.5 14.5 28C17.5 26.5 16 22.5 16 22.5C16 22.5 14.5 26.5 17.5 28C20.5 29.5 26 28 24.5 21C23 13.8 16 10.5 16 10.5Z"
        fill="currentColor"
      />
      <path
        d="M11 15.5C11 15.5 8 12.5 5 14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M21 15.5C21 15.5 24 12.5 27 14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
