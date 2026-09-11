import 'server-only';

/**
 * РЕЕСТР РЕСУРСОВ АДМИНКИ — единственное место, где админка пишет в БД.
 *
 * Разделение обязанностей, которое здесь зафиксировано:
 *
 *  • ЧТЕНИЕ СПИСКА — по ресурсу отдельным запросом с явным `select`. Обобщать
 *    его нельзя: в списке занятий нужно имя инструктора, в списке залов —
 *    название площадки, в списке товаров — остаток по вариантам. Это разные
 *    соединения, и попытка описать их данными кончается конструктором запросов
 *    внутри приложения.
 *  • ЗАПИСЬ — общая. Поле формы уже проверено схемой (`buildResourceSchema`), а
 *    его имя совпадает с именем поля Prisma, поэтому `create`/`update` — это
 *    отображение значений в `data` и один вызов. Писать это руками для
 *    четырнадцати сущностей значит четырнадцать раз забыть про переводы.
 *  • ПЕРЕВОДЫ — тоже общая часть: `title__ru` уходит в `*Translation` через
 *    `upsert` по составному ключу. Пустое поле удаляет перевод, а не пишет
 *    пустую строку: пустой перевод — это «показывать пустоту вместо названия».
 *
 * Дата приходит ISO-строкой и превращается в `Date` здесь, у границы записи.
 * Деньги приходят целым числом и проверяются `money()` — не потому, что схема
 * могла пропустить дробное, а потому что это единственная гарантия, которую
 * стоит иметь в двух местах.
 *
 * Прав здесь нет: их проверяет вызывающий (`capabilityAction` в действиях,
 * `adminAccess` на страницах). Модуль `server-only`, из клиента недоступен.
 */

import type { Prisma } from '@/generated/prisma/client';
import type { AdminRow } from '@/components/data/data-table';
import { adminResourceSpecs, type AdminOption, type AdminRelationSource, type AdminResourceSpec } from '@/config/admin';
import { limits } from '@/config/business';
import { cacheTags } from '@/config/cache';
import type { AdminListParams, AdminResource } from '@/config/routes';
import { isTrashedModel, modelDelegateKey } from '@/config/trash';
import {
  translationFieldName,
  translationLocales,
  type AdminFieldValue,
  type AdminFormValues,
} from '@/domain/admin/schema';
import { domainErrors } from '@/domain/errors';
import { money } from '@/domain/money';
import { notTrashed } from '@/domain/trash';
import { db } from '@/lib/db';

/* ─────────────────────────────── Общие типы ─────────────────────────────── */

export interface AdminListResult {
  rows: readonly AdminRow[];
  total: number;
  page: number;
  pageCount: number;
}

/**
 * Минимальная подпись делегата Prisma. Нужна, чтобы обобщить запись: делегаты
 * четырнадцати моделей имеют несовместимые типы аргументов, и объединение их в
 * `Record` даёт тип, который TypeScript отказывается вызывать.
 *
 * Безопасность при этом не теряется: `data` собирается из полей, объявленных в
 * `adminResourceSpecs` и проверенных Zod, а совпадение имён полей с Prisma
 * проверяется тестом реестра и первым же запуском. Цена альтернативы — 84
 * почти одинаковых метода с ручной поддержкой.
 */
interface WriteDelegate {
  create(args: { data: Record<string, unknown>; select: { id: true } }): Promise<{ id: string }>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
    select: { id: true };
  }): Promise<{ id: string }>;
  delete(args: { where: { id: string } }): Promise<unknown>;
  findUnique(args: { where: { id: string } }): Promise<Record<string, unknown> | null>;
}

interface TranslationDelegate {
  upsert(args: {
    where: Record<string, unknown>;
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }): Promise<unknown>;
  deleteMany(args: { where: Record<string, unknown> }): Promise<unknown>;
  findMany(args: { where: Record<string, unknown> }): Promise<Record<string, unknown>[]>;
}

interface TranslationConfig {
  /** Имя делегата Prisma: `danceClassTranslation`. Разрешается по клиенту. */
  delegateKey: string;
  /** Имя поля-ссылки на родителя: `classId`, `assetId`, … */
  foreignKey: string;
  /** Имя составного уникального ключа Prisma: `classId_locale`. */
  uniqueKey: string;
}

