/**
 * Единственное допустимое дублирование в проекте — enum'ы Prisma и TypeScript.
 * Этот тест делает его безопасным: расхождение схемы и домена станет красным
 * тестом, а не рантайм-ошибкой на проде при записи в БД.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  bookingStatuses,
  danceStyleFromSlug,
  danceStyleSlug,
  danceStyles,
  eventTypes,
  hasAtLeastRole,
  moderationStatuses,
  orderStatuses,
  paymentMethods,
  paymentStatuses,
  payoutStatuses,
  skillLevels,
  userRoles,
  venueAmenities,
} from './enums';
import { lineItemTypes } from '@/config/pricing';

const schema = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8');

function prismaEnumValues(name: string): string[] {
  const match = new RegExp(`enum\\s+${name}\\s*\\{([^}]*)\\}`, 'm').exec(schema);
  if (!match?.[1]) throw new Error(`enum ${name} не найден в schema.prisma`);
  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('//'));
}

const pairs: Array<[string, readonly string[]]> = [
  ['UserRole', userRoles],
  ['DanceStyle', danceStyles],
  ['SkillLevel', skillLevels],
  ['BookingStatus', bookingStatuses],
  ['PaymentStatus', paymentStatuses],
  ['PaymentMethod', paymentMethods],
  ['OrderStatus', orderStatuses],
  ['PayoutStatus', payoutStatuses],
  ['ModerationStatus', moderationStatuses],
  ['EventType', eventTypes],
  ['VenueAmenity', venueAmenities],
  ['LineItemType', lineItemTypes],
];

describe('соответствие enum-ов Prisma и домена', () => {
  for (const [prismaName, tsValues] of pairs) {
    it(`${prismaName} совпадает со списком в TypeScript`, () => {
      expect([...prismaEnumValues(prismaName)].sort()).toEqual([...tsValues].sort());
    });
  }
});

describe('слаги направлений', () => {
  it('обратимы: style → slug → style', () => {
    for (const style of danceStyles) {
      expect(danceStyleFromSlug(danceStyleSlug(style))).toBe(style);
    }
  });

  it('не содержат подчёркиваний в URL', () => {
    for (const style of danceStyles) {
      expect(danceStyleSlug(style)).not.toContain('_');
    }
  });

  it('возвращают undefined на неизвестном слаге', () => {
    expect(danceStyleFromSlug('breakdance-fusion')).toBeUndefined();
  });
});

describe('иерархия ролей', () => {
  it('администратор проходит любую проверку', () => {
    for (const role of userRoles) {
      expect(hasAtLeastRole('ADMIN', role)).toBe(true);
    }
  });

  it('клиент не проходит проверку на инструктора', () => {
    expect(hasAtLeastRole('CUSTOMER', 'INSTRUCTOR')).toBe(false);
  });

  it('инструктор и владелец площадки равноправны по уровню', () => {
    expect(hasAtLeastRole('INSTRUCTOR', 'VENUE_OWNER')).toBe(true);
    expect(hasAtLeastRole('VENUE_OWNER', 'INSTRUCTOR')).toBe(true);
  });
});
