/**
 * АДМИНКА — описание разделов, таблиц и форм данными, а не кодом.
 *
 * Почему так, а не двадцать экранов. Раздел админки — это всегда одно и то же:
 * список с фильтрами, форма создания, форма правки, удаление, журнал. Разница
 * между «занятиями» и «товарами» — в наборе полей и в том, куда писать. Если
 * писать каждый раздел руками, различия расползаются: в одном списке пагинация
 * в URL, в другом в состоянии; в одной форме цена целая, в другой с копейками;
 * в третьей забыли alt-текст. Через полгода это двадцать разных админок.
 *
 * Поэтому здесь объявлены ДАННЫЕ: какие колонки, какие поля, какие права. Три
 * страницы (`/admin/[resource]`, `.../new`, `.../[id]`) читают это описание и
 * рисуют любой раздел. Добавить раздел = добавить запись здесь и обработчик
 * записи в реестре (`src/server/admin/registry.ts`).
 *
 * Что здесь НЕ живёт:
 *  • тексты — только ключи i18n (`MessageKey` ловит опечатку типом);
 *  • пути — только `routes.*`;
 *  • значения enum — только из `@/domain/enums` и конфигов;
 *  • логика записи в БД — она в реестре, вместе с транзакциями и аудитом.
 *
 * Литералы в этом файле легальны: `src/config/**` — их законное место, они и
 * есть содержимое конфигурации.
 */

import { type Capability } from './capabilities';
import { lineItemTypes } from './pricing';
import { adminResources, routes, type AdminResource } from './routes';
import {
  danceStyleLabelKey,
  danceStyles,
  eventTypeLabelKey,
  eventTypes,
  moderationStatusLabelKey,
  moderationStatuses,
  skillLevelLabelKey,
  skillLevels,
  venueAmenities,
  venueAmenityLabelKey,
} from '@/domain/enums';
import { localeMeta, locales } from '@/i18n/config';
import type { MessageKey } from '@/i18n/types';

/* ─────────────────────────────── Поля формы ─────────────────────────────── */

/**
 * Вид поля. Определяет и виджет, и разбор значения на сервере: `money` — целое
 * число драм, `rate` — доля от нуля до единицы, `list` — строки по одной на
 * строку ввода. Один и тот же вид не должен вести себя по-разному в двух формах.
 */
export const adminFieldKinds = [
  'text',
  'textarea',
  'slug',
  'list',
  'number',
  /**
   * Дробное число. Существует ради координат: широта 40.18 — не «неаккуратно
   * введённое целое», а единственная форма этого значения. Вид `number` требует
   * целого намеренно (вместимость, длительность, остаток), и смешивать их значит
   * либо разрешить дробную вместимость, либо запретить карту.
   */
  'decimal',
  'money',
  'rate',
  'switch',
  'select',
  'multiselect',
  'date',
  'datetime',
  'time',
  'relation',
  'email',
] as const;

export type AdminFieldKind = (typeof adminFieldKinds)[number];

/** Вариант выбора. Либо ключ перевода, либо готовая строка (названия языков). */
export interface AdminOption {
  value: string;
  labelKey?: MessageKey;
  label?: string;
}

/** Источник вариантов для `relation`: ресурс админки или пользователи. */
export type AdminRelationSource = AdminResource | 'users';

export interface AdminFieldSpec {
  /** Имя поля Prisma. Совпадение обязательно: по нему пишет реестр. */
  name: string;
  labelKey: MessageKey;
  kind: AdminFieldKind;
  required?: boolean;
  hintKey?: MessageKey;
  options?: readonly AdminOption[];
  relation?: AdminRelationSource;
  min?: number;
  max?: number;
  rows?: number;
  /**
   * Поле имеет переводы. Основное значение пишется в таблицу сущности (язык по
   * умолчанию), остальные локали — в `*Translation`. Одно объявление вместо трёх
   * почти одинаковых полей в форме.
   */
  localized?: boolean;
  /** Занимает всю ширину сетки формы. */
  full?: boolean;
  /**
   * Колонка NOT NULL со значением по умолчанию в схеме. Пустое поле означает
   * «оставить как в схеме», а не «записать NULL»: Prisma отвергает NULL для
   * такой колонки, и без этого признака форма не сохранялась бы вовсе.
   *
   * Признак проверяется тестом против `prisma/schema.prisma` в обе стороны:
   * забытый признак — ошибка записи, лишний — необнуляемое поле в интерфейсе.
   */
  dbDefault?: boolean;
}

/* ───────────────────────────── Колонки списка ───────────────────────────── */

/**
 * Вид ячейки. Отдельно от вида поля: в списке цена только отображается, и
 * `money` здесь означает «прогнать через `format.number(…, 'price')`», а не
 * «ввести целое число».
 */
export const adminCellKinds = [
  'text',
  'number',
  'money',
  'date',
  'datetime',
  'bool',
  'list',
  'rate',
  'bookingStatus',
  'orderStatus',
  'paymentStatus',
  'payoutStatus',
  'moderation',
  'role',
] as const;

export type AdminCellKind = (typeof adminCellKinds)[number];

export interface AdminColumnSpec {
  key: string;
  labelKey: MessageKey;
  kind: AdminCellKind;
  /** Скрывать на узком экране: у таблицы админки есть предел читаемости. */
  secondary?: boolean;
}

/* ──────────────────────────── Фильтр по статусу ──────────────────────────── */

/**
 * Какой фильтр статуса показывать в списке. `none` — у сущностей, у которых
 * состояния нет вообще (варианты, уроки); подсовывать им пустой селект — врать
 * пользователю.
 */
export type AdminStatusFilter = 'active' | 'published' | 'moderation' | 'none';

/* ───────────────────────────────── Ресурс ───────────────────────────────── */

export type AdminNavGroup = 'overview' | 'catalog' | 'operations' | 'money' | 'people' | 'system';

