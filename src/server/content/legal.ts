import { getFormatter, getTranslations } from 'next-intl/server';

import {
  booking,
  commerce,
  commission,
  dataRetention,
  legalDocuments,
  legalDocumentIntroKey,
  legalDocumentTitleKey,
  legalSectionBodyKey,
  legalSectionTitleKey,
  promotions,
  site,
  tax,
  venue,
  type LegalDocumentId,
  type LegalDocumentSpec,
  type LegalDocumentStatus,
} from '@/config';
import type { Locale } from '@/i18n/config';

export interface LegalDocumentSummary {
  id: LegalDocumentId;
  slug: string;
  path: string;
  title: string;
  version: string;
  status: LegalDocumentStatus;
}

export interface LegalSection {
  id: string;
  title: string;
  body: string;
}

export interface LegalDocumentContent {
  id: LegalDocumentId;
  slug: string;
  path: string;
  title: string;
  intro: string;
  status: LegalDocumentStatus;
  draftNotice: string | null;
  version: string;
  lastUpdated: string;
  versionNote: string;
  contactNote: string;
  tocTitle: string;
  documentsTitle: string;
  sections: LegalSection[];
  others: LegalDocumentSummary[];
}

export interface LegalIndexContent {
  title: string;
  documents: LegalDocumentSummary[];
}

function summarize(entry: LegalDocumentSpec, title: string): LegalDocumentSummary {
  return {
    id: entry.id,
    slug: entry.slug,
    path: entry.href,
    title,
    version: entry.version,
    status: entry.status,
  };
}

/** Список документов для экрана «Правовое». */
export async function buildLegalIndex(locale: Locale): Promise<LegalIndexContent> {
  const t = await getTranslations({ locale });

  return {
    title: t('legal.documentsTitle'),
    documents: legalDocuments.map((entry) => summarize(entry, t(legalDocumentTitleKey(entry.id)))),
  };
}

/**
 * Текст одного документа. Числа в тексте подставляются из бизнес-правил: одна точка на
 * все разделы, лишние аргументы ICU игнорирует.
 */
export async function buildLegalDocumentContent(
  locale: Locale,
  document: LegalDocumentSpec,
): Promise<LegalDocumentContent> {
  const t = await getTranslations({ locale });
  const format = await getFormatter({ locale });

  const values = {
    brand: t('brand.name'),
    legalEntity: site.legalEntity,
    city: site.address.city,
    country: site.address.countryName,
    supportEmail: site.contact.supportEmail,
    legalEmail: site.contact.legalEmail,

    vatRate: format.number(tax.vatRate, 'percent'),
    instructorRate: format.number(commission.instructorRate, 'percent'),
    venueRate: format.number(commission.venueRate, 'percent'),
    lateFeeRate: format.number(booking.lateCancellationFeeRate, 'percent'),

    freeCancellationHours: t('common.units.hours', { count: booking.freeCancellationHours }),
    freeRescheduleHours: t('common.units.hours', { count: booking.freeRescheduleHours }),
    venueCancellationHours: t('common.units.hours', { count: venue.freeCancellationHours }),
    maxReschedules: booking.maxReschedulesPerBooking,
    minRentalMinutes: t('common.units.minutes', { count: venue.minRentalMinutes }),

    returnWindowDays: t('common.units.days', { count: commerce.returnWindowDays }),
    giftCardMonths: t('common.units.months', { count: promotions.giftCard.validityMonths }),

    accountDeletionDays: t('common.units.days', { count: dataRetention.accountDeletionGraceDays }),
    financialYears: t('common.units.years', { count: dataRetention.financialRecordsYears }),
    analyticsDays: t('common.units.days', { count: dataRetention.analyticsRawEventRetentionDays }),
  };

  const effectiveDate = format.dateTime(new Date(document.effectiveDate), 'mediumDate');

  return {
    id: document.id,
    slug: document.slug,
    path: document.href,
    title: t(legalDocumentTitleKey(document.id)),
    intro: t(legalDocumentIntroKey(document.id), values),
    status: document.status,
    draftNotice: document.status === 'draft' ? t('legal.draftNotice') : null,
    version: document.version,
    lastUpdated: t('legal.lastUpdated', { date: effectiveDate }),
    versionNote: t('legal.versionNote', { version: document.version, date: effectiveDate }),
    contactNote: t('legal.contactNote', { email: site.contact.legalEmail }),
    tocTitle: t('legal.tocTitle'),
    documentsTitle: t('legal.documentsTitle'),
    sections: document.sections.map((section) => ({
      id: section,
      title: t(legalSectionTitleKey(document.id, section)),
      body: t(legalSectionBodyKey(document.id, section), values),
    })),
    others: legalDocuments
      .filter((entry) => entry.id !== document.id)
      .map((entry) => summarize(entry, t(legalDocumentTitleKey(entry.id)))),
  };
}
