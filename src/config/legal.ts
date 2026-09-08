/**
 * LEGAL — состав правовых документов платформы.
 *
 * Здесь нет ни строки самих документов: текст — контент и живёт в каталоге
 * переводов (`legal.documents.*`), как любой другой текст для пользователя.
 * Здесь только то, что должно быть машиночитаемым:
 *
 * **Состав и порядок разделов.** Страница `/legal/[slug]` не знает, из чего
 * состоит оферта: она берёт список разделов отсюда и просит у i18n заголовок и
 * текст каждого. Добавить раздел — значит добавить его id в один массив, и
 * TypeScript сразу потребует перевод во всех трёх локалях.
 *
 * **Версия и дата вступления в силу.** Согласие пользователя фиксируется вместе с
 * версией документа (`ConsentRecord`, D-03 в бэклоге): спор решается по той
 * редакции, которую человек принял, а не по текущей. Поэтому версия — данные, а
 * не подпись в подвале страницы.
 *
 * **Статус.** `draft` означает «текст написан нами и ждёт проверки юристом» —
 * задача 8.2 плана. Страница честно сообщает об этом вместо того, чтобы выглядеть
 * действующим документом. Смена статуса на `active` — правка одного поля, а не
 * поиск по разметке.
 *
 * Пути берутся из `routes`, а не собираются здесь: адрес документа объявлен в
 * одном месте на весь проект. Совпадение слага с путём проверяется тестом.
 */

import type { MessageKey } from '@/i18n/types';

import { routes } from './routes';

export const legalDocumentIds = [
  'terms',
  'privacy',
  'refundPolicy',
  'cancellationPolicy',
  'cookies',
  'communityGuidelines',
] as const;

export type LegalDocumentId = (typeof legalDocumentIds)[number];

/** Статус документа: черновик нашей редакции или проверенный юристом текст. */
export type LegalDocumentStatus = 'draft' | 'active';

export interface LegalDocumentSpec {
  id: LegalDocumentId;
  /** Последний сегмент адреса — параметр `[slug]`. */
  slug: string;
  /** Полный путь без префикса локали. Только из `routes`. */
  href: string;
  /** Ключ подписи в подвале и в списке документов (`footer.*`). */
  linkLabelKey: string;
  /**
   * Редакция документа. Меняется вместе с текстом — по ней фиксируется согласие
   * и по ней же решается, нужно ли просить согласие заново.
   */
  version: string;
  /** Дата вступления в силу, `YYYY-MM-DD`. Показывается как «обновлено». */
  effectiveDate: string;
  status: LegalDocumentStatus;
  /** Разделы в порядке отображения. Ключи текста — `legal.documents.<id>.sections.<section>`. */
  sections: readonly string[];
}

/**
 * Дата первой редакции.
 *
 * Одна константа на все документы: они написаны одновременно и заменяются
 * юристом тоже одновременно. Разные даты у документов одного пакета выглядят как
 * незаметная правка задним числом.
 */
const FIRST_EDITION = '2026-09-01';
const FIRST_VERSION = '0.9';

export const legalDocuments: readonly LegalDocumentSpec[] = [
  {
    id: 'terms',
    slug: 'terms',
    href: routes.terms(),
    linkLabelKey: 'footer.terms',
    version: FIRST_VERSION,
    effectiveDate: FIRST_EDITION,
    status: 'draft',
    sections: ['role', 'account', 'booking', 'payments', 'providers', 'conduct', 'liability', 'changes'],
  },
  {
    id: 'privacy',
    slug: 'privacy',
    href: routes.privacy(),
    linkLabelKey: 'footer.privacy',
    version: FIRST_VERSION,
    effectiveDate: FIRST_EDITION,
    status: 'draft',
    sections: ['controller', 'data', 'purposes', 'sharing', 'retention', 'rights', 'security', 'contact'],
  },
  {
    id: 'refundPolicy',
    slug: 'refund-policy',
    href: routes.refundPolicy(),
    linkLabelKey: 'footer.refundPolicy',
    version: FIRST_VERSION,
    effectiveDate: FIRST_EDITION,
    status: 'draft',
    sections: ['scope', 'bookings', 'goods', 'giftCards', 'method', 'disputes'],
  },
  {
    id: 'cancellationPolicy',
    slug: 'cancellation-policy',
    href: routes.cancellationPolicy(),
    linkLabelKey: 'footer.cancellationPolicy',
    version: FIRST_VERSION,
    effectiveDate: FIRST_EDITION,
    status: 'draft',
    sections: ['window', 'late', 'noShow', 'reschedule', 'providerCancels', 'rentals'],
  },
  {
    id: 'cookies',
    slug: 'cookies',
    href: routes.cookiePolicy(),
    linkLabelKey: 'footer.cookies',
    version: FIRST_VERSION,
    effectiveDate: FIRST_EDITION,
    status: 'draft',
    sections: ['what', 'essential', 'analytics', 'thirdParty', 'control'],
  },
  {
    id: 'communityGuidelines',
    slug: 'community-guidelines',
    href: routes.communityGuidelines(),
    linkLabelKey: 'footer.communityGuidelines',
    version: FIRST_VERSION,
    effectiveDate: FIRST_EDITION,
    status: 'draft',
    sections: ['respect', 'reviews', 'safety', 'offPlatform', 'enforcement'],
  },
];

export function legalDocumentBySlug(slug: string): LegalDocumentSpec | undefined {
  return legalDocuments.find((document) => document.slug === slug);
}

/** Слаги для `generateStaticParams`. */
export const legalDocumentSlugs: readonly string[] = legalDocuments.map((document) => document.slug);

/* ─────────────────────────── Ключи перевода ───────────────────────────
 *
 * Заголовок и вступление типизированы `MessageKey`: id документа — литеральный
 * union, и компилятор проверяет ключ целиком.
 *
 * У разделов так не получается: id раздела приходит из массива `sections`, то
 * есть это `string`, и шаблон `…sections.${string}.title` компилятор проверить не
 * может. Сделать `sections` литеральным кортежем на документ и связать его с id
 * внутри одного объекта TypeScript тоже не даёт — это корреляция полей union'а.
 * Поэтому здесь единственное приведение в модуле, и за ним стоит тест
 * `src/config/legal.test.ts`: он обходит все документы × разделы × три локали и
 * падает, если ключа нет. Проверка та же по силе, только выполняется в CI, а не
 * компилятором.
 */

export function legalDocumentTitleKey(id: LegalDocumentId): MessageKey {
  return `legal.documents.${id}.title`;
}

export function legalDocumentIntroKey(id: LegalDocumentId): MessageKey {
  return `legal.documents.${id}.intro`;
}

export function legalSectionTitleKey(id: LegalDocumentId, section: string): MessageKey {
  return `legal.documents.${id}.sections.${section}.title` as MessageKey;
}

export function legalSectionBodyKey(id: LegalDocumentId, section: string): MessageKey {
  return `legal.documents.${id}.sections.${section}.body` as MessageKey;
}
