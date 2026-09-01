/**
 * Сид базы данных.
 *
 * Принцип тот же, что и во всём проекте: сид не содержит собственных цифр и
 * названий — он читает `src/config` и `src/domain`. Поэтому изменение
 * welcome-скидки или списка направлений в конфиге автоматически меняет
 * содержимое сида, и dev-окружение не расходится с бизнес-правилами.
 */

import { config as loadEnv } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client.ts';
import { promotions } from '../src/config/business.ts';
import { danceStyles } from '../src/domain/enums.ts';

loadEnv({ path: ['.env.local', '.env'], quiet: true });

const connectionString = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('seed — не задан DIRECT_DATABASE_URL / DATABASE_URL');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function seedPromoCodes(): Promise<void> {
  const { code, percentOff } = promotions.welcomeCode;
  await prisma.promoCode.upsert({
    where: { code },
    update: { value: percentOff },
    create: {
      code,
      type: 'PERCENT',
      value: percentOff,
      perUserLimit: 1,
      isActive: true,
    },
  });
  console.log(`  promoCode ${code} (-${percentOff}%)`);
}

async function main(): Promise<void> {
  console.log('seed — начало');
  console.log(`  направлений в домене: ${danceStyles.length}`);
  console.log(`  номиналы подарочных карт: ${promotions.giftCard.presetAmounts.join(', ')}`);
  await seedPromoCodes();
  console.log('seed — готово');
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
