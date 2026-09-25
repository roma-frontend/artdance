import { describe, expect, it } from 'vitest';

import { cursorOffset, lerp } from './cursor-tracking';
import { animationConfig, heroDepthFrame } from './parallax';
import { revealTransition, splitWords } from './scroll-reveal';

describe('Параметры анимации', () => {
  it('сохраняет длительности и ход печати', () => {
    expect(animationConfig.duration).toEqual({ fast: 0.2, normal: 0.4, slow: 0.6 });
    expect(animationConfig.sealRotation.maxDegrees).toBe(45);
  });

  it('раскладывает слои hero по глубине: дальние отстают, ближние обгоняют', () => {
    const rest = heroDepthFrame(0, 800);
    expect([rest.background, rest.word, rest.content, rest.foreground].every((v) => Math.abs(v) === 0)).toBe(true);
    expect(rest.contentOpacity).toBe(1);

    const gone = heroDepthFrame(1, 800);
    expect(gone.background).toBeGreaterThan(gone.word);
    expect(gone.word).toBeGreaterThan(gone.content);
    expect(gone.content).toBeGreaterThan(0);
    expect(gone.foreground).toBeLessThan(0);
    expect(gone.zoom).toBeGreaterThan(rest.zoom);
    expect(gone.contentOpacity).toBeLessThan(0.5);

    // На узком экране ход вдвое меньше, но порядок планов тот же.
    const narrow = heroDepthFrame(1, 800, 0.5);
    expect(narrow.background).toBeCloseTo(gone.background / 2);
    expect(heroDepthFrame(2, 800)).toEqual(gone);
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
