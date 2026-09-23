export const animationConfig = {
  duration: { fast: 0.2, normal: 0.4, slow: 0.6 },
  easing: {
    smooth: [0.6, 0.05, 0.01, 0.9],
    bounce: [0.68, -0.55, 0.265, 1.55],
  },
  parallax: { foreground: 1.2, midground: 0.8, background: 0.4 },
} as const;

export function scrollRotation(progress: number): number {
  return 5 - Math.min(1, Math.max(0, progress)) * 10;
}

export function layerOffset(progress: number, layer: keyof typeof animationConfig.parallax): number {
  return -Math.min(1, Math.max(0, progress)) * 40 * animationConfig.parallax[layer];
}
