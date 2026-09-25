import { heroDepth } from '@/design/motion';

export const animationConfig = {
  duration: { fast: 0.2, normal: 0.4, slow: 0.6 },
  easing: {
    smooth: [0.6, 0.05, 0.01, 0.9],
    bounce: [0.68, -0.55, 0.265, 1.55],
  },
  /**
   * Вращение печати от прокрутки (ScrollSeal): не полуоборота на экран, а
   * ленивый дрейф, читаемый только боковым зрением. Взад-наперёд при обратной
   * прокрутке крутится обратно — это свойство скролл-драйвена, а не таймера.
   */
  sealRotation: { maxDegrees: 45 },
} as const;

export interface HeroDepthFrame {
  /** Сдвиги слоёв по вертикали, px. */
  background: number;
  word: number;
  content: number;
  foreground: number;
  /** Масштаб кадра. */
  zoom: number;
  /** Прозрачность текстовой колонки. */
  contentOpacity: number;
}

/**
 * Положение слоёв первого экрана при прокрутке.
 *
 * `progress` — доля ухода hero из окна (0 — стоит целиком, 1 — ушёл за верх),
 * `height` — высота hero, `factor` — ослабление на узком экране. Ход каждого
 * слоя — доля высоты из `heroDepth.scroll`: так глубина одинаково читается и на
 * ноутбуке, и на 4K, а не зависит от пикселей.
 */
export function heroDepthFrame(progress: number, height: number, factor = 1): HeroDepthFrame {
  const p = Math.min(1, Math.max(0, progress));
  const travel = p * height * factor;
  const { scroll, backgroundZoom, contentFade } = heroDepth;
  return {
    background: travel * scroll.background,
    word: travel * scroll.word,
    content: travel * scroll.content,
    foreground: travel * scroll.foreground,
    zoom: backgroundZoom.from + (backgroundZoom.to - backgroundZoom.from) * p * factor,
    contentOpacity: 1 - p * contentFade,
  };
}
