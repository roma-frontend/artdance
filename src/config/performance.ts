/**
 * Перф-бюджет и цели Lighthouse — единый источник.
 *
 * Используется:
 *  - scripts/check-performance-budget.ts (размеры чанков/ассетов)
 *  - будущим CI шагом с Lighthouse CI / @lhci
 */

export const perfBudget = {
  /** Цели Lighthouse — зафиксированы, а не «сойдёт». */
  lighthouse: {
    lcpMs: 2000,
    inpMs: 150,
    cls: 0.05,
    performanceScore: 90,
  },
  /** JS бюджеты (gzip) — должны совпадать с BUDGET в check-performance-budget.ts */
  js: {
    initialChunkGzip: 90 * 1024,
    initialTotalGzip: 260 * 1024,
    lazyChunkGzip: 250 * 1024,
  },
  /** Лимиты доменов/шрифтов */
  assets: {
    fontDisplay: 'swap' as const,
    maxExternalDomains: 4,
  },
} as const;
