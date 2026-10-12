/** Чистые правила регистрации на соревнования, без Prisma и Next.js. */

export function ageOnDate(birthDate: Date, date: Date): number {
  let age = date.getUTCFullYear() - birthDate.getUTCFullYear();
  const month = date.getUTCMonth() - birthDate.getUTCMonth();
  if (month < 0 || (month === 0 && date.getUTCDate() < birthDate.getUTCDate())) age -= 1;
  return age;
}

export function ageFitsCategory(
  birthDate: Date,
  eventDate: Date,
  bounds: { minAge: number | null; maxAge: number | null },
): boolean {
  const age = ageOnDate(birthDate, eventDate);
  return (bounds.minAge === null || age >= bounds.minAge) && (bounds.maxAge === null || age <= bounds.maxAge);
}

export function registrationIsOpen(
  now: Date,
  window: { openAt: Date | null; closeAt: Date | null },
): boolean {
  if (window.openAt && now < window.openAt) return false;
  if (window.closeAt && now > window.closeAt) return false;
  return true;
}
