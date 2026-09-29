/**
 * BANNER (B-08) — Hero-промо.
 * Баннер активен когда isActive && внутри окна (startsAt..endsAt если заданы).
 */

export function bannerLive(banner: { isActive: boolean; startsAt?: Date | null; endsAt?: Date | null }, now: Date): boolean {
  if (!banner.isActive) return false;
  if (banner.startsAt && banner.startsAt.getTime() > now.getTime()) return false;
  if (banner.endsAt && banner.endsAt.getTime() <= now.getTime()) return false;
  return true;
}
