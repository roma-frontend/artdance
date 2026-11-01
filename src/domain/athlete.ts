/**
 * ПРОФИЛЬ АТЛЕТА (DS-04) — то, что атлет может заполнить сам: программы, клуб и разряд.
 *
 * WDSF-номер и дата рождения сюда не входят: их подтверждает не сам атлет, а регистрация
 * на соревнование и администратор. Программы — только из справочника DanceSport.
 */

import { z } from 'zod';

import { danceSportPrograms } from '@/domain/enums';

export const athleteProfileSchema = z.object({
  programs: z.array(z.enum(danceSportPrograms)).max(danceSportPrograms.length),
  clubName: z.string().trim().max(120).nullable().optional(),
  rank: z.string().trim().max(60).nullable().optional(),
});

export type AthleteProfileInput = z.infer<typeof athleteProfileSchema>;
