/**
 * SPINNER — ожидание короче секунды.
 *
 * Граница с скелетом проведена намеренно: спиннер отвечает «нажатие принято»,
 * скелет — «содержимое сейчас появится, вот его форма». Спиннер вместо скелета на
 * загрузке списка означает пустой экран с крутилкой посередине, после которого
 * вёрстка прыгает; скелет вместо спиннера на кнопке означает мерцающий
 * прямоугольник там, где ожидали реакции на щелчок.
 *
 * Не эмодзи и не картинка: `currentColor` и `em`-размеры — спиннер наследует цвет
 * и кегль места, куда его поставили, и внутри кнопки не требует настройки.
 *
 * При `prefers-reduced-motion` вращение останавливается, а сам знак остаётся:
 * убрать его целиком значит убрать единственный признак того, что что-то идёт.
 */

import { cn } from '@/lib/utils';

interface SpinnerProps {
  /** Подпись для скринридера. Без неё вращение — это ничего не сообщающая рамка. */
  label: string;
  className?: string;
  /** Только для CSS-переменных: задержка появления, длительность. */
  style?: React.CSSProperties;
}

export function Spinner({ label, className, style }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      style={style}
      className={cn('inline-flex items-center', className)}
    >
      <span
        aria-hidden
        className={cn(
          'size-[1em] shrink-0 rounded-full border-2 border-current border-t-transparent',
          'animate-spin motion-reduce:animate-none',
        )}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
