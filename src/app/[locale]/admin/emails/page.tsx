/**
 * ADMIN EMAILS — E-02: предпросмотр уведомлений на трёх языках и тестовая отправка.
 *
 * Превью собирается тем же кодом, что и письмо пользователю (`buildPreview` →
 * `renderEmailHtml`). HTML показывается в iframe без скриптов (`sandbox=""`).
 * Доступ — `settings.edit`, как у страницы интеграций.
 */

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { EmailTestSendButton } from '@/components/admin/email-test-send-button';
import { AccessDenied } from '@/components/ui/access-denied';
import { routes } from '@/config';
import { isNotificationType, notificationTypes, type NotificationType } from '@/config/notifications';
import { isLocale, localeMeta, locales, type Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { renderEmailHtml } from '@/lib/email/send';
import { buildPreview } from '@/lib/notifications/preview';
import { cn } from '@/lib/utils';
import { adminAccess } from '@/server/admin/access';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Ключи подписей в `admin.emails.types`: точка в ключе вложенного объекта не работает. */
const typeLabelKeys = {
  'booking.confirmed': 'bookingConfirmed',
  'booking.reminder': 'bookingReminder',
  'booking.cancelled': 'bookingCancelled',
  'booking.requestDue': 'bookingRequestDue',
  'waitlist.ready': 'waitlistReady',
  'cart.abandoned': 'cartAbandoned',
  'onboarding.welcome': 'onboardingWelcome',
  'onboarding.howToBook': 'onboardingHowToBook',
  'onboarding.bonus': 'onboardingBonus',
  'savedSearch.match': 'savedSearchMatch',
} as const satisfies Record<NotificationType, string>;

function chipClass(active: boolean): string {
  return cn(
    'text-button rounded-full px-4 py-2 transition-colors duration-fast',
    active ? 'bg-accent text-content-on-accent' : 'bg-surface-sunken text-content-secondary hover:text-content-primary',
  );
}

export default async function AdminEmailsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const { can } = await adminAccess();
  if (!can('settings.edit')) return <AccessDenied />;

  const query = await searchParams;
  const rawType = query.type;
  const type: NotificationType =
    typeof rawType === 'string' && isNotificationType(rawType) ? rawType : notificationTypes[0];
  const rawLang = query.lang;
  const lang: Locale = typeof rawLang === 'string' && isLocale(rawLang) ? rawLang : (locale as Locale);

  const t = await getTranslations({ locale: locale as Locale, namespace: 'admin.emails' });
  const content = await buildPreview(type, lang);
  const html = await renderEmailHtml(content);

  return (
    <>
      <AdminPageHeader titleKey="admin.emails.title" subtitleKey="admin.emails.subtitle" />

      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <p className="text-caption text-content-tertiary">{t('typeLabel')}</p>
          <nav aria-label={t('typeLabel')} className="flex flex-wrap gap-2">
            {notificationTypes.map((item) => (
              <Link
                key={item}
                href={routes.adminEmails({ type: item, lang })}
                aria-current={item === type ? 'page' : undefined}
                className={chipClass(item === type)}
              >
                {t(`types.${typeLabelKeys[item]}`)}
              </Link>
            ))}
          </nav>
        </section>

        <section className="flex flex-col gap-2">
          <p className="text-caption text-content-tertiary">{t('localeLabel')}</p>
          <nav aria-label={t('localeLabel')} className="flex flex-wrap gap-2">
            {locales.map((item) => (
              <Link
                key={item}
                href={routes.adminEmails({ type, lang: item })}
                aria-current={item === lang ? 'page' : undefined}
                className={chipClass(item === lang)}
              >
                {localeMeta[item].nativeName}
              </Link>
            ))}
          </nav>
        </section>

        <article className="flex flex-col gap-4 rounded-lg border border-border-default bg-surface-card p-5">
          <div>
            <p className="text-caption text-content-tertiary">{t('subjectLabel')}</p>
            <p className="text-card-title text-content-primary">{content.subject}</p>
          </div>
          <p className="text-caption text-content-tertiary">{t('sample')}</p>
          <iframe
            title={content.subject}
            srcDoc={html}
            sandbox=""
            className="h-160 w-full rounded-md border border-border-default"
          />
          <EmailTestSendButton key={`${type}:${lang}`} type={type} locale={lang} />
        </article>

        <p className="text-caption text-content-tertiary">{t('scopeHint')}</p>
      </div>
    </>
  );
}
