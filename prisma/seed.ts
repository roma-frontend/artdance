/**
 * Сид базы данных — контент утверждённого макета.
 *
 * После `npm run db:seed` локальное приложение показывает то же, что видел
 * клиент: тех же инструкторов, те же занятия, цены, залы, товары и события.
 * Это убирает два источника потерь времени — придумывание тестовых данных и спор
 * «в макете было иначе» на приёмке.
 *
 * ## Правила
 *
 * **Своих цифр и названий у сида нет.** Контент — из `prisma/fixtures/demo.ts`,
 * правила — из `src/config`, словари — из `src/domain`. Изменение welcome-скидки
 * или списка направлений в конфиге меняет содержимое базы само.
 *
 * **Сид идемпотентен.** Повторный запуск не создаёт дубли и не ломает связи:
 * родители обновляются по своим уникальным ключам (slug, email, sku, code), а
 * дочерние строки без естественного ключа (расписание, тарифы, опыт, отзывы)
 * пересоздаются в границах своего родителя. Это важнее, чем кажется: сид
 * запускают после каждой правки фикстур, и «уронил базу, чтобы посеять заново» —
 * это потерянные локальные данные.
 *
 * **Время считается в поясе бизнеса.** «Суббота, 18:00» — это 18:00 в Ереване, а
 * не в поясе машины, на которой запущен сид. Иначе занятия в базе сдвигаются на
 * четыре часа у любого, кто работает не из Армении.
 *
 * ## Чего сид не создаёт
 *
 * Броней, заказов и платежей. Их создаёт продукт, и подделывать их в сиде значит
 * получить историю, которая не проходила ни через один гвард и ни через одну
 * проверку конфликтов. Занятость слотов в демо берётся из `demoTakenSlots` на
 * уровне контента, а не из фиктивных `Booking`.
 *
 * Переводов сущностей (`*Translation`). У демо-контента их нет: тексты в макете
 * только на английском, и записать одну и ту же строку в три локали значило бы
 * выдать заглушку за перевод. Единственное исключение — alt-тексты изображений:
 * они переведены в фикстурах по-настоящему и попадают в
 * `MediaAssetTranslation`.
 *
 * ## Что сид удаляет
 *
 * Только одноразовых пользователей, которых создают `verify:auth` и e2e
 * (`cleanupProbeUsers`). Ничего другого сид не стирает: «уронить и посеять
 * заново» — это потерянные локальные данные, а не свежая база.
 */

import { config as loadEnv } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from 'better-auth/crypto';
import { createLocalAccountIssuer } from '@better-auth/core/db';

import { PrismaClient } from '../src/generated/prisma/client.ts';
import { booking, promotions } from '../src/config/business.ts';
import { danceStyles } from '../src/domain/enums.ts';
import { seedMedia } from '../src/design/seed-media.ts';
import { fromZonedParts, nextOccurrence } from '../src/lib/time/schedule.ts';
import { parseClock } from '../src/lib/time/clock.ts';
import {
  demoAccounts,
  demoClasses,
  demoEmailDomain,
  demoEvents,
  demoInstructorAvailability,
  demoInstructors,
  demoMediaAlt,
  demoPassword,
  demoProductCategories,
  demoProducts,
  demoReviewerEmail,
  demoReviews,
  demoVenueOwnerEmail,
  demoVenues,
  isDemoThrowawayEmail,
} from './fixtures/demo.ts';

loadEnv({ path: ['.env.local', '.env'], quiet: true });

const connectionString = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('seed — не задан DIRECT_DATABASE_URL / DATABASE_URL');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/** Сколько ближайших проведений создать у каждого занятия. */
const SESSIONS_PER_CLASS = 8;

/**
 * Имя провайдера входа по паролю и его «издатель».
 *
 * Обе строки — внутренний контракт Better Auth: по ним библиотека находит запись
 * с хешем при входе по адресу. `issuer` не равен `providerId`: у способов входа
 * без собственного издателя библиотека строит синтетический
 * (`local:credential`), и строится он её же функцией — зашивать строку значило бы
 * получить аккаунт, в который нельзя войти, при первом же изменении формата.
 */
const CREDENTIAL_PROVIDER = 'credential';
const CREDENTIAL_ISSUER = createLocalAccountIssuer(CREDENTIAL_PROVIDER);

