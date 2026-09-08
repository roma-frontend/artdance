/**
 * LEGAL DOCUMENT — оферта, политики и правила одним шаблоном.
 *
 * Шесть документов различаются только текстом, поэтому вёрстка у них общая, а
 * состав разделов приходит из `config/legal.ts`. Три вещи здесь не косметические.
 *
 * **Числа в документах — из бизнес-правил, а не из текста.** Окно бесплатной
 * отмены, ставка удержания, комиссия, НДС, сроки хранения данных подставляются
 * плейсхолдерами. Иначе «поменяйте окно отмены с 24 на 12 часов» превращается в
 * правку шести переводов на трёх языках — и однажды в политике возврата останется
 * старая цифра, по которой клиент будет прав в споре.
 *
 * **Все значения передаются каждому разделу.** ICU игнорирует лишние аргументы,
 * поэтому один объект на документ надёжнее, чем попытка угадать, какому разделу
 * какие числа нужны: добавленный в перевод плейсхолдер иначе падает в рантайме на
 * `MISSING_VALUE` — и именно в правовом документе, где ошибку никто не ждёт.
 *
 * **Статус черновика виден.** Пока текст не проверен юристом (задача 8.2 плана),
 * страница говорит об этом прямо. Документ, который выглядит действующим, но не
 * проверен, хуже отсутствующего: на него начинают ссылаться.
 */

import { useFormatter, useTranslations } from 'next-intl';

import { Reveal } from '@/components/fx/reveal';
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
  type LegalDocumentSpec,
} from '@/config';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

interface LegalDocumentProps {
  document: LegalDocumentSpec;
}

export function LegalDocument({ document }: LegalDocumentProps) {
  const t = useTranslations();
  const tLegal = useTranslations('legal');
  const format = useFormatter();

  /**
   * Значения для подстановки в текст документа.
   *
   * Единый объект на все разделы: см. шапку файла. Единицы («24 часа», «14 дней»)
   * собираются через ICU-плюрализацию каталога, а не склейкой числа со словом —
   * в армянском и русском форма слова зависит от числа.
   */
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
  const others = legalDocuments.filter((entry) => entry.id !== document.id);

  return (
    <div className="page-container section-y grid gap-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <article className="max-w-(--layout-prose-max-width)">
        {document.status === 'draft' && (
          /*
           * `role="note"` вместо `alert`: предупреждение не требует немедленной
           * реакции, а `alert` перебивает чтение страницы скринридером.
           */
          <p
            role="note"
            className="text-body-sm mb-8 rounded-md border border-border-strong bg-surface-sunken p-4 text-content-secondary"
          >
            {tLegal('draftNotice')}
          </p>
        )}

        <p className="text-body-lg text-content-secondary">
          {t(legalDocumentIntroKey(document.id), values)}
        </p>

        <div className="mt-12 flex flex-col gap-10">
          {document.sections.map((section) => (
            <Reveal key={section} as="section" id={section} className="scroll-mt-(--layout-nav-height)">
              <h2 className="text-heading-3">{t(legalSectionTitleKey(document.id, section))}</h2>
              <p className="text-body mt-3 text-content-secondary">
                {t(legalSectionBodyKey(document.id, section), values)}
              </p>
            </Reveal>
          ))}
        </div>

        <p className="text-body-sm mt-12 border-t border-border-default pt-6 text-content-tertiary">
          {tLegal('contactNote', { email: site.contact.legalEmail })}
        </p>
      </article>

      {/*
        Оглавление и список документов — рядом с текстом на широком экране и над
        ним на узком. Документы длинные, и без оглавления «где тут про возврат»
        решается прокруткой.

        Два `<nav>`, а не один: «в этом документе» и «все документы» — разные
        навигационные блоки, и у каждого должно быть своё доступное имя. В одном
        общем `<nav>` скринридер объявляет одиннадцать ссылок под заголовком
        «Содержание», из которых половина ведёт на другие страницы.
      */}
      <div className="lg:sticky lg:top-(--layout-nav-height) flex flex-col gap-8 lg:order-last">
        <nav aria-label={tLegal('tocTitle')}>
          <h2 className="text-eyebrow mb-3 text-content-tertiary">{tLegal('tocTitle')}</h2>
          <ul className="flex flex-col gap-2 border-s border-border-default ps-4">
            {document.sections.map((section) => (
              <li key={section}>
                <a
                  href={`#${section}`}
                  className="text-body-sm text-content-secondary transition-colors duration-normal ease-brand hover:text-content-accent"
                >
                  {t(legalSectionTitleKey(document.id, section))}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={tLegal('documentsTitle')}>
          <h2 className="text-eyebrow mb-3 text-content-tertiary">{tLegal('documentsTitle')}</h2>
          <ul className="flex flex-col gap-2">
            {others.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={entry.href}
                  className={cn(
                    'text-body-sm text-content-secondary',
                    'transition-colors duration-normal ease-brand hover:text-content-accent',
                  )}
                >
                  {t(legalDocumentTitleKey(entry.id))}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p className="text-caption text-content-tertiary">
          {tLegal('versionNote', { version: document.version, date: effectiveDate })}
        </p>
      </div>
    </div>
  );
}
