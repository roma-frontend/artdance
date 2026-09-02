import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

import {
  durationClassNames,
  textStyleClassNames,
  zIndexClassNames,
} from '@/design/tokens/class-names.generated';

/**
 * tailwind-merge, знающий наши классы.
 *
 * Почему это обязательно, а не улучшение: tailwind-merge разрешает конфликты по
 * ФОРМЕ имени класса. Наши семантические стили типографики выглядят как цвет
 * текста, поэтому в паре `cn('text-card-title', 'text-content-primary')` первый
 * класс молча выбрасывался — заголовок терял гарнитуру, кегль и трекинг, и
 * заметить это можно было только сравнив вёрстку с макетом пиксель в пиксель.
 *
 * Здесь три группы объявлены явно:
 *   • `font-size`  — `text-heading-2`, `text-eyebrow`… конфликтуют друг с другом
 *                    и с `text-lg`, но не с цветом;
 *   • `duration`   — `duration-slow` вытесняет `duration-300`, а не сосуществует
 *                    с ним, оставляя исход на порядок правил в CSS;
 *   • `z`          — то же для слоёв из карты z-index.
 *
 * Список имён генерируется из токенов (`class-names.generated.ts`): добавленный
 * стиль типографики попадает сюда сам, а не после того, как кто-то заметит
 * пропажу.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [...textStyleClassNames],
      duration: [...durationClassNames],
      z: [...zIndexClassNames],
    },
  },
});

/** Слияние классов Tailwind с корректным разрешением конфликтов. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
