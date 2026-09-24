export const animationConfig = {
  duration: { fast: 0.2, normal: 0.4, slow: 0.6 },
  easing: {
    smooth: [0.6, 0.05, 0.01, 0.9],
    bounce: [0.68, -0.55, 0.265, 1.55],
  },
  parallax: { foreground: 1.2, midground: 0.8, background: 0.4 },
  /**
   * Вращение печати от прокрутки (ScrollSeal): не полуоборота на экран, а
   * ленивый дрейф, читаемый только боковым зрением. Взад-наперёд при обратной
   * прокрутке крутится обратно — это свойство скролл-драйвена, а не таймера.
   */
  sealRotation: { maxDegrees: 45 },
} as const;

export function layerOffset(progress: number, layer: keyof typeof animationConfig.parallax): number {
  return -Math.min(1, Math.max(0, progress)) * 40 * animationConfig.parallax[layer];
}