/**
 * Клиент Prisma для записи: либо `db`, либо клиент транзакции. Запись записи и
 * её переводов должна быть неделимой, иначе сбой на переводах оставляет в
 * каталоге запись без названий на части языков.
 */
type WriteClient = Record<string, unknown>;

/** Делегат записи по ресурсу. Приведение объяснено у `WriteDelegate`. */
function writeDelegate(resource: AdminResource, client: WriteClient = db as unknown as WriteClient): WriteDelegate {
  /*
   * Делегат выводится из имени модели: `DanceClass` → `db.danceClass`. Второй
   * таблицы соответствий у проекта нет — она молча расходилась бы со схемой,
   * а имя модели уже объявлено в описании ресурса и проверено тестом.
   */
  const model = adminResourceSpecs[resource].model;
  const delegate = client[modelDelegateKey(model)] as WriteDelegate | undefined;

  if (!delegate) throw new Error(`admin: нет делегата Prisma для модели ${model}`);

  return delegate;
}

/** Конфигурация переводов. `null` — у сущности переводов нет по схеме. */
function translationConfig(resource: AdminResource): TranslationConfig | null {
  switch (resource) {
    case 'classes':
      return { delegateKey: 'danceClassTranslation', foreignKey: 'classId', uniqueKey: 'classId_locale' };
    case 'instructors':
      return { delegateKey: 'instructorTranslation', foreignKey: 'instructorId', uniqueKey: 'instructorId_locale' };
    case 'venues':
      return { delegateKey: 'venueTranslation', foreignKey: 'venueId', uniqueKey: 'venueId_locale' };
    case 'products':
      return { delegateKey: 'productTranslation', foreignKey: 'productId', uniqueKey: 'productId_locale' };
    case 'categories':
      return { delegateKey: 'productCategoryTranslation', foreignKey: 'categoryId', uniqueKey: 'categoryId_locale' };
    case 'events':
      return { delegateKey: 'eventTranslation', foreignKey: 'eventId', uniqueKey: 'eventId_locale' };
    case 'courses':
      return { delegateKey: 'courseTranslation', foreignKey: 'courseId', uniqueKey: 'courseId_locale' };
    case 'media':
      return { delegateKey: 'mediaAssetTranslation', foreignKey: 'assetId', uniqueKey: 'assetId_locale' };
    default:
      return null;
  }
}

function translationDelegate(config: TranslationConfig, client: WriteClient): TranslationDelegate {
  const delegate = client[config.delegateKey] as TranslationDelegate | undefined;

  if (!delegate) throw new Error(`admin: нет делегата переводов ${config.delegateKey}`);

  return delegate;
}

/**
 * Теги кеша, которые обязана сбросить мутация. Публичный каталог кешируется на
 * 180–300 секунд, и правка занятия без сброса тега не появляется в каталоге —
 * администратор видит старую цену и правит её второй раз.
 */
export function resourceCacheTags(resource: AdminResource): readonly string[] {
  switch (resource) {
    case 'classes':
    case 'sessions':
      return [cacheTags.classes(), cacheTags.catalogStats()];
    case 'instructors':
      return [cacheTags.instructors(), cacheTags.classes(), cacheTags.catalogStats()];
    case 'venues':
    case 'rooms':
      return [cacheTags.venues(), cacheTags.catalogStats()];
    case 'products':
    case 'categories':
    case 'variants':
      return [cacheTags.products()];
    case 'events':
      return [cacheTags.events()];
    case 'courses':
    case 'lessons':
      return [cacheTags.courses()];
    case 'media':
      return [cacheTags.instructors(), cacheTags.classes(), cacheTags.venues(), cacheTags.products()];
    case 'promo-codes':
    case 'gift-cards':
      /* Промо не участвует в кешируемых списках: скидка считается при заказе. */
      return [];
  }
}

/* ───────────────────────────── Отбор для списка ───────────────────────────── */

const PAGE_SIZE = limits.pagination.defaultPageSize;

/**
 * Условие отбора: родитель, текстовый поиск, статус. Строится записью, а потом
 * приводится к типу конкретной модели у места вызова — иначе на каждый ресурс
 * пришлось бы дублировать одни и те же три ветки.
 */