export interface AdminResourceSpec {
  id: AdminResource;
  /**
   * Модель Prisma. По ней реестр находит делегат записи, а тест сверяет поля
   * формы со схемой: имя модели в одном месте вместо таблицы соответствий,
   * которая молча расходится со схемой.
   */
  model: string;
  group: AdminNavGroup;
  navLabelKey: MessageKey;
  titleKey: MessageKey;
  subtitleKey: MessageKey;
  /** Права: смотреть, изменять, публиковать (если у сущности есть публикация). */
  view: Capability;
  edit: Capability;
  publish?: Capability;
  remove?: Capability;
  /**
   * Родительская связь. Список фильтруется по `?parent=`, форма подставляет
   * родителя. Без этого «залы» — плоский список из трёх площадок, в котором
   * нельзя работать.
   */
  parent?: { resource: AdminResource; field: string };
  columns: readonly AdminColumnSpec[];
  fields: readonly AdminFieldSpec[];
  /** Поле-заголовок записи: по нему открывается запись и строится хлебная крошка. */
  primaryField: string;
  statusFilter: AdminStatusFilter;
  searchable: boolean;
  /** Создание из интерфейса. У медиа его нет: файл приходит загрузкой. */
  creatable: boolean;
  deletable: boolean;
  /** Не показывать в сайдбаре: вложенные разделы открываются от родителя. */
  navHidden?: boolean;
}

/* ─────────────────────────── Словари вариантов ─────────────────────────── */

const styleOptions: readonly AdminOption[] = danceStyles.map((value) => ({
  value,
  labelKey: danceStyleLabelKey(value),
}));

const levelOptions: readonly AdminOption[] = skillLevels.map((value) => ({
  value,
  labelKey: skillLevelLabelKey(value),
}));

const moderationOptions: readonly AdminOption[] = moderationStatuses.map((value) => ({
  value,
  labelKey: moderationStatusLabelKey(value),
}));

const amenityOptions: readonly AdminOption[] = venueAmenities.map((value) => ({
  value,
  labelKey: venueAmenityLabelKey(value),
}));

const eventTypeOptions: readonly AdminOption[] = eventTypes.map((value) => ({
  value,
  labelKey: eventTypeLabelKey(value),
}));

/** Языки. Подпись — самоназвание: «Русский» не переводится на английский. */
const localeOptions: readonly AdminOption[] = locales.map((value) => ({
  value,
  label: localeMeta[value].nativeName,
}));

const discountTypeOptions: readonly AdminOption[] = (['PERCENT', 'FIXED'] as const).map((value) => ({
  value,
  labelKey: `admin.enums.discountType.${value}` as MessageKey,
}));

const lineItemOptions: readonly AdminOption[] = lineItemTypes.map((value) => ({
  value,
  labelKey: `admin.enums.lineItem.${value}` as MessageKey,
}));

/* ───────────────────────── Часто повторяющиеся поля ───────────────────────── */

const slugField: AdminFieldSpec = {
  name: 'slug',
  labelKey: 'admin.fields.slug',
  kind: 'slug',
  required: true,
  hintKey: 'admin.form.slugHint',
};

const isActiveField: AdminFieldSpec = {
  name: 'isActive',
  labelKey: 'admin.fields.isActive',
  kind: 'switch',
};

const sortOrderField: AdminFieldSpec = {
  name: 'sortOrder',
  labelKey: 'admin.fields.sortOrder',
  kind: 'number',
  min: 0,
  max: 999,
  dbDefault: true,
};

const updatedAtColumn: AdminColumnSpec = {
  key: 'updatedAt',
  labelKey: 'admin.fields.updatedAt',
  kind: 'datetime',
  secondary: true,
};

/* ─────────────────────────────── Реестр ресурсов ─────────────────────────────── */

