import 'server-only';

/**
 * ПРОФИЛЬ АТЛЕТА (DS-04) — чтение кабинета и запись того, что заполняет атлет.
 *
 * Профиль создаёт регистрация на соревнование (`server/events/register.ts`), поэтому
 * без регистрации профиля нет: кабинет тогда пуст, а не создаётся вручную. Личность
 * передаёт вызывающий код из сессии.
 */

import { domainErrors } from '@/domain/errors';
import { type AthleteProfileInput } from '@/domain/athlete';
import { db } from '@/lib/db';

/** Кабинет атлета: программы, клуб, разряд и его регистрации; `null`, если профиля нет. */
export async function athleteCabinetFor(userId: string) {
  const profile = await db.athleteProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      wdsfId: true,
      programs: true,
      clubName: true,
      rank: true,
      competitionRegistrations: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          status: true,
          partnerName: true,
          event: { select: { title: true, slug: true, startsAt: true } },
          category: { select: { name: true } },
        },
      },
    },
  });
  if (!profile) return null;
  const { competitionRegistrations, ...fields } = profile;
  return { ...fields, registrations: competitionRegistrations };
}

/** Сохраняет программы, клуб и разряд. Пустые строки становятся `null`. */
export async function updateAthleteProfile(userId: string, input: AthleteProfileInput) {
  const profile = await db.athleteProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw domainErrors.notFound();

  return db.athleteProfile.update({
    where: { id: profile.id },
    data: {
      programs: [...new Set(input.programs)],
      clubName: input.clubName?.trim() || null,
      rank: input.rank?.trim() || null,
    },
    select: { programs: true, clubName: true, rank: true },
  });
}