function baseWhere(
  spec: AdminResourceSpec,
  query: AdminListParams,
  searchFields: readonly string[],
): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  if (spec.parent && query.parent) {
    where[spec.parent.field] = query.parent;
  }

  const term = query.q?.trim();
  if (term && term.length > 0 && searchFields.length > 0) {
    where.OR = searchFields.map((field) => ({ [field]: { contains: term, mode: 'insensitive' } }));
  }

  const status = query.status?.trim();
  if (status && status.length > 0) {
    switch (spec.statusFilter) {
      case 'active':
        where.isActive = status === 'true';
        break;
      case 'published':
        where.isPublished = status === 'true';
        break;
      case 'moderation':
        where.moderation = status;
        break;
      case 'none':
        break;
    }
  }

  return where;
}

function pagination(query: AdminListParams): { skip: number; take: number; page: number } {
  const page = Math.max(query.page ?? 1, 1);
  return { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, page };
}

function result(rows: readonly AdminRow[], total: number, page: number): AdminListResult {
  return { rows, total, page, pageCount: Math.max(Math.ceil(total / PAGE_SIZE), 1) };
}

/** ISO-строка или `null`: дата в таблицу и в форму уходит только строкой. */
function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

/** `Decimal` из Prisma в число. Рейтинг приходит как объект, а не как `number`. */
function decimalToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/* ────────────────────────────── Чтение списков ────────────────────────────── */