export const adminResourceSpecs: Record<AdminResource, AdminResourceSpec> = {
  classes: {
    id: 'classes',
    model: 'DanceClass',
    group: 'catalog',
    navLabelKey: 'admin.nav.classes',
    titleKey: 'admin.resources.classes.title',
    subtitleKey: 'admin.resources.classes.subtitle',
    view: 'catalog.view',
    edit: 'catalog.edit',
    publish: 'catalog.publish',
    primaryField: 'title',
    statusFilter: 'active',
    searchable: true,
    creatable: true,
    deletable: true,
    columns: [
      { key: 'title', labelKey: 'admin.fields.title', kind: 'text' },
      { key: 'instructorName', labelKey: 'admin.fields.instructor', kind: 'text' },
      { key: 'style', labelKey: 'admin.fields.style', kind: 'text', secondary: true },
      { key: 'level', labelKey: 'admin.fields.level', kind: 'text', secondary: true },
      { key: 'price', labelKey: 'admin.fields.price', kind: 'money' },
      { key: 'capacity', labelKey: 'admin.fields.capacity', kind: 'number', secondary: true },
      { key: 'isActive', labelKey: 'admin.fields.isActive', kind: 'bool' },
      updatedAtColumn,
    ],
    fields: [
      slugField,
      { name: 'title', labelKey: 'admin.fields.title', kind: 'text', required: true, localized: true },
      {
        name: 'description',
        labelKey: 'admin.fields.description',
        kind: 'textarea',
        required: true,
        localized: true,
        rows: 5,
        full: true,
      },
      {
        name: 'learningPoints',
        labelKey: 'admin.fields.learningPoints',
        kind: 'list',
        localized: true,
        hintKey: 'admin.form.listHint',
        full: true,
      },
      {
        name: 'instructorId',
        labelKey: 'admin.fields.instructor',
        kind: 'relation',
        relation: 'instructors',
        required: true,
      },
      { name: 'venueId', labelKey: 'admin.fields.venue', kind: 'relation', relation: 'venues' },
      { name: 'style', labelKey: 'admin.fields.style', kind: 'select', options: styleOptions, required: true },
      { name: 'level', labelKey: 'admin.fields.level', kind: 'select', options: levelOptions, required: true },
      {
        name: 'durationMinutes',
        labelKey: 'admin.fields.durationMinutes',
        kind: 'number',
        required: true,
        min: 15,
        max: 480,
      },
      {
        name: 'price',
        labelKey: 'admin.fields.price',
        kind: 'money',
        required: true,
        hintKey: 'admin.form.moneyHint',
      },
      { name: 'capacity', labelKey: 'admin.fields.capacity', kind: 'number', required: true, min: 1, max: 200 },
      { name: 'isTrending', labelKey: 'admin.fields.isPublished', kind: 'switch' },
      isActiveField,
    ],
  },

  sessions: {
    id: 'sessions',
    model: 'ClassSession',
    group: 'catalog',
    navLabelKey: 'admin.nav.sessions',
    titleKey: 'admin.resources.sessions.title',
    subtitleKey: 'admin.resources.sessions.subtitle',
    view: 'catalog.view',
    edit: 'catalog.edit',
    primaryField: 'startsAt',
    statusFilter: 'none',
    searchable: false,
    creatable: true,
    deletable: true,
    navHidden: true,
    parent: { resource: 'classes', field: 'classId' },
    columns: [
      { key: 'className', labelKey: 'admin.fields.class', kind: 'text' },
      { key: 'startsAt', labelKey: 'admin.fields.startsAt', kind: 'datetime' },
      { key: 'endsAt', labelKey: 'admin.fields.endsAt', kind: 'datetime', secondary: true },
      { key: 'roomName', labelKey: 'admin.fields.room', kind: 'text', secondary: true },
      { key: 'capacity', labelKey: 'admin.fields.capacity', kind: 'number' },
      { key: 'bookedCount', labelKey: 'admin.fields.bookedCount', kind: 'number' },
      { key: 'isCancelled', labelKey: 'admin.fields.isCancelled', kind: 'bool' },
    ],
    fields: [
      { name: 'classId', labelKey: 'admin.fields.class', kind: 'relation', relation: 'classes', required: true },
      { name: 'roomId', labelKey: 'admin.fields.room', kind: 'relation', relation: 'rooms' },
      { name: 'startsAt', labelKey: 'admin.fields.startsAt', kind: 'datetime', required: true },
      { name: 'endsAt', labelKey: 'admin.fields.endsAt', kind: 'datetime', required: true },
      { name: 'capacity', labelKey: 'admin.fields.capacity', kind: 'number', required: true, min: 1, max: 200 },
      { name: 'isCancelled', labelKey: 'admin.fields.isCancelled', kind: 'switch' },
    ],
  },

  instructors: {
    id: 'instructors',
    model: 'InstructorProfile',
    group: 'catalog',
    navLabelKey: 'admin.nav.instructors',
    titleKey: 'admin.resources.instructors.title',
    subtitleKey: 'admin.resources.instructors.subtitle',
    view: 'catalog.view',
    edit: 'catalog.edit',
    publish: 'instructors.verify',
    primaryField: 'name',
    statusFilter: 'moderation',
    searchable: true,
    creatable: true,
    deletable: true,
    columns: [
      { key: 'name', labelKey: 'admin.fields.name', kind: 'text' },
      { key: 'slug', labelKey: 'admin.fields.slug', kind: 'text', secondary: true },
      { key: 'hourlyRateFrom', labelKey: 'admin.fields.hourlyRateFrom', kind: 'money' },
      { key: 'isVerified', labelKey: 'admin.fields.isVerified', kind: 'bool' },
      { key: 'moderation', labelKey: 'admin.fields.moderation', kind: 'moderation' },
      { key: 'ratingAverage', labelKey: 'admin.fields.rating', kind: 'rate', secondary: true },
      { key: 'publishedAt', labelKey: 'admin.fields.publishedAt', kind: 'date', secondary: true },
    ],
    fields: [
      { name: 'userId', labelKey: 'admin.fields.user', kind: 'relation', relation: 'users', required: true },
      slugField,
      { name: 'headline', labelKey: 'admin.fields.headline', kind: 'text', required: true, localized: true },
      {
        name: 'bio',
        labelKey: 'admin.fields.bio',
        kind: 'textarea',
        required: true,
        localized: true,
        rows: 6,
        full: true,
      },
      {
        name: 'styles',
        labelKey: 'admin.fields.styles',
        kind: 'multiselect',
        options: styleOptions,
        required: true,
        full: true,
      },
      {
        name: 'specializations',
        labelKey: 'admin.fields.specializations',
        kind: 'list',
        hintKey: 'admin.form.listHint',
        full: true,
      },
      {
        name: 'yearsExperience',
        labelKey: 'admin.fields.yearsExperience',
        kind: 'number',
        min: 0,
        max: 80,
        dbDefault: true,
      },
      {
        name: 'hourlyRateFrom',
        labelKey: 'admin.fields.hourlyRateFrom',
        kind: 'money',
        required: true,
        hintKey: 'admin.form.moneyHint',
      },
      { name: 'acceptsTravel', labelKey: 'admin.fields.acceptsTravel', kind: 'switch' },
      { name: 'travelRadiusKm', labelKey: 'admin.fields.travelRadiusKm', kind: 'number', min: 0, max: 100 },
      {
        name: 'languages',
        labelKey: 'admin.fields.languages',
        kind: 'multiselect',
        options: localeOptions,
      },
      { name: 'isVerified', labelKey: 'admin.fields.isVerified', kind: 'switch' },
      {
        name: 'moderation',
        labelKey: 'admin.fields.moderation',
        kind: 'select',
        options: moderationOptions,
        required: true,
      },
      { name: 'published', labelKey: 'admin.fields.isPublished', kind: 'switch' },
    ],
  },

  venues: {
    id: 'venues',
    model: 'Venue',
    group: 'catalog',
    navLabelKey: 'admin.nav.venues',
    titleKey: 'admin.resources.venues.title',
    subtitleKey: 'admin.resources.venues.subtitle',
    view: 'catalog.view',
    edit: 'catalog.edit',
    publish: 'venues.verify',
    primaryField: 'name',
    statusFilter: 'moderation',
    searchable: true,
    creatable: true,
    deletable: true,
    columns: [
      { key: 'name', labelKey: 'admin.fields.name', kind: 'text' },
      { key: 'district', labelKey: 'admin.fields.district', kind: 'text' },
      { key: 'roomCount', labelKey: 'admin.fields.room', kind: 'number', secondary: true },
      { key: 'moderation', labelKey: 'admin.fields.moderation', kind: 'moderation' },
      { key: 'ratingAverage', labelKey: 'admin.fields.rating', kind: 'rate', secondary: true },
      updatedAtColumn,
    ],
    fields: [
      slugField,
      { name: 'name', labelKey: 'admin.fields.name', kind: 'text', required: true, localized: true },
      {
        name: 'description',
        labelKey: 'admin.fields.description',
        kind: 'textarea',
        required: true,
        localized: true,
        rows: 5,
        full: true,
      },
      { name: 'district', labelKey: 'admin.fields.district', kind: 'text', required: true },
      { name: 'city', labelKey: 'admin.fields.city', kind: 'text', required: true },
      { name: 'addressLine', labelKey: 'admin.fields.addressLine', kind: 'text', required: true, full: true },
      { name: 'latitude', labelKey: 'admin.fields.latitude', kind: 'decimal', required: true, min: -90, max: 90 },
      {
        name: 'longitude',
        labelKey: 'admin.fields.longitude',
        kind: 'decimal',
        required: true,
        min: -180,
        max: 180,
      },
      { name: 'phone', labelKey: 'admin.fields.phone', kind: 'text' },
      {
        name: 'amenities',
        labelKey: 'admin.fields.amenities',
        kind: 'multiselect',
        options: amenityOptions,
        full: true,
      },
      {
        name: 'openTime',
        labelKey: 'admin.fields.openTime',
        kind: 'time',
        required: true,
        hintKey: 'admin.form.timeHint',
      },
      { name: 'closeTime', labelKey: 'admin.fields.closeTime', kind: 'time', required: true },
      {
        name: 'moderation',
        labelKey: 'admin.fields.moderation',
        kind: 'select',
        options: moderationOptions,
        required: true,
      },
      { name: 'published', labelKey: 'admin.fields.isPublished', kind: 'switch' },
    ],
  },

  rooms: {
    id: 'rooms',
    model: 'Room',
    group: 'catalog',
    navLabelKey: 'admin.nav.rooms',
    titleKey: 'admin.resources.rooms.title',
    subtitleKey: 'admin.resources.rooms.subtitle',
    view: 'catalog.view',
    edit: 'catalog.edit',
    primaryField: 'name',
    statusFilter: 'active',
    searchable: true,
    creatable: true,
    deletable: true,
    navHidden: true,
    parent: { resource: 'venues', field: 'venueId' },
    columns: [
      { key: 'name', labelKey: 'admin.fields.name', kind: 'text' },
      { key: 'venueName', labelKey: 'admin.fields.venue', kind: 'text' },
      { key: 'capacity', labelKey: 'admin.fields.capacity', kind: 'number' },
      { key: 'areaSqm', labelKey: 'admin.fields.areaSqm', kind: 'number', secondary: true },
      { key: 'pricePerHour', labelKey: 'admin.fields.pricePerHour', kind: 'money' },
      { key: 'isActive', labelKey: 'admin.fields.isActive', kind: 'bool' },
    ],
    fields: [
      { name: 'venueId', labelKey: 'admin.fields.venue', kind: 'relation', relation: 'venues', required: true },
      { name: 'name', labelKey: 'admin.fields.name', kind: 'text', required: true },
      { name: 'areaSqm', labelKey: 'admin.fields.areaSqm', kind: 'number', min: 0, max: 5_000 },
      { name: 'capacity', labelKey: 'admin.fields.capacity', kind: 'number', required: true, min: 1, max: 500 },
      {
        name: 'amenities',
        labelKey: 'admin.fields.amenities',
        kind: 'multiselect',
        options: amenityOptions,
        full: true,
      },
      {
        name: 'pricePerHour',
        labelKey: 'admin.fields.pricePerHour',
        kind: 'money',
        required: true,
        hintKey: 'admin.form.moneyHint',
      },
      isActiveField,
    ],
  },

  products: {
    id: 'products',
    model: 'Product',
    group: 'catalog',
    navLabelKey: 'admin.nav.products',
    titleKey: 'admin.resources.products.title',
    subtitleKey: 'admin.resources.products.subtitle',
    view: 'catalog.view',
    edit: 'catalog.edit',
    primaryField: 'title',
    statusFilter: 'active',
    searchable: true,
    creatable: true,
    deletable: true,
    columns: [
      { key: 'title', labelKey: 'admin.fields.title', kind: 'text' },
      { key: 'categoryName', labelKey: 'admin.fields.category', kind: 'text' },
      { key: 'basePrice', labelKey: 'admin.fields.basePrice', kind: 'money' },
      { key: 'variantCount', labelKey: 'admin.fields.variant', kind: 'number', secondary: true },
      { key: 'stock', labelKey: 'admin.fields.stock', kind: 'number' },
      { key: 'isActive', labelKey: 'admin.fields.isActive', kind: 'bool' },
      updatedAtColumn,
    ],
    fields: [
      slugField,
      {
        name: 'categoryId',
        labelKey: 'admin.fields.category',
        kind: 'relation',
        relation: 'categories',
        required: true,
      },
      { name: 'brand', labelKey: 'admin.fields.brand', kind: 'text' },
      { name: 'title', labelKey: 'admin.fields.title', kind: 'text', required: true, localized: true },
      {
        name: 'description',
        labelKey: 'admin.fields.description',
        kind: 'textarea',
        required: true,
        localized: true,
        rows: 5,
        full: true,
      },
      {
        name: 'basePrice',
        labelKey: 'admin.fields.basePrice',
        kind: 'money',
        required: true,
        hintKey: 'admin.form.moneyHint',
      },
      isActiveField,
    ],
  },

  categories: {
    id: 'categories',
    model: 'ProductCategory',
    group: 'catalog',
    navLabelKey: 'admin.nav.categories',
    titleKey: 'admin.resources.categories.title',
    subtitleKey: 'admin.resources.categories.subtitle',
    view: 'catalog.view',
    edit: 'catalog.edit',
    primaryField: 'name',
    statusFilter: 'active',
    searchable: true,
    creatable: true,
    deletable: true,
    navHidden: true,
    columns: [
      { key: 'name', labelKey: 'admin.fields.name', kind: 'text' },
      { key: 'parentName', labelKey: 'admin.fields.parentCategory', kind: 'text' },
      { key: 'productCount', labelKey: 'admin.fields.product', kind: 'number' },
      { key: 'sortOrder', labelKey: 'admin.fields.sortOrder', kind: 'number', secondary: true },
      { key: 'isActive', labelKey: 'admin.fields.isActive', kind: 'bool' },
    ],
    fields: [
      slugField,
      { name: 'name', labelKey: 'admin.fields.name', kind: 'text', required: true, localized: true },
      {
        name: 'parentId',
        labelKey: 'admin.fields.parentCategory',
        kind: 'relation',
        relation: 'categories',
      },
      sortOrderField,
      isActiveField,
    ],
  },

  variants: {
    id: 'variants',
    model: 'ProductVariant',
    group: 'catalog',
    navLabelKey: 'admin.nav.variants',
    titleKey: 'admin.resources.variants.title',
    subtitleKey: 'admin.resources.variants.subtitle',
    view: 'catalog.view',
    edit: 'inventory.adjust',
    primaryField: 'sku',
    statusFilter: 'active',
    searchable: true,
    creatable: true,
    deletable: true,
    navHidden: true,
    parent: { resource: 'products', field: 'productId' },
    columns: [
      { key: 'sku', labelKey: 'admin.fields.sku', kind: 'text' },
      { key: 'productName', labelKey: 'admin.fields.product', kind: 'text' },
      { key: 'size', labelKey: 'admin.fields.size', kind: 'text', secondary: true },
      { key: 'color', labelKey: 'admin.fields.color', kind: 'text', secondary: true },
      { key: 'price', labelKey: 'admin.fields.price', kind: 'money' },
      { key: 'stock', labelKey: 'admin.fields.stock', kind: 'number' },
      { key: 'reserved', labelKey: 'admin.fields.reserved', kind: 'number', secondary: true },
      { key: 'isActive', labelKey: 'admin.fields.isActive', kind: 'bool' },
    ],
    fields: [
      {
        name: 'productId',
        labelKey: 'admin.fields.product',
        kind: 'relation',
        relation: 'products',
        required: true,
      },
      { name: 'sku', labelKey: 'admin.fields.sku', kind: 'text', required: true },
      { name: 'size', labelKey: 'admin.fields.size', kind: 'text' },
      { name: 'color', labelKey: 'admin.fields.color', kind: 'text' },
      {
        name: 'price',
        labelKey: 'admin.fields.price',
        kind: 'money',
        required: true,
        hintKey: 'admin.form.moneyHint',
      },
      { name: 'compareAtPrice', labelKey: 'admin.fields.compareAtPrice', kind: 'money' },
      { name: 'stock', labelKey: 'admin.fields.stock', kind: 'number', required: true, min: 0, max: 100_000 },
      { name: 'weightGrams', labelKey: 'admin.fields.weightGrams', kind: 'number', min: 0, max: 50_000 },
      isActiveField,
    ],
  },

  events: {
    id: 'events',
    model: 'Event',
    group: 'catalog',
    navLabelKey: 'admin.nav.events',
    titleKey: 'admin.resources.events.title',
    subtitleKey: 'admin.resources.events.subtitle',
    view: 'catalog.view',
    edit: 'catalog.edit',
    publish: 'catalog.publish',
    primaryField: 'title',
    statusFilter: 'published',
    searchable: true,
    creatable: true,
    deletable: true,
    columns: [
      { key: 'title', labelKey: 'admin.fields.title', kind: 'text' },
      { key: 'type', labelKey: 'admin.fields.type', kind: 'text' },
      { key: 'startsAt', labelKey: 'admin.fields.startsAt', kind: 'datetime' },
      { key: 'price', labelKey: 'admin.fields.price', kind: 'money' },
      { key: 'capacity', labelKey: 'admin.fields.capacity', kind: 'number', secondary: true },
      { key: 'bookedCount', labelKey: 'admin.fields.bookedCount', kind: 'number', secondary: true },
      { key: 'isPublished', labelKey: 'admin.fields.isPublished', kind: 'bool' },
    ],
    fields: [
      slugField,
      { name: 'type', labelKey: 'admin.fields.type', kind: 'select', options: eventTypeOptions, required: true },
      { name: 'title', labelKey: 'admin.fields.title', kind: 'text', required: true, localized: true },
      {
        name: 'description',
        labelKey: 'admin.fields.description',
        kind: 'textarea',
        required: true,
        localized: true,
        rows: 5,
        full: true,
      },
      { name: 'style', labelKey: 'admin.fields.style', kind: 'select', options: styleOptions },
      { name: 'level', labelKey: 'admin.fields.level', kind: 'select', options: levelOptions, required: true },
      {
        name: 'instructorId',
        labelKey: 'admin.fields.instructor',
        kind: 'relation',
        relation: 'instructors',
      },
      { name: 'venueId', labelKey: 'admin.fields.venue', kind: 'relation', relation: 'venues' },
      { name: 'locationName', labelKey: 'admin.fields.locationName', kind: 'text' },
      { name: 'startsAt', labelKey: 'admin.fields.startsAt', kind: 'datetime', required: true },
      { name: 'endsAt', labelKey: 'admin.fields.endsAt', kind: 'datetime', required: true },
      {
        name: 'price',
        labelKey: 'admin.fields.price',
        kind: 'money',
        hintKey: 'admin.form.moneyHint',
        dbDefault: true,
      },
      { name: 'capacity', labelKey: 'admin.fields.capacity', kind: 'number', required: true, min: 1, max: 5_000 },
      { name: 'isPublished', labelKey: 'admin.fields.isPublished', kind: 'switch' },
    ],
  },

  courses: {
    id: 'courses',
    model: 'Course',
    group: 'catalog',
    navLabelKey: 'admin.nav.courses',
    titleKey: 'admin.resources.courses.title',
    subtitleKey: 'admin.resources.courses.subtitle',
    view: 'catalog.view',
    edit: 'catalog.edit',
    publish: 'catalog.publish',
    primaryField: 'title',
    statusFilter: 'published',
    searchable: true,
    creatable: true,
    deletable: true,
    columns: [
      { key: 'title', labelKey: 'admin.fields.title', kind: 'text' },
      { key: 'instructorName', labelKey: 'admin.fields.instructor', kind: 'text' },
      { key: 'lessonCount', labelKey: 'admin.nav.lessons', kind: 'number' },
      { key: 'totalMinutes', labelKey: 'admin.fields.totalMinutes', kind: 'number', secondary: true },
      { key: 'price', labelKey: 'admin.fields.price', kind: 'money' },
      { key: 'isPublished', labelKey: 'admin.fields.isPublished', kind: 'bool' },
    ],
    fields: [
      slugField,
      {
        name: 'instructorId',
        labelKey: 'admin.fields.instructor',
        kind: 'relation',
        relation: 'instructors',
        required: true,
      },
      { name: 'title', labelKey: 'admin.fields.title', kind: 'text', required: true, localized: true },
      {
        name: 'description',
        labelKey: 'admin.fields.description',
        kind: 'textarea',
        required: true,
        localized: true,
        rows: 5,
        full: true,
      },
      { name: 'style', labelKey: 'admin.fields.style', kind: 'select', options: styleOptions, required: true },
      { name: 'level', labelKey: 'admin.fields.level', kind: 'select', options: levelOptions, required: true },
      {
        name: 'price',
        labelKey: 'admin.fields.price',
        kind: 'money',
        required: true,
        hintKey: 'admin.form.moneyHint',
      },
      {
        name: 'requirements',
        labelKey: 'admin.fields.requirements',
        kind: 'list',
        hintKey: 'admin.form.listHint',
        full: true,
      },
      { name: 'isPublished', labelKey: 'admin.fields.isPublished', kind: 'switch' },
    ],
  },

  lessons: {
    id: 'lessons',
    model: 'CourseLesson',
    group: 'catalog',
    navLabelKey: 'admin.nav.lessons',
    titleKey: 'admin.resources.lessons.title',
    subtitleKey: 'admin.resources.lessons.subtitle',
    view: 'catalog.view',
    edit: 'catalog.edit',
    primaryField: 'title',
    statusFilter: 'none',
    searchable: true,
    creatable: true,
    deletable: true,
    navHidden: true,
    parent: { resource: 'courses', field: 'courseId' },
    columns: [
      { key: 'sortOrder', labelKey: 'admin.fields.sortOrder', kind: 'number' },
      { key: 'title', labelKey: 'admin.fields.title', kind: 'text' },
      { key: 'courseName', labelKey: 'admin.fields.course', kind: 'text' },
      { key: 'durationMinutes', labelKey: 'admin.fields.durationMinutes', kind: 'number' },
      { key: 'isPreview', labelKey: 'admin.fields.isPreview', kind: 'bool' },
    ],
    fields: [
      {
        name: 'courseId',
        labelKey: 'admin.fields.course',
        kind: 'relation',
        relation: 'courses',
        required: true,
      },
      slugField,
      { name: 'title', labelKey: 'admin.fields.title', kind: 'text', required: true },
      { name: 'description', labelKey: 'admin.fields.description', kind: 'textarea', rows: 3, full: true },
      {
        name: 'durationMinutes',
        labelKey: 'admin.fields.durationMinutes',
        kind: 'number',
        required: true,
        min: 1,
        max: 600,
      },
      sortOrderField,
      { name: 'isPreview', labelKey: 'admin.fields.isPreview', kind: 'switch' },
    ],
  },

  'promo-codes': {
    id: 'promo-codes',
    model: 'PromoCode',
    group: 'money',
    navLabelKey: 'admin.nav.promoCodes',
    titleKey: 'admin.resources.promoCodes.title',
    subtitleKey: 'admin.resources.promoCodes.subtitle',
    view: 'promotions.view',
    edit: 'promotions.edit',
    primaryField: 'code',
    statusFilter: 'active',
    searchable: true,
    creatable: true,
    deletable: true,
    columns: [
      { key: 'code', labelKey: 'admin.fields.code', kind: 'text' },
      { key: 'type', labelKey: 'admin.fields.discountType', kind: 'text' },
      { key: 'value', labelKey: 'admin.fields.value', kind: 'number' },
      { key: 'usageCount', labelKey: 'admin.fields.usageCount', kind: 'number' },
      { key: 'usageLimit', labelKey: 'admin.fields.usageLimit', kind: 'number', secondary: true },
      { key: 'endsAt', labelKey: 'admin.fields.validUntil', kind: 'date' },
      { key: 'isActive', labelKey: 'admin.fields.isActive', kind: 'bool' },
    ],
    fields: [
      { name: 'code', labelKey: 'admin.fields.code', kind: 'text', required: true },
      {
        name: 'type',
        labelKey: 'admin.fields.discountType',
        kind: 'select',
        options: discountTypeOptions,
        required: true,
      },
      { name: 'value', labelKey: 'admin.fields.value', kind: 'number', required: true, min: 1, max: 1_000_000 },
      { name: 'minOrderTotal', labelKey: 'admin.fields.minOrderTotal', kind: 'money' },
      { name: 'maxDiscount', labelKey: 'admin.fields.maxDiscount', kind: 'money' },
      {
        name: 'appliesTo',
        labelKey: 'admin.fields.appliesTo',
        kind: 'multiselect',
        options: lineItemOptions,
        full: true,
      },
      { name: 'usageLimit', labelKey: 'admin.fields.usageLimit', kind: 'number', min: 1, max: 1_000_000 },
      { name: 'perUserLimit', labelKey: 'admin.fields.perUserLimit', kind: 'number', min: 1, max: 100, dbDefault: true },
      { name: 'startsAt', labelKey: 'admin.fields.validFrom', kind: 'date' },
      { name: 'endsAt', labelKey: 'admin.fields.validUntil', kind: 'date' },
      isActiveField,
    ],
  },

  'gift-cards': {
    id: 'gift-cards',
    model: 'GiftCard',
    group: 'money',
    navLabelKey: 'admin.nav.giftCards',
    titleKey: 'admin.resources.giftCards.title',
    subtitleKey: 'admin.resources.giftCards.subtitle',
    view: 'promotions.view',
    edit: 'giftCards.issue',
    primaryField: 'code',
    statusFilter: 'none',
    searchable: true,
    creatable: true,
    deletable: false,
    columns: [
      { key: 'code', labelKey: 'admin.fields.code', kind: 'text' },
      { key: 'initialAmount', labelKey: 'admin.fields.initialAmount', kind: 'money' },
      { key: 'balance', labelKey: 'admin.fields.balance', kind: 'money' },
      { key: 'recipientEmail', labelKey: 'admin.fields.recipientEmail', kind: 'text', secondary: true },
      { key: 'expiresAt', labelKey: 'admin.fields.expiresAt', kind: 'date' },
      { key: 'createdAt', labelKey: 'admin.fields.createdAt', kind: 'date', secondary: true },
    ],
    fields: [
      { name: 'code', labelKey: 'admin.fields.code', kind: 'text', required: true },
      {
        name: 'initialAmount',
        labelKey: 'admin.fields.initialAmount',
        kind: 'money',
        required: true,
        hintKey: 'admin.form.moneyHint',
      },
      { name: 'balance', labelKey: 'admin.fields.balance', kind: 'money', required: true },
      { name: 'recipientEmail', labelKey: 'admin.fields.recipientEmail', kind: 'email' },
      { name: 'message', labelKey: 'admin.fields.message', kind: 'textarea', rows: 3, full: true },
      { name: 'expiresAt', labelKey: 'admin.fields.expiresAt', kind: 'date', required: true },
    ],
  },

  media: {
    id: 'media',
    model: 'MediaAsset',
    group: 'catalog',
    navLabelKey: 'admin.nav.media',
    titleKey: 'admin.resources.media.title',
    subtitleKey: 'admin.resources.media.subtitle',
    view: 'catalog.view',
    edit: 'media.upload',
    remove: 'media.delete',
    primaryField: 'altText',
    statusFilter: 'none',
    searchable: true,
    /** Создаётся загрузкой файла, а не формой: у записи обязателен реальный файл. */
    creatable: false,
    deletable: true,
    columns: [
      { key: 'altText', labelKey: 'admin.fields.altText', kind: 'text' },
      { key: 'ownerLabel', labelKey: 'admin.media.ownerLabel', kind: 'text' },
      { key: 'mimeType', labelKey: 'admin.fields.mimeType', kind: 'text', secondary: true },
      { key: 'dimensions', labelKey: 'admin.fields.dimensions', kind: 'text', secondary: true },
      { key: 'bytes', labelKey: 'admin.fields.bytes', kind: 'number' },
      { key: 'createdAt', labelKey: 'admin.fields.createdAt', kind: 'date', secondary: true },
    ],
    fields: [
      {
        name: 'altText',
        labelKey: 'admin.fields.altText',
        kind: 'text',
        required: true,
        localized: true,
        hintKey: 'admin.media.altHint',
        full: true,
      },
      { name: 'focalPoint', labelKey: 'admin.fields.focalPoint', kind: 'text' },
      sortOrderField,
      { name: 'instructorId', labelKey: 'admin.fields.instructor', kind: 'relation', relation: 'instructors' },
      { name: 'venueId', labelKey: 'admin.fields.venue', kind: 'relation', relation: 'venues' },
      { name: 'roomId', labelKey: 'admin.fields.room', kind: 'relation', relation: 'rooms' },
      { name: 'classId', labelKey: 'admin.fields.class', kind: 'relation', relation: 'classes' },
      { name: 'productId', labelKey: 'admin.fields.product', kind: 'relation', relation: 'products' },
      { name: 'eventId', labelKey: 'admin.fields.event', kind: 'relation', relation: 'events' },
    ],
  },
};

