import { describe, expect, it } from 'vitest';

import { cursorOffset, lerp } from './cursor-tracking';
import { animationConfig, layerOffset } from './parallax';
import { revealTransition, splitWords } from './scroll-reveal';

describe('Параметры анимации', () => {
  it('сохраняет заданные скорости слоёв и ход печати', () => {
    expect(animationConfig.duration).toEqual({ fast: 0.2, normal: 0.4, slow: 0.6 });
    expect(layerOffset(1, 'foreground')).toBe(-48);
    expect(layerOffset(1, 'midground')).toBe(-32);
    expect(layerOffset(1, 'background')).toBe(-16);
    expect(animationConfig.sealRotation.maxDegrees).toBe(45);
  });

  it('не меняет текст и ограничивает задержку длинных заголовков', () => {
    const text = 'Танец  для всех\nՀայաստան';
    expect(splitWords(text).join('')).toBe(text);
    expect(revealTransition(100).delay).toBe(revealTransition(7).delay);
    expect(revealTransition(-1).delay).toBe(0);
  });

  it('ограничивает курсор и безопасно обрабатывает нулевые размеры', () => {
    expect(cursorOffset(50, 0, 100)).toBe(0);
    expect(cursorOffset(500, 0, 100)).toBe(0.5);
    expect(cursorOffset(-50, 0, 100)).toBe(-0.5);
    expect(cursorOffset(50, 0, 0)).toBe(0);
  });

  it('lerp сходится точно и не зависит от частоты кадров', () => {
    expect(lerp(0, 1, 1000 / 60)).toBeCloseTo(0.12);
    expect(lerp(lerp(0, 1, 1000 / 120), 1, 1000 / 120)).toBeCloseTo(0.12);
    let value = 0;
    for (let i = 0; i < 100; i++) value = lerp(value, 0.5);
    expect(value).toBe(0.5);
  });
});
