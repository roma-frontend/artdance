/**
 * АДМИНСКИЙ ПРОМО-БАННЕР — первый активный баннер из CMS над публичными
 * страницами.
 *
 * Здесь нет рекламного текста и пути к картинке: всё приходит из `Banner` и
 * `MediaAsset`. Администратор создаёт запись в `/admin/banners`, включает её,
 * при необходимости загружает фон и указывает ссылку. После сохранения тег
 * `content:banners` обновляется server action-ом, поэтому production не требует
 * пересборки.
 */

import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

import { AnnouncementBarDismiss } from '@/components/layout/announcement-bar-dismiss';
import { Media } from '@/components/ui/media';
import { resolveMedia } from '@/domain/content';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { getLiveBanners, type LiveBanner } from '@/server/content/banners';

interface AnnouncementBarProps {
  locale: Locale;
}

export async function AnnouncementBar({ locale }: AnnouncementBarProps) {
  const banner = (await getLiveBanners())[0];
  if (!banner) return null;
  const t = await getTranslations('common');

  return (
    <AnnouncementBarDismiss bannerKey={banner.key}>
      <div className="relative min-h-52 md:min-h-64">
        <BannerBackdrop banner={banner} locale={locale} />
        <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-r from-surface-cinema via-surface-cinema/80 to-surface-cinema/25" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-t from-surface-cinema/95 via-transparent to-surface-cinema/25" />

        <div className="page-container relative z-10 flex min-h-52 items-end py-8 pr-16 md:min-h-64 md:py-10 md:pr-24">
          <BannerContent banner={banner} linkLabel={t('actions.viewDetails')} />
        </div>
      </div>
    </AnnouncementBarDismiss>
  );
}

function BannerBackdrop({ banner, locale }: { banner: LiveBanner; locale: Locale }) {
  if (banner.image) {
    return (
      <Media
        {...resolveMedia(banner.image, locale)}
        preset="heroFullBleed"
        fill
        priority
        className="absolute inset-0 -z-20 size-full"
        imageClassName="brightness-[0.55] saturate-[0.85]"
      />
    );
  }

  /* Старые записи могли хранить картинку прямо в imageKey. */
  if (banner.imageKey) {
    return (
      <Media
        src={banner.imageKey}
        alt={banner.title}
        preset="heroFullBleed"
        fill
        priority
        className="absolute inset-0 -z-20 size-full"
        imageClassName="brightness-[0.55] saturate-[0.85]"
      />
    );
  }

  return null;
}

function BannerContent({ banner, linkLabel }: { banner: LiveBanner; linkLabel: string }) {
  const content = (
    <span className="group/banner block max-w-3xl">
      <span aria-hidden className="mb-4 block h-px w-12 bg-metal md:mb-5 md:w-16" />
      <span className="text-heading-2 block text-content-on-cinema transition-colors duration-normal ease-brand group-hover/banner:text-accent md:text-heading-1">
        {banner.title}
      </span>
      {banner.href ? (
        <span className="text-body-sm mt-4 inline-flex items-center gap-2 text-content-on-cinema-muted transition-colors duration-normal ease-brand group-hover/banner:text-content-on-cinema">
          <span className="underline decoration-border-on-cinema underline-offset-4">{linkLabel}</span>
          <span aria-hidden="true">→</span>
        </span>
      ) : null}
    </span>
  );

  if (!banner.href) return content;

  return <BannerHref href={banner.href}>{content}</BannerHref>;
}

function BannerHref({ href, children }: { href: string; children: ReactNode }) {
  if (/^(?:https?:|mailto:|tel:)/i.test(href)) {
    return (
      <a href={href} target={/^https?:/i.test(href) ? '_blank' : undefined} rel={/^https?:/i.test(href) ? 'noreferrer' : undefined}>
        {children}
      </a>
    );
  }

  return <Link href={href}>{children}</Link>;
}
