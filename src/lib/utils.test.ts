/**
 * Тесты `cn()` — не «на всякий случай», а фиксация конкретной поломки.
 *
 * До настройки tailwind-merge пара «семантический стиль типографики + цвет»
 * теряла стиль: `cn('text-card-title', 'text-content-primary')` возвращал
 * только цвет. Ошибка не падала, не логировалась и не ловилась типами — она
 * просто делала заголовки не такими, как в макете.
 *
 * Здесь же проверяется обратное свойство: классы ОДНОЙ группы обязаны
 * вытеснять друг друга, иначе исход зависит от порядка правил в собранном CSS.
 */

import { describe, expect, it } from 'vitest';

import { textStyles, tokens } from '@/design/tokens';
import {
  durationClassNames,
  textStyleClassNames,
  zIndexClassNames,
} from '@/design/tokens/class-names.generated';
import { cn } from './utils';

describe('cn — семантическая типографика и цвет', () => {
  it('сохраняет стиль типографики рядом с цветом текста', () => {
    expect(cn('text-card-title', 'text-content-primary')).toBe(
      'text-card-title text-content-primary',
    );
  });

  it('сохраняет стиль типографики, если цвет объявлен раньше', () => {
    expect(cn('text-metal', 'text-eyebrow')).toBe('text-metal text-eyebrow');
  });

  it('оставляет последний стиль типографики из двух', () => {
    expect(cn('text-body', 'text-heading-2')).toBe('text-heading-2');
  });

  it('стиль типографики вытесняет кегль из шкалы Tailwind', () => {
    expect(cn('text-lg', 'text-eyebrow')).toBe('text-eyebrow');
  });

  it('оставляет последний цвет из двух', () => {
    expect(cn('text-content-primary', 'text-accent')).toBe('text-accent');
  });
});

describe('cn — длительности и слои', () => {
  it('длительность из шкалы вытесняет числовую', () => {
    expect(cn('duration-300', 'duration-slow')).toBe('duration-slow');
  });

  it('числовая длительность вытесняет шкальную', () => {
    expect(cn('duration-slow', 'duration-300')).toBe('duration-300');
  });

  it('слой из карты вытесняет числовой z-index', () => {
    expect(cn('z-50', 'z-drawer')).toBe('z-drawer');
  });

  it('не путает длительность перехода с задержкой', () => {
    expect(cn('duration-slow', 'delay-150')).toBe('duration-slow delay-150');
  });
});

describe('сгенерированные списки имён классов', () => {
  it('покрывают все семантические стили типографики', () => {
    expect([...textStyleClassNames].sort()).toEqual(
      Object.keys(textStyles)
        .map((name) => `text-${name}`)
        .sort(),
    );
  });

  it('покрывают всю шкалу длительностей', () => {
    expect(durationClassNames).toHaveLength(Object.keys(tokens.duration).length);
  });

  it('покрывают всю карту слоёв', () => {
    expect(zIndexClassNames).toHaveLength(Object.keys(tokens.zIndex).length);
  });
});