const MS_PER_MINUTE = 60_000;
const MS_PER_WEEK = 7 * 24 * 60 * MS_PER_MINUTE;

/** Точка отсчёта: одна на весь запуск, иначе строки разъезжаются по времени. */
const now = new Date();

/* ─────────────────────── Идемпотентность ─────────────────────── */

/**
 * Минимальный контракт делегата Prisma, которого достаточно `upsertLive`.
 *
 * `args: never` — не небрежность. Методы делегатов обобщённые
 * (`<T extends VenueCreateArgs>(args: SelectSubset<T, …>)`), и аргумент вида
 * `{ data: Record<string, unknown> }` к ним не присваивается ни при каком
 * описании. Контравариантность параметров делает любую функцию присваиваемой к
 * функции с параметром `never`, поэтому проверка остаётся там, где она приносит
 * пользу — на возвращаемом значении, — а аргументы приводятся один раз внутри
 * `upsertLive`, на данных, которые он сам же и собирает.
 */
interface LiveDelegate {
  findFirst(args: never): Promise<{ id: string } | null>;
  update(args: never): Promise<{ id: string }>;
  create(args: never): Promise<{ id: string }>;
}

/**
 * Идемпотентная запись по естественному ключу — замена `delegate.upsert`.
 *
 * `prisma.*.upsert` компилируется в `INSERT … ON CONFLICT (<ключ>)`, а корзина
 * объявила уникальность слагов, SKU и кодов ЧАСТИЧНОЙ:
 * `@@unique([slug], where: raw("\"deletedAt\" IS NULL"))`. Postgres не считает
 * частичный индекс подходящей целью для `ON CONFLICT` без такого же предиката и
 * отвечает `42P10: there is no unique or exclusion constraint matching the ON
 * CONFLICT specification`. Prisma предикат не генерирует, поэтому upsert по этим
 * ключам сломан целиком — не «на Supabase», а на любом Postgres.
 *
 * Явный поиск заодно даёт правильную семантику, которой у upsert быть не могло:
 * запись, лежащую в корзине, повторный сид не оживляет — он создаёт рядом новую,
 * потому что частичный индекс это разрешает. Восстановление удалённого — решение
 * администратора, а не побочный эффект `npm run db:seed`.
 *
 * `createOnly` — поля, которые ставятся при создании и не переписываются при
 * обновлении: владелец профиля, родительский товар, тип промокода.
 */
async function upsertLive(
  delegate: LiveDelegate,
  key: Record<string, unknown>,
  data: Record<string, unknown>,
  createOnly: Record<string, unknown> = {},
): Promise<string> {
  const existing = await delegate.findFirst({
    where: { ...key, deletedAt: null },
    select: { id: true },
  } as never);

  const row = existing
    ? await delegate.update({ where: { id: existing.id }, data, select: { id: true } } as never)
    : await delegate.create({
        data: { ...data, ...key, ...createOnly },
        select: { id: true },
      } as never);

  return row.id;
}

/* ─────────────────────────── Медиа ─────────────────────────── */

/**
 * Данные `MediaAsset` из семантического имени ассета.
 *
 * Размеры, вес и blur-плейсхолдер берутся из сгенерированного манифеста
 * (`npm run media:optimize`), а не выдумываются: они должны совпадать с тем, что
 * реально лежит в `public/media/seed`, иначе вёрстка прыгает.
 *
 * `storageKey` — путь в public, а не ключ R2: в dev-окружении бакета нет, а
 * публичный URL всё равно строит приложение. С переходом на R2 меняется значение
 * этого поля, а не схема.
 */
function mediaData(assetName: string, sortOrder = 0) {
  const asset = seedMedia(assetName);
  if (!asset) throw new Error(`seed — нет сид-ассета «${assetName}»`);

  const alt = demoMediaAlt[assetName];
  if (!alt) {
    throw new Error(`seed — нет alt-текста для «${assetName}». Добавьте его в fixtures/demo.ts`);
  }

  return {
    storageKey: asset.src,
    mimeType: 'image/webp',
    bytes: asset.bytes,
    width: asset.width,
    height: asset.height,
    altText: alt.en,
    blurDataUrl: asset.blurDataUrl,
    sortOrder,
    translations: alt,
  };
}