export async function listResource(resource: AdminResource, query: AdminListParams): Promise<AdminListResult> {
  const spec = adminResourceSpecs[resource];
  const { skip, take, page } = pagination(query);

  switch (resource) {
    case 'classes': {
      const where = baseWhere(spec, query, ['title', 'slug']) as Prisma.DanceClassWhereInput;
      const [rows, total] = await Promise.all([
        db.danceClass.findMany({
          where,
          skip,
          take,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            title: true,
            style: true,
            level: true,
            price: true,
            capacity: true,
            isActive: true,
            updatedAt: true,
            instructor: { select: { user: { select: { name: true } } } },
          },
        }),
        db.danceClass.count({ where }),
      ]);

      return result(
        rows.map((row) => ({
          id: row.id,
          title: row.title,
          instructorName: row.instructor.user.name,
          style: row.style,
          level: row.level,
          price: row.price,
          capacity: row.capacity,
          isActive: row.isActive,
          updatedAt: iso(row.updatedAt),
        })),
        total,
        page,
      );
    }

    case 'sessions': {
      const where = baseWhere(spec, query, []) as Prisma.ClassSessionWhereInput;
      const [rows, total] = await Promise.all([
        db.classSession.findMany({
          where,
          skip,
          take,
          orderBy: { startsAt: 'desc' },
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            capacity: true,
            bookedCount: true,
            isCancelled: true,
            danceClass: { select: { title: true } },
            room: { select: { name: true } },
          },
        }),
        db.classSession.count({ where }),
      ]);

      return result(
        rows.map((row) => ({
          id: row.id,
          className: row.danceClass.title,
          startsAt: iso(row.startsAt),
          endsAt: iso(row.endsAt),
          roomName: row.room?.name ?? null,
          capacity: row.capacity,
          bookedCount: row.bookedCount,
          isCancelled: row.isCancelled,
        })),
        total,
        page,
      );
    }

    case 'instructors': {
      const where = baseWhere(spec, query, ['slug', 'headline']) as Prisma.InstructorProfileWhereInput;
      const [rows, total] = await Promise.all([
        db.instructorProfile.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            slug: true,
            hourlyRateFrom: true,
            isVerified: true,
            moderation: true,
            ratingAverage: true,
            publishedAt: true,
            user: { select: { name: true } },
          },
        }),
        db.instructorProfile.count({ where }),
      ]);

      return result(
        rows.map((row) => ({
          id: row.id,
          name: row.user.name,
          slug: row.slug,
          hourlyRateFrom: row.hourlyRateFrom,
          isVerified: row.isVerified,
          moderation: row.moderation,
          ratingAverage: decimalToNumber(row.ratingAverage),
          publishedAt: iso(row.publishedAt),
        })),
        total,
        page,
      );
    }

    case 'venues': {
      const where = baseWhere(spec, query, ['name', 'slug', 'district']) as Prisma.VenueWhereInput;
      const [rows, total] = await Promise.all([
        db.venue.findMany({
          where,
          skip,
          take,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            name: true,
            district: true,
            moderation: true,
            ratingAverage: true,
            updatedAt: true,
            _count: { select: { rooms: true } },
          },
        }),
        db.venue.count({ where }),
      ]);

      return result(
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          district: row.district,
          roomCount: row._count.rooms,
          moderation: row.moderation,
          ratingAverage: decimalToNumber(row.ratingAverage),
          updatedAt: iso(row.updatedAt),
        })),
        total,
        page,
      );
    }

    case 'rooms': {
      const where = baseWhere(spec, query, ['name']) as Prisma.RoomWhereInput;
      const [rows, total] = await Promise.all([
        db.room.findMany({
          where,
          skip,
          take,
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            capacity: true,
            areaSqm: true,
            pricePerHour: true,
            isActive: true,
            venue: { select: { name: true } },
          },
        }),
        db.room.count({ where }),
      ]);

      return result(
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          venueName: row.venue.name,
          capacity: row.capacity,
          areaSqm: row.areaSqm,
          pricePerHour: row.pricePerHour,
          isActive: row.isActive,
        })),
        total,
        page,
      );
    }

    case 'products': {
      const where = baseWhere(spec, query, ['title', 'slug', 'brand']) as Prisma.ProductWhereInput;
      const [rows, total] = await Promise.all([
        db.product.findMany({
          where,
          skip,
          take,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            title: true,
            basePrice: true,
            isActive: true,
            updatedAt: true,
            category: { select: { name: true } },
            variants: { where: notTrashed, select: { stock: true, reserved: true } },
          },
        }),
        db.product.count({ where }),
      ]);

      return result(
        rows.map((row) => ({
          id: row.id,
          title: row.title,
          categoryName: row.category.name,
          basePrice: row.basePrice,
          variantCount: row.variants.length,
          /* Остаток товара — сумма доступного по вариантам, а не число вариантов. */
          stock: row.variants.reduce((sum, variant) => sum + Math.max(variant.stock - variant.reserved, 0), 0),
          isActive: row.isActive,
          updatedAt: iso(row.updatedAt),
        })),
        total,
        page,
      );
    }

    case 'categories': {
      const where = baseWhere(spec, query, ['name', 'slug']) as Prisma.ProductCategoryWhereInput;
      const [rows, total] = await Promise.all([
        db.productCategory.findMany({
          where,
          skip,
          take,
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            sortOrder: true,
            isActive: true,
            parent: { select: { name: true } },
            _count: { select: { products: true } },
          },
        }),
        db.productCategory.count({ where }),
      ]);

      return result(
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          parentName: row.parent?.name ?? null,
          productCount: row._count.products,
          sortOrder: row.sortOrder,
          isActive: row.isActive,
        })),
        total,
        page,
      );
    }

    case 'variants': {
      const where = baseWhere(spec, query, ['sku', 'size', 'color']) as Prisma.ProductVariantWhereInput;
      const [rows, total] = await Promise.all([
        db.productVariant.findMany({
          where,
          skip,
          take,
          orderBy: { sku: 'asc' },
          select: {
            id: true,
            sku: true,
            size: true,
            color: true,
            price: true,
            stock: true,
            reserved: true,
            isActive: true,
            product: { select: { title: true } },
          },
        }),
        db.productVariant.count({ where }),
      ]);

      return result(
        rows.map((row) => ({
          id: row.id,
          sku: row.sku,
          productName: row.product.title,
          size: row.size,
          color: row.color,
          price: row.price,
          stock: row.stock,
          reserved: row.reserved,
          isActive: row.isActive,
        })),
        total,
        page,
      );
    }

    case 'events': {
      const where = baseWhere(spec, query, ['title', 'slug']) as Prisma.EventWhereInput;
      const [rows, total] = await Promise.all([
        db.event.findMany({
          where,
          skip,
          take,
          orderBy: { startsAt: 'desc' },
          select: {
            id: true,
            title: true,
            type: true,
            startsAt: true,
            price: true,
            capacity: true,
            bookedCount: true,
            isPublished: true,
          },
        }),
        db.event.count({ where }),
      ]);

      return result(
        rows.map((row) => ({
          id: row.id,
          title: row.title,
          type: row.type,
          startsAt: iso(row.startsAt),
          price: row.price,
          capacity: row.capacity,
          bookedCount: row.bookedCount,
          isPublished: row.isPublished,
        })),
        total,
        page,
      );
    }

    case 'courses': {
      const where = baseWhere(spec, query, ['title', 'slug']) as Prisma.CourseWhereInput;
      const [rows, total] = await Promise.all([
        db.course.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            price: true,
            totalMinutes: true,
            isPublished: true,
            instructor: { select: { user: { select: { name: true } } } },
            _count: { select: { lessons: true } },
          },
        }),
        db.course.count({ where }),
      ]);

      return result(
        rows.map((row) => ({
          id: row.id,
          title: row.title,
          instructorName: row.instructor.user.name,
          lessonCount: row._count.lessons,
          totalMinutes: row.totalMinutes,
          price: row.price,
          isPublished: row.isPublished,
        })),
        total,
        page,
      );
    }

    case 'lessons': {
      const where = baseWhere(spec, query, ['title', 'slug']) as Prisma.CourseLessonWhereInput;
      const [rows, total] = await Promise.all([
        db.courseLesson.findMany({
          where,
          skip,
          take,
          orderBy: [{ courseId: 'asc' }, { sortOrder: 'asc' }],
          select: {
            id: true,
            title: true,
            sortOrder: true,
            durationMinutes: true,
            isPreview: true,
            course: { select: { title: true } },
          },
        }),
        db.courseLesson.count({ where }),
      ]);

      return result(
        rows.map((row) => ({
          id: row.id,
          title: row.title,
          courseName: row.course.title,
          sortOrder: row.sortOrder,
          durationMinutes: row.durationMinutes,
          isPreview: row.isPreview,
        })),
        total,
        page,
      );
    }

    case 'promo-codes': {
      const where = baseWhere(spec, query, ['code']) as Prisma.PromoCodeWhereInput;
      const [rows, total] = await Promise.all([
        db.promoCode.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            code: true,
            type: true,
            value: true,
            usageCount: true,
            usageLimit: true,
            endsAt: true,
            isActive: true,
          },
        }),
        db.promoCode.count({ where }),
      ]);

      return result(
        rows.map((row) => ({
          id: row.id,
          code: row.code,
          type: row.type,
          value: row.value,
          usageCount: row.usageCount,
          usageLimit: row.usageLimit,
          endsAt: iso(row.endsAt),
          isActive: row.isActive,
        })),
        total,
        page,
      );
    }

    case 'gift-cards': {
      const where = baseWhere(spec, query, ['code', 'recipientEmail']) as Prisma.GiftCardWhereInput;
      const [rows, total] = await Promise.all([
        db.giftCard.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            code: true,
            initialAmount: true,
            balance: true,
            recipientEmail: true,
            expiresAt: true,
            createdAt: true,
          },
        }),
        db.giftCard.count({ where }),
      ]);

      return result(
        rows.map((row) => ({
          id: row.id,
          code: row.code,
          initialAmount: row.initialAmount,
          balance: row.balance,
          recipientEmail: row.recipientEmail,
          expiresAt: iso(row.expiresAt),
          createdAt: iso(row.createdAt),
        })),
        total,
        page,
      );
    }

    case 'media': {
      const where = baseWhere(spec, query, ['altText', 'storageKey']) as Prisma.MediaAssetWhereInput;
      const [rows, total] = await Promise.all([
        db.mediaAsset.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            altText: true,
            mimeType: true,
            bytes: true,
            width: true,
            height: true,
            createdAt: true,
            instructor: { select: { slug: true } },
            venue: { select: { name: true } },
            danceClass: { select: { title: true } },
            product: { select: { title: true } },
            event: { select: { title: true } },
          },
        }),
        db.mediaAsset.count({ where }),
      ]);

      return result(
        rows.map((row) => ({
          id: row.id,
          altText: row.altText,
          ownerLabel:
            row.instructor?.slug ??
            row.venue?.name ??
            row.danceClass?.title ??
            row.product?.title ??
            row.event?.title ??
            null,
          mimeType: row.mimeType,
          dimensions: row.width && row.height ? `${row.width}×${row.height}` : null,
          bytes: row.bytes,
          createdAt: iso(row.createdAt),
        })),
        total,
        page,
      );
    }
  }
}