/** Ресурсы в порядке объявления сегментов — для хабов и отчётов. */
export const orderedAdminResources: readonly AdminResourceSpec[] = adminResources.map(
  (id) => adminResourceSpecs[id],
);

/** Поля ресурса, у которых есть переводы. */
export function localizedFields(spec: AdminResourceSpec): readonly AdminFieldSpec[] {
  return spec.fields.filter((field) => field.localized === true);
}

/* ──────────────────────────────── Навигация ──────────────────────────────── */

export interface AdminNavItem {
  labelKey: MessageKey;
  href: string;
  /**
   * Право, без которого пункт не показывается. Скрытый пункт — не защита:
   * страница всё равно проверяет право сама. Но показывать поддержке раздел
   * выплат, который ответит отказом, — плохой интерфейс.
   */
  capability?: Capability;
}

export interface AdminNavGroupSpec {
  id: AdminNavGroup;
  labelKey: MessageKey;
  items: readonly AdminNavItem[];
}

/** Права, дающие доступ к разделу отчётов и экспорту. */
export const adminExportCapability: Capability = 'data.export';

/**
 * Порядок групп в сайдбаре — порядок рабочего дня: сводка, товар, операции,
 * деньги, люди, система. Алфавитный порядок здесь был бы честнее к глазу и
 * бесполезнее в работе.
 */