/**
 * Привязка изображения к сущности.
 *
 * Один ассет используется несколькими сущностями (обложка направления служит и
 * занятию, и событию), а `storageKey` уникален. Поэтому ключ дополняется
 * владельцем: `/media/seed/style-salsa.webp#class:latin-fusion`. Фрагмент не
 * влияет на загрузку файла браузером и снимает конфликт без дублирования файлов.
 */
async function attachMedia(
  assetName: string,
  owner: { instructorId?: string; venueId?: string; roomId?: string; classId?: string; productId?: string; eventId?: string },
  ownerTag: string,
): Promise<void> {
  const { translations, ...data } = mediaData(assetName);
  const storageKey = `${data.storageKey}#${ownerTag}`;

  const asset = await prisma.mediaAsset.upsert({
    where: { storageKey },
    /*
     * `deletedAt: null` — единственное место, где сид возвращает запись из
     * корзины. У `MediaAsset` уникальность `storageKey` полная, а не частичная
     * (две записи на один файл означали бы, что окончательное удаление одной
     * уносит картинку у другой), поэтому создать вторую рядом нельзя. Выбор — либо
     * вернуть демо-ассет, либо оставить карточки макета без изображений.
     */
    update: { ...data, storageKey, ...owner, deletedAt: null },
    create: { ...data, storageKey, ...owner },
    select: { id: true },
  });

  /* Alt-текст переведён по-настоящему — единственный перевод в демо-данных. */
  for (const locale of ['hy', 'ru', 'en'] as const) {
    await prisma.mediaAssetTranslation.upsert({
      where: { assetId_locale: { assetId: asset.id, locale } },
      update: { altText: translations[locale] },
      create: { assetId: asset.id, locale, altText: translations[locale] },
    });
  }
}

/* ─────────────────────────── Аккаунты ─────────────────────────── */

/**
 * Пользователь по адресу.
 *
 * Пароль создаётся отдельно — в `Account`, как того требует Better Auth: у
 * аккаунта может не быть пароля вовсе (вход только через Google), и колонка в
 * `User` была бы вечно пустой и вечно подозрительной.
 */
async function upsertUser(input: {
  email: string;
  name: string;
  role: 'ADMIN' | 'SUPPORT' | 'CUSTOMER' | 'VENUE_OWNER' | 'INSTRUCTOR';
  locale: 'hy' | 'ru' | 'en';
}): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: { name: input.name, role: input.role, locale: input.locale },
    create: { ...input, emailVerified: true },
    select: { id: true },
  });
  return user.id;
}

/**
 * Пароль для входа — один на все демо-аккаунты.
 *
 * Хеш считает та же функция, что и Better Auth при регистрации
 * (`better-auth/crypto`): свой алгоритм здесь означал бы аккаунт, который
 * выглядит рабочим, но в который нельзя войти. `issuer` и `providerId` —
 * `credential`, `accountId` — id пользователя: так библиотека находит пароль при
 * входе по адресу.
 *
 * Пароль в открытом виде лежит в фикстурах осознанно: это локальная разработка, и
 * «секрет» в сиде — фикция. В production сид демо-аккаунтов не запускается.
 */
async function setDemoPassword(userId: string): Promise<void> {
  const hash = await hashPassword(demoPassword);

  await prisma.account.upsert({
    where: { issuer_accountId: { issuer: CREDENTIAL_ISSUER, accountId: userId } },
    update: { password: hash },
    create: {
      userId,
      issuer: CREDENTIAL_ISSUER,
      accountId: userId,
      providerId: CREDENTIAL_PROVIDER,
      password: hash,
    },
  });
}

async function seedAccounts(): Promise<void> {
  for (const account of demoAccounts) {
    const userId = await upsertUser(account);
    await setDemoPassword(userId);
  }
  console.log(`  аккаунты: ${demoAccounts.length} (пароль — demoPassword из фикстур)`);
}

/* ─────────────────── Уборка следов проверок ─────────────────── */

/**
 * Адрес из идентификатора одноразового токена.
 *
 * Better Auth кодирует назначение префиксом: `reset-password:kim@example.com`.
 * Берётся часть после последнего двоеточия — в адресе двоеточий быть не может.
 */