/* ─────────────────────────── Чтение одной записи ─────────────────────────── */

/**
 * Значения записи для формы. Читается сама запись плюс её переводы; поля, которых
 * в описании формы нет, отбрасываются — форма не должна получать сырую строку БД
 * с денормализованными агрегатами и служебными полями.
 */
export async function getResourceValues(
  resource: AdminResource,
  id: string,
): Promise<AdminFormValues | null> {
  const spec = adminResourceSpecs[resource];
  const row = await writeDelegate(resource).findUnique({ where: { id } });
  if (!row) return null;

  const values: AdminFormValues = {};

  for (const field of spec.fields) {
    values[field.name] = toFieldValue(field.name, row);
  }

  const translations = translationConfig(resource);
  if (translations) {
    const rows = await translationDelegate(translations, db as unknown as WriteClient).findMany({
      where: { [translations.foreignKey]: id },
    });

    for (const translation of rows) {
      const locale = translation.locale;
      if (typeof locale !== 'string') continue;

      for (const field of spec.fields) {
        if (field.localized !== true) continue;
        values[`${field.name}__${locale}`] = toFieldValue(field.name, translation);
      }
    }
  }

  return values;
}

/**
 * Значение поля БД в значение формы. `publishedAt` показывается как флаг
 * «опубликовано»: администратору нужно решение, а не редактирование метки
 * времени, которую всё равно ставит система.
 */