export const adminNavGroups: readonly AdminNavGroup[] = [
  'overview',
  'catalog',
  'operations',
  'money',
  'people',
  'system',
];

export const adminNavGroupLabelKey: Record<AdminNavGroup, MessageKey> = {
  overview: 'admin.groups.overview',
  catalog: 'admin.groups.catalog',
  operations: 'admin.groups.operations',
  money: 'admin.groups.money',
  people: 'admin.groups.people',
  system: 'admin.groups.system',
};


/**
 * Пункты сайдбара. Собираются из реестра плюс экраны со своей логикой —
 * заказы, брони, выплаты, модерация, люди, права, аудит, отчёты.
 *
 * Вложенные ресурсы (`navHidden`) в сайдбар не попадают: список залов открывают
 * от площадки, а не из общего меню. Их полный перечень — на хабе каталога.
 */
export const adminNavigation: readonly AdminNavGroupSpec[] = [
  {
    id: 'overview',
    labelKey: adminNavGroupLabelKey.overview,
    items: [{ labelKey: 'admin.nav.dashboard', href: routes.admin() }],
  },
  {
    id: 'catalog',
    labelKey: adminNavGroupLabelKey.catalog,
    items: orderedAdminResources
      .filter((spec) => spec.group === 'catalog' && spec.navHidden !== true)
      .map((spec) => ({
        labelKey: spec.navLabelKey,
        href: routes.adminResource(spec.id),
        capability: spec.view,
      })),
  },
  {
    id: 'operations',
    labelKey: adminNavGroupLabelKey.operations,
    items: [
      { labelKey: 'admin.nav.bookings', href: routes.adminBookings(), capability: 'bookings.view' },
      { labelKey: 'admin.nav.orders', href: routes.adminOrders(), capability: 'orders.view' },
      { labelKey: 'admin.nav.moderation', href: routes.adminModeration(), capability: 'reviews.moderate' },
    ],
  },
  {
    id: 'money',
    labelKey: adminNavGroupLabelKey.money,
    items: [
      { labelKey: 'admin.nav.payouts', href: routes.adminPayouts(), capability: 'payouts.view' },
      ...orderedAdminResources
        .filter((spec) => spec.group === 'money')
        .map((spec) => ({
          labelKey: spec.navLabelKey,
          href: routes.adminResource(spec.id),
          capability: spec.view,
        })),
      { labelKey: 'admin.nav.reports', href: routes.adminReports(), capability: 'reports.revenue' },
    ],
  },
  {
    id: 'people',
    labelKey: adminNavGroupLabelKey.people,
    items: [{ labelKey: 'admin.nav.users', href: routes.adminUsers(), capability: 'users.view' }],
  },
  {
    id: 'system',
    labelKey: adminNavGroupLabelKey.system,
    items: [
      { labelKey: 'admin.nav.settings', href: routes.adminSettings(), capability: 'settings.edit' },
      { labelKey: 'admin.nav.approvals', href: routes.adminApprovals(), capability: 'settings.edit' },
      { labelKey: 'admin.nav.auditLog', href: routes.adminAuditLog(), capability: 'audit.view' },
      /*
       * Корзина в системном разделе, а не в каталоге: она общая на все разделы
       * каталога, и повторять её в каждом значило бы предлагать четырнадцать
       * входов в одно место.
       */
      { labelKey: 'admin.nav.trash', href: routes.adminTrash(), capability: 'trash.view' },
    ],
  },
];