function identifierAddress(identifier: string): string {
  const separator = identifier.lastIndexOf(':');
  return separator === -1 ? identifier : identifier.slice(separator + 1);
}

/**
 * Удалить пользователей, созданных проверками, и их следы.
 *
 * `verify:auth` и e2e регистрируются на новый адрес при каждом запуске — иначе
 * проверка «регистрация создаёт аккаунт» была бы одноразовой. За неделю работы это
 * десятки мёртвых пользователей, которые засоряют выборки админки и счётчики, а
 * позже — статистику. Чистит их сид, потому что он и так запускается после каждой
 * правки данных и уже владеет этой базой.
 *
 * Удаляются три вида следов:
 *   - `User` — сессии и аккаунты уходят каскадом, записи журнала переживают
 *     удаление (`AuditLog.actorEmail` — строка, а не только FK);
 *   - `LoginAttempt` — переживает пользователя, потому что заводится и на
 *     несуществующий адрес: иначе форма входа отвечала бы по-разному;
 *   - `VerificationToken` — тоже без FK, ключ там текстовый.
 *
 * Что НЕ удаляется: демо-аккаунты сида и всё, что человек создал руками через
 * форму. Признак мусора — префикс из `demoThrowawayPrefixes`, а не «отсутствие в
 * фикстурах».
 */
async function cleanupProbeUsers(): Promise<void> {
  const suffix = `@${demoEmailDomain}`;

  const candidates = await prisma.user.findMany({
    where: { email: { endsWith: suffix } },
    select: { id: true, email: true },
  });
  const userIds = candidates.filter((user) => isDemoThrowawayEmail(user.email)).map((u) => u.id);

  const attempts = await prisma.loginAttempt.findMany({
    where: { identifier: { endsWith: suffix } },
    select: { identifier: true },
  });
  const attemptKeys = attempts
    .map((row) => row.identifier)
    .filter((identifier) => isDemoThrowawayEmail(identifier));

  const tokens = await prisma.verificationToken.findMany({
    where: { identifier: { contains: suffix } },
    select: { id: true, identifier: true },
  });
  const tokenIds = tokens
    .filter((row) => isDemoThrowawayEmail(identifierAddress(row.identifier)))
    .map((row) => row.id);

  if (userIds.length === 0 && attemptKeys.length === 0 && tokenIds.length === 0) return;

  if (userIds.length > 0) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  if (attemptKeys.length > 0) {
    await prisma.loginAttempt.deleteMany({ where: { identifier: { in: attemptKeys } } });
  }
  if (tokenIds.length > 0) {
    await prisma.verificationToken.deleteMany({ where: { id: { in: tokenIds } } });
  }

  console.log(
    `  убрано после проверок: пользователей ${userIds.length}, ` +
      `попыток входа ${attemptKeys.length}, токенов ${tokenIds.length}`,
  );
}

/* ─────────────────────────── Инструкторы ─────────────────────────── */

async function seedInstructors(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const item of demoInstructors) {
    const userId = await upsertUser({
      email: item.email,
      name: item.name,
      role: 'INSTRUCTOR',
      locale: 'en',
    });

    const data = {
      slug: item.slug,
      headline: item.headline,
      bio: item.bio,
      styles: [...item.styles],
      specializations: [...item.specializations],
      yearsExperience: item.yearsExperience,
      hourlyRateFrom: item.hourlyRateFrom,
      isVerified: item.isVerified,
      verifiedAt: item.isVerified ? now : null,
      acceptsTravel: item.acceptsTravel,
      travelRadiusKm: item.acceptsTravel ? booking.travelRadiusKm : null,
      ratingAverage: item.ratingAverage,
      ratingCount: item.ratingCount,
      studentCount: item.studentCount,
      /* Демо-профили опубликованы: иначе каталог пуст, а модерация — задача 7.5. */
      moderation: 'APPROVED' as const,
      publishedAt: now,
    };

    const profileId = await upsertLive(prisma.instructorProfile, { slug: item.slug }, data, {
      userId,
    });
    ids.set(item.slug, profileId);

    /*
     * Опыт и тарифы естественного ключа не имеют — пересоздаются в границах
     * своего профиля. Так правка фикстуры не оставляет сирот.
     */
    await prisma.instructorExperience.deleteMany({ where: { instructorId: profileId } });
    if (item.experience) {
      await prisma.instructorExperience.createMany({
        data: item.experience.map((entry, index) => ({
          instructorId: profileId,
          title: entry.title,
          organization: entry.organization ?? null,
          location: entry.location ?? null,
          startYear: entry.startYear,
          endYear: entry.endYear ?? null,
          sortOrder: index,
        })),
      });
    }

    /*
     * Тарифные опции: длительности из бизнес-правил, цена — базовая ставка,
     * пересчитанная на длительность. Ни одной цифры своей.
     */
    await prisma.priceOption.deleteMany({ where: { instructorId: profileId } });
    await prisma.priceOption.createMany({
      data: booking.durationsMinutes.map((duration) => ({
        instructorId: profileId,
        label: `${duration}`,
        durationMinutes: duration,
        price: Math.round((item.hourlyRateFrom * duration) / 60),
        maxParticipants: 1,
      })),
    });

    await attachMedia(item.asset, { instructorId: profileId }, `instructor:${item.slug}`);
  }

  console.log(`  инструкторы: ${ids.size}`);
  return ids;
}