function toFieldValue(name: string, row: Record<string, unknown>): AdminFieldValue {
  if (name === 'published') return row.publishedAt !== null && row.publishedAt !== undefined;

  const value = row[name];

  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((item) => String(item));

  /* Decimal и прочие объекты Prisma: в форму уходит число. */
  return decimalToNumber(value);
}

/* ──────────────────────────────── Запись ──────────────────────────────── */

/**
 * Значения формы в `data` для Prisma. Здесь же — три преобразования, которые
 * иначе разъезжаются по разделам: дата из строки, деньги через `money()`,
 * публикация из флага в метку времени.
 */
function toPrismaData(spec: AdminResourceSpec, values: AdminFormValues): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  for (const field of spec.fields) {
    const value = values[field.name];

    if (field.name === 'published') {
      /*
       * Флаг → метка времени. Повторная публикация уже опубликованной записи не
       * должна сдвигать дату: по ней строится «новинки» в каталоге.
       */
      data.publishedAt = value === true ? new Date() : null;
      continue;
    }

    switch (field.kind) {
      case 'date':
      case 'datetime':
        data[field.name] = typeof value === 'string' && value.length > 0 ? new Date(value) : null;
        break;

      case 'money':
        data[field.name] = typeof value === 'number' ? money(value) : null;
        break;

      case 'number':
      case 'decimal':
      case 'rate':
        data[field.name] = typeof value === 'number' ? value : null;
        break;

      case 'switch':
        data[field.name] = value === true;
        break;

      case 'list':
      case 'multiselect':
        data[field.name] = Array.isArray(value) ? [...value] : [];
        break;

      case 'relation':
        data[field.name] = typeof value === 'string' && value.length > 0 ? value : null;
        break;

      default:
        data[field.name] = typeof value === 'string' && value.length > 0 ? value : null;
        break;
    }

    /*
     * Колонка NOT NULL со значением по умолчанию: пустое поле означает
     * «оставить как в схеме». Prisma отвергает NULL для такой колонки, поэтому
     * ключ убирается целиком — при создании подставится default, при
     * изменении значение останется прежним.
     */
    if (field.dbDefault === true && data[field.name] === null) {
      delete data[field.name];
    }
  }

  return data;
}

/**
 * Обязательные поля не могут уехать в БД как `null`: схема это уже проверила, но
 * `toPrismaData` приводит пустое к `null` единообразно, и обязательное поле с
 * `null` дало бы ошибку Prisma вместо понятной ошибки формы.
 */