/* ───────────────────── Колонки операционных списков ─────────────────────
 *
 * Заказы, брони и выплаты не входят в реестр ресурсов: их не создают формой, у
 * них нет «полей записи» — есть состояние и история. Но таблица у них та же,
 * поэтому колонки описываются здесь, рядом с остальными, а не литералами в
 * страницах: подпись колонки «Итого» обязана быть одной и той же в заказах и в
 * отчётах.
 */

export const adminOrderColumns: readonly AdminColumnSpec[] = [
  { key: 'orderNumber', labelKey: 'admin.fields.orderNumber', kind: 'text' },
  { key: 'status', labelKey: 'admin.fields.status', kind: 'orderStatus' },
  { key: 'contactName', labelKey: 'admin.fields.customer', kind: 'text' },
  { key: 'itemCount', labelKey: 'admin.fields.quantity', kind: 'number', secondary: true },
  { key: 'total', labelKey: 'admin.fields.total', kind: 'money' },
  { key: 'placedAt', labelKey: 'admin.fields.createdAt', kind: 'datetime' },
  { key: 'paidAt', labelKey: 'admin.fields.paidAt', kind: 'datetime', secondary: true },
];

export const adminBookingColumns: readonly AdminColumnSpec[] = [
  { key: 'reference', labelKey: 'admin.fields.reference', kind: 'text' },
  { key: 'status', labelKey: 'admin.fields.status', kind: 'bookingStatus' },
  { key: 'customerName', labelKey: 'admin.fields.customer', kind: 'text' },
  { key: 'startsAt', labelKey: 'admin.fields.startsAt', kind: 'datetime' },
  { key: 'participants', labelKey: 'admin.fields.participants', kind: 'number', secondary: true },
  { key: 'totalPrice', labelKey: 'admin.fields.total', kind: 'money' },
];