/* ─────────────────────────── Площадки ─────────────────────────── */

async function seedVenues(): Promise<{
  venueIds: Map<string, string>;
  roomIds: Map<string, string>;
}> {
  const venueIds = new Map<string, string>();
  const roomIds = new Map<string, string>();

  for (const item of demoVenues) {
    const data = {
      name: item.name,
      description: item.description,
      district: item.district,
      /*
       * Адрес в макете не указан — только район. Пустая строка честнее
       * выдуманной улицы: карточка площадки покажет район, а адрес появится с
       * реальными данными заказчика.
       */
      addressLine: '',
      latitude: item.latitude,
      longitude: item.longitude,
      amenities: [...item.amenities],
      ratingAverage: item.ratingAverage,
      ratingCount: item.ratingCount,
      moderation: 'APPROVED' as const,
      publishedAt: now,
    };

    const venueId = await upsertLive(prisma.venue, { slug: item.slug }, data);
    venueIds.set(item.slug, venueId);

    /* Владелец площадки: без него не открыть кабинет площадки (задача 6.3). */
    const ownerId = await upsertUser({
      email: demoVenueOwnerEmail(item.slug),
      name: `${item.name} Owner`,
      role: 'VENUE_OWNER',
      locale: 'en',
    });
    await prisma.venueMember.upsert({
      where: { venueId_userId: { venueId, userId: ownerId } },
      update: { isOwner: true },
      create: { venueId, userId: ownerId, isOwner: true },
    });

    /*
     * Зал один на площадку: в данных макета одна площадь и одна вместимость.
     * Несколько залов появятся с реальными данными — тогда `Room` перестанет
     * повторять площадку.
     */
    const roomData = {
      name: item.name,
      areaSqm: item.areaSqm,
      capacity: item.capacity,
      amenities: [...item.amenities],
      pricePerHour: item.pricePerHour,
    };
    const existingRoom = await prisma.room.findFirst({
      where: { venueId, deletedAt: null },
      select: { id: true },
    });
    const room = existingRoom
      ? await prisma.room.update({ where: { id: existingRoom.id }, data: roomData, select: { id: true } })
      : await prisma.room.create({ data: { ...roomData, venueId }, select: { id: true } });
    roomIds.set(item.slug, room.id);

    await attachMedia(item.asset, { venueId }, `venue:${item.slug}`);
  }

  console.log(`  площадки: ${venueIds.size} (по залу на каждую)`);
  return { venueIds, roomIds };
}

/* ─────────────────────── Расписание инструкторов ─────────────────────── */

async function seedAvailability(instructorIds: Map<string, string>): Promise<void> {
  let rules = 0;

  for (const [slug, windows] of Object.entries(demoInstructorAvailability)) {
    const instructorId = instructorIds.get(slug);
    if (!instructorId) continue;

    /* Правила без естественного ключа: пересоздаются целиком у своего профиля. */
    await prisma.availabilityRule.deleteMany({ where: { instructorId } });
    await prisma.availabilityRule.createMany({
      data: windows.map((window) => ({
        instructorId,
        weekday: window.weekday,
        startTime: window.startTime,
        endTime: window.endTime,
      })),
    });
    rules += windows.length;
  }

  console.log(`  окна расписания: ${rules}`);
}

