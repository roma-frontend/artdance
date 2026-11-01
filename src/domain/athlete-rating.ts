/**
 * РЕЙТИНГ И ДОСТИЖЕНИЯ АТЛЕТА (DS-04).
 *
 * Рейтинг — сумма баллов за места в соревнованиях за окно `ratingWindowMonths` месяцев
 * до текущего момента. Старые результаты не обнуляют рейтинг мгновенно, а уходят из него
 * по мере истечения окна. Баллы — рекомендация, владелец может их пересмотреть: они
 * задаются одной таблицей, а не разбросаны по коду.
 */

export const competitionPlaces = ['GOLD', 'SILVER', 'BRONZE', 'FINALIST', 'PARTICIPANT'] as const;
export type CompetitionPlace = (typeof competitionPlaces)[number];

/** Баллы за место. Участие засчитывается, но дешевле финала. */
export const placePoints: Record<CompetitionPlace, number> = {
  GOLD: 10,
  SILVER: 7,
  BRONZE: 5,
  FINALIST: 3,
  PARTICIPANT: 1,
};

/** Окно, в котором результат входит в рейтинг. */
export const ratingWindowMonths = 24;

export interface AthleteResultRow {
  place: CompetitionPlace;
  eventStartsAt: Date;
}

/** Начало окна рейтинга: `now` минус `ratingWindowMonths` месяцев (календарно). */
export function ratingWindowStart(now: Date): Date {
  const start = new Date(now.getTime());
  start.setUTCMonth(start.getUTCMonth() - ratingWindowMonths);
  return start;
}

/** Рейтинг: сумма баллов за результаты, чьё соревнование попало в окно. */
export function athleteRating(results: readonly AthleteResultRow[], now: Date): number {
  const from = ratingWindowStart(now).getTime();
  const to = now.getTime();
  return results.reduce((sum, row) => {
    const at = row.eventStartsAt.getTime();
    if (at < from || at > to) return sum;
    return sum + placePoints[row.place];
  }, 0);
}