function assertRequired(spec: AdminResourceSpec, data: Record<string, unknown>): void {
  for (const field of spec.fields) {
    if (field.required !== true) continue;
    const value = data[field.name];
    if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
      throw domainErrors.validationFailed(field.name);
    }
  }
}

/** Переводы: `upsert` для заполненных локалей, удаление для очищенных. */
async function writeTranslations(
  resource: AdminResource,
  id: string,
  spec: AdminResourceSpec,
  values: AdminFormValues,
  client: WriteClient,
): Promise<void> {
  const config = translationConfig(resource);
  if (!config) return;

  const localizedFields = spec.fields.filter((field) => field.localized === true);
  if (localizedFields.length === 0) return;

  const delegate = translationDelegate(config, client);

  for (const locale of translationLocales) {
    const payload: Record<string, unknown> = {};
    let filled = false;

    for (const field of localizedFields) {
      const raw = values[translationFieldName(field.name, locale)];

      /*
       * Вид значения берётся из ОПИСАНИЯ поля, а не из того, что пришло. Иначе
       * незаполненный список уезжает в колонку `String[]` пустой строкой:
       * значения нет → `Array.isArray` ложно → ветка текста. Prisma отвергает
       * такой перевод, и вся запись не сохраняется.
       */
      if (field.kind === 'list' || field.kind === 'multiselect') {
        const items = Array.isArray(raw) ? raw.map((item) => String(item)).filter((item) => item.length > 0) : [];
        payload[field.name] = items;
        if (items.length > 0) filled = true;
        continue;
      }

      const text = typeof raw === 'string' ? raw.trim() : '';
      payload[field.name] = text;
      if (text.length > 0) filled = true;
    }

    if (!filled) {
      /*
       * Пустой перевод удаляется, а не пишется пустыми строками: запись с пустым
       * названием в каталоге выглядит как потерянные данные, и next-intl не
       * подставит основной язык вместо пустой строки из БД.
       */
      await delegate.deleteMany({ where: { [config.foreignKey]: id, locale } });
      continue;
    }

    await delegate.upsert({
      where: { [config.uniqueKey]: { [config.foreignKey]: id, locale } },
      create: { ...payload, [config.foreignKey]: id, locale },
      update: payload,
    });
  }
}

export async function createResource(resource: AdminResource, values: AdminFormValues): Promise<string> {
  const spec = adminResourceSpecs[resource];
  if (!spec.creatable) throw domainErrors.forbidden();

  const data = toPrismaData(spec, values);
  assertRequired(spec, data);

  /*
   * Запись и переводы — одна транзакция. Сбой на переводах после успешного
   * создания оставлял бы в каталоге запись, названия которой нет ни на одном
   * языке, кроме основного, и о существовании которой администратор узнаёт
   * только из списка: форма-то показала ошибку.
   */
  return db.$transaction(async (tx) => {
    const client = tx as unknown as WriteClient;
    const created = await writeDelegate(resource, client).create({ data, select: { id: true } });
    await writeTranslations(resource, created.id, spec, values, client);

    return created.id;
  });
}

export async function updateResource(
  resource: AdminResource,
  id: string,
  values: AdminFormValues,
): Promise<void> {
  const spec = adminResourceSpecs[resource];

  const data = toPrismaData(spec, values);
  assertRequired(spec, data);

  /*
   * `publishedAt` не перезаписывается при каждом сохранении: если запись уже
   * опубликована и флаг остался включённым, дата публикации сохраняется.
   */
  if ('publishedAt' in data && data.publishedAt !== null) {
    const current = await writeDelegate(resource).findUnique({ where: { id } });
    if (current?.publishedAt instanceof Date) data.publishedAt = current.publishedAt;
  }

  await db.$transaction(async (tx) => {
    const client = tx as unknown as WriteClient;
    await writeDelegate(resource, client).update({ where: { id }, data, select: { id: true } });
    await writeTranslations(resource, id, spec, values, client);
  });
}