/* ─────────────────────────── Занятия ─────────────────────────── */

async function seedClasses(
  instructorIds: Map<string, string>,
  venueIds: Map<string, string>,
  roomIds: Map<string, string>,
): Promise<void> {
  let sessions = 0;

  for (const item of demoClasses) {
    const instructorId = instructorIds.get(item.instructorSlug);
    if (!instructorId) throw new Error(`seed — занятие ${item.slug} ссылается на неизвестного инструктора`);

    const venueId = venueIds.get(item.venueSlug) ?? null;
    const roomId = roomIds.get(item.venueSlug) ?? null;

    const data = {
      instructorId,
      venueId,
      title: item.title,
      description: item.description,
      style: item.style,
      level: item.level,
      durationMinutes: item.durationMinutes,
      price: item.price,
      capacity: item.capacity,
      learningPoints: [...item.learningPoints],
      isTrending: item.isTrending,
    };

    const classId = await upsertLive(prisma.danceClass, { slug: item.slug }, data);

    /*
     * Проведения: ближайшие `SESSIONS_PER_CLASS` от текущего момента. Время
     * считается в поясе бизнеса через `nextOccurrence` — тот же код, что отвечает
     * на «когда следующее занятие» в каталоге, поэтому расписание в базе и на
     * экране не могут разойтись.
     *
     * Заполненность из макета применяется только к первому проведению: «мест нет»
     * относится к ближайшему занятию, а не ко всем на два месяца вперёд.
     */
    const first = nextOccurrence(item.weekday, item.startTime, now);

    for (let index = 0; index < SESSIONS_PER_CLASS; index += 1) {
      const startsAt = new Date(first.getTime() + index * MS_PER_WEEK);
      const endsAt = new Date(startsAt.getTime() + item.durationMinutes * MS_PER_MINUTE);
      const bookedCount = index === 0 ? Math.max(0, item.capacity - item.spotsLeft) : 0;

      await upsertLive(
        prisma.classSession,
        { classId, startsAt },
        { endsAt, capacity: item.capacity, bookedCount, roomId },
      );
      sessions += 1;
    }

    await attachMedia(item.coverAsset ?? item.asset, { classId }, `class:${item.slug}`);
  }

  console.log(`  занятия: ${demoClasses.length}, проведений: ${sessions}`);
}

/* ─────────────────────────── Товары ─────────────────────────── */

async function seedProducts(): Promise<void> {
  const categoryIds = new Map<string, string>();

  for (const category of demoProductCategories) {
    const id = await upsertLive(
      prisma.productCategory,
      { slug: category.slug },
      { name: category.name, sortOrder: category.order },
    );
    categoryIds.set(category.slug, id);
  }

  let variants = 0;

  for (const item of demoProducts) {
    const categoryId = categoryIds.get(item.category);
    if (!categoryId) throw new Error(`seed — товар ${item.slug} ссылается на категорию ${item.category}`);

    const data = {
      categoryId,
      brand: item.brand,
      title: item.title,
      description: item.description,
      basePrice: item.price,
    };

    const productId = await upsertLive(prisma.product, { slug: item.slug }, data);

    /* Варианты обновляются по SKU, а не пересоздаются: на них ссылаются корзины. */
    for (const variant of item.variants) {
      await upsertLive(
        prisma.productVariant,
        { sku: variant.sku },
        {
          size: variant.size ?? null,
          color: variant.color ?? null,
          price: variant.price,
          stock: variant.stock,
        },
        { productId },
      );
      variants += 1;
    }

    await attachMedia(item.asset, { productId }, `product:${item.slug}`);
  }

  console.log(`  товары: ${demoProducts.length}, вариантов: ${variants}`);
}

/* ─────────────────────────── События ─────────────────────────── */

/**
 * Дата события из `MM-DD`: год подставляется от текущего момента, а прошедшая
 * дата переносится на следующий год. Иначе к следующему сентябрю сид посеет
 * афишу, которая уже закончилась, и раздел событий окажется пустым.
 */
