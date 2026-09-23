export function cursorOffset(position: number, start: number, size: number): number {
  return size > 0 ? Math.max(-0.5, Math.min(0.5, (position - start) / size - 0.5)) : 0;
}

export function lerp(current: number, target: number, elapsed = 1000 / 60): number {
  const next = current + (target - current) * (1 - Math.pow(0.88, Math.min(64, Math.max(0, elapsed)) / (1000 / 60)));
  return Math.abs(target - next) < 0.001 ? target : next;
}