export const adminPayoutColumns: readonly AdminColumnSpec[] = [
  { key: 'reference', labelKey: 'admin.fields.reference', kind: 'text' },
  { key: 'status', labelKey: 'admin.fields.status', kind: 'payoutStatus' },
  { key: 'recipient', labelKey: 'admin.fields.user', kind: 'text' },
  { key: 'accountMasked', labelKey: 'admin.fields.provider', kind: 'text', secondary: true },
  { key: 'amount', labelKey: 'admin.fields.amount', kind: 'money' },
  { key: 'periodEnd', labelKey: 'admin.fields.periodEnd', kind: 'date' },
  { key: 'processedAt', labelKey: 'admin.fields.paidAt', kind: 'datetime', secondary: true },
];

export const adminUserColumns: readonly AdminColumnSpec[] = [
  { key: 'name', labelKey: 'admin.fields.name', kind: 'text' },
  { key: 'email', labelKey: 'admin.fields.email', kind: 'text' },
  { key: 'role', labelKey: 'admin.fields.role', kind: 'role' },
  { key: 'isActive', labelKey: 'admin.fields.isActive', kind: 'bool' },
  { key: 'createdAt', labelKey: 'admin.fields.createdAt', kind: 'date', secondary: true },
  { key: 'lastSeenAt', labelKey: 'admin.fields.lastSeenAt', kind: 'datetime', secondary: true },
];

export const adminAuditColumns: readonly AdminColumnSpec[] = [
  { key: 'createdAt', labelKey: 'admin.fields.createdAt', kind: 'datetime' },
  { key: 'actorEmail', labelKey: 'admin.fields.actor', kind: 'text' },
  { key: 'action', labelKey: 'admin.fields.action', kind: 'text' },
  { key: 'entityType', labelKey: 'admin.fields.entityType', kind: 'text' },
  { key: 'entityId', labelKey: 'admin.fields.entityId', kind: 'text', secondary: true },
  { key: 'ipAddress', labelKey: 'admin.fields.ipAddress', kind: 'text', secondary: true },
];