function eventInstant(monthDay: string, time: string, from: Date): Date {
  const [month, day] = monthDay.split('-').map(Number);
  if (!month || !day) throw new Error(`seed — некорректная дата события «${monthDay}»`);

  const minutesOfDay = parseClock(time);
  const thisYear = fromZonedParts({ year: from.getFullYear(), month, day, minutesOfDay });

  return thisYear.getTime() >= from.getTime()
    ? thisYear
    : fromZonedParts({ year: from.getFullYear() + 1, month, day, minutesOfDay });
}

async function seedEvents(venueIds: Map<string, string>): Promise<void> {
  for (const item of demoEvents) {
    const startsAt = eventInstant(item.monthDay, item.startTime, now);
    const endsAt = eventInstant(item.monthDay, item.endTime, now);

    const data = {
      type: item.type,
      title: item.title,
      description: item.description,
      venueId: item.venueSlug ? venueIds.get(item.venueSlug) ?? null : null,
      locationName: item.locationName ?? null,
      startsAt,
      endsAt,
      price: item.price,
      capacity: item.capacity,
      bookedCount: Math.max(0, item.capacity - item.spotsLeft),
      isPublished: true,
    };

    const eventId = await upsertLive(prisma.event, { slug: item.slug }, data);

    await attachMedia(item.asset, { eventId }, `event:${item.slug}`);
  }

  console.log(`  события: ${demoEvents.length}`);
}

/* ─────────────────────────── Отзывы ─────────────────────────── */

async function seedReviews(
  instructorIds: Map<string, string>,
  classSlugToId: Map<string, string>,
): Promise<void> {
  for (const item of demoReviews) {
    const authorId = await upsertUser({
      email: demoReviewerEmail(item.authorName),
      name: item.authorName,
      role: 'CUSTOMER',
      locale: 'en',
    });

    const target =
      item.targetType === 'instructor'
        ? { instructorId: instructorIds.get(item.targetSlug) ?? null }
        : { classId: classSlugToId.get(item.targetSlug) ?? null };

    /*
     * Отзыв не привязан к брони: броней сид не создаёт. Поэтому естественного
     * ключа нет (`@@unique([authorId, bookingId])` с `null` не работает как
     * ограничение), и отзыв пересоздаётся по автору.
     */
    await prisma.review.deleteMany({ where: { authorId } });
    await prisma.review.create({
      data: {
        authorId,
        ...target,
        rating: item.rating,
        body: item.body,
        authorRole: item.authorRole,
        /*
         * `isVerifiedPurchase: false` — честно: покупки за этим отзывом нет.
         * Проставить `true` значило бы сломать смысл значка ещё до первой брони.
         */
        isVerifiedPurchase: false,
        moderation: 'APPROVED',
        moderatedAt: now,
      },
    });
  }

  console.log(`  отзывы: ${demoReviews.length}`);
}

/* ─────────────────────────── Промокоды ─────────────────────────── */

async function seedPromoCodes(): Promise<void> {
  const { code, percentOff } = promotions.welcomeCode;
  await upsertLive(
    prisma.promoCode,
    { code },
    { value: percentOff },
    { type: 'PERCENT', perUserLimit: 1, isActive: true },
  );
  console.log(`  промокод ${code} (-${percentOff}%)`);
}

/* ─────────────────────────── Запуск ─────────────────────────── */

async function main(): Promise<void> {
  console.log('seed — начало');
  console.log(`  направлений в домене: ${danceStyles.length}`);

  await cleanupProbeUsers();
  await seedAccounts();
  const instructorIds = await seedInstructors();
  const { venueIds, roomIds } = await seedVenues();
  await seedAvailability(instructorIds);
  await seedClasses(instructorIds, venueIds, roomIds);

  const classRows = await prisma.danceClass.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true },
  });
  const classSlugToId = new Map(classRows.map((row) => [row.slug, row.id]));

  await seedProducts();
  await seedEvents(venueIds);
  await seedReviews(instructorIds, classSlugToId);
  await seedPromoCodes();

  console.log('seed — готово');
}

/*
 * Верхнеуровневый await здесь недоступен: tsx собирает файл как CJS. Обычный
 * промис с `finally` делает то же самое и корректно закрывает пул соединений —
 * без него процесс висит после успешного сида.
 */
main()
  .catch((error: unknown) => {
    console.error('seed — ошибка:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
