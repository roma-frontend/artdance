/**
 * CARD TILT — наклон карточки к курсору.
 *
 * Эффект из прототипа (`.cat`, `.inst`, `.card`), где он живёт в inline-JS и
 * пишет в `transform` самой карточки. Здесь он вынесен в обёртку, и это не
 * косметика: у карточки есть свой hover-подъём с тенью, тоже через `transform`.
 * Два источника одного свойства означают, что одно состояние затирает другое —
 * карточка либо не поднимается, либо не наклоняется, в зависимости от порядка
 * событий. Обёртка отвечает за поворот, карточка — за подъём, и они складываются.
 *
 * Включается только при точном указателе: без курсора наклон не воспроизводится
 * вообще, а слушатель `pointermove` на десятке карточек стоит кадров. При
 * `prefers-reduced-motion` эффекта нет.
 *
 * Значение поворота пишется прямо в стиль узла, минуя состояние React: движение
 * мыши даёт десятки событий в секунду.
 */

'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { motion } from '@/design/motion';
import { useFinePointer } from '@/lib/hooks/use-media-query';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';
import { cn } from '@/lib/utils';

interface CardTiltProps {
  children: ReactNode;
  className?: string;
}

export function CardTilt({ children, className }: CardTiltProps) {
  const finePointer = useFinePointer();
  const reducedMotion = usePrefersReducedMotion();
  const enabled = finePointer && !reducedMotion;

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;

    const { perspectivePx, maxRotateDeg } = motion.cardTilt;
    let frame = 0;
    let rotateX = 0;
    let rotateY = 0;

    const paint = () => {
      frame = 0;
      node.style.transform = `perspective(${perspectivePx}px) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;
    };

    const onMove = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      /** Смещение курсора от центра в долях от −0.5 до 0.5. */
      const offsetX = (event.clientX - rect.left) / rect.width - 0.5;
      const offsetY = (event.clientY - rect.top) / rect.height - 0.5;

      rotateY = offsetX * maxRotateDeg;
      /** Знак обратный: курсор ниже центра наклоняет карточку от зрителя. */
      rotateX = -offsetY * maxRotateDeg;

      if (frame === 0) frame = window.requestAnimationFrame(paint);
    };

    const onLeave = () => {
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
      /** Пустая строка, а не `none`: возвращаем управление CSS-переходу. */
      node.style.transform = '';
    };

    node.addEventListener('pointermove', onMove, { passive: true });
    node.addEventListener('pointerleave', onLeave);

    return () => {
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerleave', onLeave);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [enabled]);

  return (
    <div
      ref={ref}
      data-slot="card-tilt"
      className={cn(
        'h-full transition-transform duration-normal ease-brand',
        enabled && 'will-change-transform',
        className,
      )}
    >
      {children}
    </div>
  );
}
