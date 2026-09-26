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

/**
 * Уход сцены, 0…1: 0 — низ панели ещё ниже середины окна, 1 — низ дошёл до
 * верхней кромки. Нужен сценам с «финалом» (шторки закрываются, прожектор
 * сужается): уход — зеркало входа, и секция не обрывается, а гаснет.
 */
export function apertureExit(bottom: number, viewport: number): number {
  const distance = viewport * 0.5;
  if (distance <= 0) return 0;
  const linear = Math.min(1, Math.max(0, (distance - bottom) / distance));
  return linear * linear * (3 - 2 * linear);
}

/** Блик на середине раскрытия: гаснет и в закрытом, и в открытом экране. */
export function apertureFlare(open: number): number {
  return Math.max(0, 1 - Math.abs(2 * open - 1));
}
