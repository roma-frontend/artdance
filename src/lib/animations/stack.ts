/**
 * Насколько карточка стопки накрыта следующей, 0…1.
 *
 * 0 — следующая карточка только коснулась нижней кромки, 1 — она прилипла на
 * своём месте, на `stepPx` ниже текущей. Высота берётся без учёта `scale`
 * (`offsetHeight`), а верх карточки от уменьшения не сдвигается —
 * `transform-origin` у стопки верхний, поэтому замер не зависит от того, что он
 * сам же и рисует.
 */
export function stackCover(currentTop: number, currentHeight: number, nextTop: number, stepPx = 0): number {
  const span = currentHeight - stepPx;
  if (span <= 0) return 0;
  const covered = (currentHeight - (nextTop - currentTop)) / span;
  return Math.min(1, Math.max(0, covered));
}

/**
 * Пишет `--stack-cover` каждому элементу по положению следующего. Последний
 * элемент не накрыт никем и всегда стоит в полную величину.
 */
export function paintStackCover(items: readonly HTMLElement[], stepPx = 0): void {
  items.forEach((item, index) => {
    const next = items[index + 1];
    const cover = next
      ? stackCover(item.getBoundingClientRect().top, item.offsetHeight, next.getBoundingClientRect().top, stepPx)
      : 0;
    item.style.setProperty('--stack-cover', cover.toFixed(3));
  });
}
