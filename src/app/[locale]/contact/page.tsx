/**
 * CONTACT — связаться с нами.
 *
 * Форма и прямые адреса стоят рядом, а не вместо друг друга. Это не
 * перестраховка: пока почтовый провайдер не настроен (и всякий раз, когда он
 * откажет), форма честно скажет «не отправилось» — и человек должен видеть, куда
 * написать, не уходя со страницы.
 *
 * Пустые поля `site.contact` не рендерятся: телефон и мессенджеры появятся, когда
 * у платформы появится номер. Пустая строка вместо номера выглядит как ошибка
 * загрузки, а «уточняется» — как отписка.
 */

import type { Metadata } from 'next';
import { MailIcon, MapPinIcon, MessageCircleIcon, Share2Icon } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ContactForm } from '@/components/content/contact-form';
import { ContentSection } from '@/components/content/content-section';
import { PageHero, breadcrumbsFromTrail } from '@/components/layout/page-hero';
import { SiteFooter } from '@/components/layout/site-footer';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import type { Crumb } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'seo.contact' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.contact(),
    title: t('title'),
    description: t('description'),
  });
}

export default async function ContactPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations('contact');
  const tFooter = await getTranslations('footer');

  const trail: Crumb[] = [{ name: tFooter('contact'), path: routes.contact() }];

  return (
    <main id={site.mainContentId}>
      <PageHero
        title={t('title')}
        subtitle={t('subtitle')}
        eyebrow={t('eyebrow')}
        locale={locale as Locale}
        breadcrumbs={breadcrumbsFromTrail(trail)}
      />

      <ContentSection>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div>
            <h2 className="text-heading-3 mb-2">{t('form.title')}</h2>
            <p className="text-body-sm mb-8 text-content-tertiary">{t('responseTime')}</p>
            <ContactForm locale={locale as Locale} />
          </div>

          <aside className="flex flex-col gap-8 rounded-lg border border-border-default bg-surface-card p-6">
            <h2 className="text-eyebrow text-content-tertiary">{t('channels.title')}</h2>

            <Channel
              icon={<MailIcon aria-hidden className="size-5 text-content-accent" />}
              title={t('channels.generalTitle')}
              note={t('channels.generalNote')}
            >
              {/*
                `mailto:` — внешняя ссылка по смыслу, поэтому обычный `<a>`:
                локале-зависимый `Link` здесь только помешал бы.
              */}
              <a
                href={`mailto:${site.contact.email}`}
                className="text-body-sm text-content-accent underline"
              >
                {site.contact.email}
              </a>
            </Channel>

            <Channel
              icon={<MessageCircleIcon aria-hidden className="size-5 text-content-accent" />}
              title={t('channels.supportTitle')}
              note={t('channels.supportNote')}
            >
              <a
                href={`mailto:${site.contact.supportEmail}`}
                className="text-body-sm text-content-accent underline"
              >
                {site.contact.supportEmail}
              </a>
            </Channel>

            <Channel
              icon={<Share2Icon aria-hidden className="size-5 text-content-accent" />}
              title={t('channels.socialTitle')}
              note={t('channels.socialNote')}
            >
              <a
                href={site.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-body-sm text-content-accent underline"
              >
                {site.social.instagram.replace('https://', '')}
              </a>
            </Channel>

            <Channel
              icon={<MapPinIcon aria-hidden className="size-5 text-content-accent" />}
              title={t('channels.cityTitle')}
              note={t('channels.cityNote', { city: site.address.city })}
            />
          </aside>
        </div>
      </ContentSection>

      <SiteFooter />
    </main>
  );
}

/**
 * Канал связи: иконка, назначение и адрес.
 *
 * Заголовок объясняет, ЗАЧЕМ этот адрес: два почтовых ящика без объяснения
 * превращают выбор в лотерею, а обращение по брони уходит в партнёрскую почту.
 */
function Channel({
  icon,
  title,
  note,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  note: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <h3 className="text-body font-semibold">{title}</h3>
        <p className="text-caption mt-1 text-content-tertiary">{note}</p>
        {children !== undefined && <p className="mt-2 break-words">{children}</p>}
      </div>
    </div>
  );
}
