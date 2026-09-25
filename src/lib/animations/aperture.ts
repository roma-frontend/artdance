/**
 * Раскрытие «киноэкрана», 0…1: 0 — верх панели только коснулся нижней кромки
 * окна, 1 — поднялся на `span` высоты окна. Ход сглажен (smoothstep): экран
 * трогается мягко и мягко же доезжает до кромок, без щелчка в конце.
 */
export function apertureOpen(top: number, viewport: number, span: number): number {
  const distance = viewport * span;
  if (distance <= 0) return 1;
  const linear = Math.min(1, Math.max(0, (viewport - top) / distance));
  return linear * linear * (3 - 2 * linear);
}

/** Блик на середине раскрытия: гаснет и в закрытом, и в открытом экране. */
export function apertureFlare(open: number): number {
  return Math.max(0, 1 - Math.abs(2 * open - 1));
}