/**
 * Удаление записи.
 *
 * Для мягко удаляемых моделей это ПЕРЕНОС В КОРЗИНУ, а не стирание: ставится
 * `deletedAt`, после чего запись исчезает из любого чтения (расширение клиента в
 * `src/lib/db.ts`), но остаётся восстановимой в течение срока хранения. «Удалите
 * это занятие» и «удалите не то занятие» выглядят на экране одинаково — разница
 * только в том, можно ли отменить.
 *
 * Модель без мягкого удаления стирается сразу: у неё нет колонки `deletedAt`, и
 * притворяться, что запись можно вернуть, было бы обманом.
 */
export async function deleteResource(resource: AdminResource, id: string): Promise<void> {
  const spec = adminResourceSpecs[resource];
  if (!spec.deletable) throw domainErrors.forbidden();

  if (isTrashedModel(spec.model)) {
    await writeDelegate(resource).update({
      where: { id },
      data: { deletedAt: new Date() },
      select: { id: true },
    });
    return;
  }

  await writeDelegate(resource).delete({ where: { id } });
}

/** Снимок записи для журнала аудита: до и после операции. */
export async function resourceSnapshot(
  resource: AdminResource,
  id: string,
): Promise<Record<string, unknown> | null> {
  return writeDelegate(resource).findUnique({ where: { id } });
}

/* ──────────────────────── Варианты для полей-связей ──────────────────────── */

/**
 * Значения выпадающего списка связи. Ограничены `limits.query.maxRows`: список
 * из десяти тысяч инструкторов бесполезен как селект — там нужен поиск, и это
 * отдельная задача, а не бесконечный `<option>`.
 */
export async function relationOptions(source: AdminRelationSource): Promise<readonly AdminOption[]> {
  const take = limits.query.maxRows;

  switch (source) {
    case 'users': {
      const rows = await db.user.findMany({
        where: { isActive: true },
        take,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, email: true },
      });
      return rows.map((row) => ({ value: row.id, label: `${row.name} · ${row.email}` }));
    }

    case 'instructors': {
      const rows = await db.instructorProfile.findMany({
        take,
        orderBy: { slug: 'asc' },
        select: { id: true, slug: true, user: { select: { name: true } } },
      });
      return rows.map((row) => ({ value: row.id, label: `${row.user.name} · ${row.slug}` }));
    }

    case 'venues': {
      const rows = await db.venue.findMany({
        take,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, district: true },
      });
      return rows.map((row) => ({ value: row.id, label: `${row.name} · ${row.district}` }));
    }

    case 'rooms': {
      const rows = await db.room.findMany({
        take,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, venue: { select: { name: true } } },
      });
      return rows.map((row) => ({ value: row.id, label: `${row.venue.name} · ${row.name}` }));
    }

    case 'classes': {
      const rows = await db.danceClass.findMany({
        take,
        orderBy: { title: 'asc' },
        select: { id: true, title: true },
      });
      return rows.map((row) => ({ value: row.id, label: row.title }));
    }

    case 'products': {
      const rows = await db.product.findMany({
        take,
        orderBy: { title: 'asc' },
        select: { id: true, title: true },
      });
      return rows.map((row) => ({ value: row.id, label: row.title }));
    }

    case 'categories': {
      const rows = await db.productCategory.findMany({
        take,
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      });
      return rows.map((row) => ({ value: row.id, label: row.name }));
    }

    case 'courses': {
      const rows = await db.course.findMany({
        take,
        orderBy: { title: 'asc' },
        select: { id: true, title: true },
      });
      return rows.map((row) => ({ value: row.id, label: row.title }));
    }

    case 'events': {
      const rows = await db.event.findMany({
        take,
        orderBy: { startsAt: 'desc' },
        select: { id: true, title: true },
      });
      return rows.map((row) => ({ value: row.id, label: row.title }));
    }

    /* Остальные ресурсы как источник связи не используются. */
    case 'sessions':
    case 'variants':
    case 'lessons':
    case 'promo-codes':
    case 'gift-cards':
    case 'media':
      return [];
  }
}

/** Подпись записи для заголовка экрана правки и хлебной крошки. */
export function resourceLabel(spec: AdminResourceSpec, values: AdminFormValues): string {
  const primary = values[spec.primaryField];
  return typeof primary === 'string' && primary.length > 0 ? primary : '';
}
