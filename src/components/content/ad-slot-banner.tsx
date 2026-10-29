/**
 * РЕКЛАМНЫЙ СЛОТ — баннер рекламодателя в фиксированной точке страницы (DS-08).
 *
 * Подпись «Реклама» видна всегда: без неё блок читается как редакционный выбор
 * сайта. Если в точке нет действующего баннера, ничего не рисуется, и страница
 * выглядит так же, как без слота.
 *
 * Внешние ссылки помечаются `sponsored`: поисковик должен видеть их как оплаченные
 * и не передавать им вес страницы.
 */

import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

import { ContentSection } from '@/components/content/content-section';
import { Media } from '@/components/ui/media';
import type { AdSlotKey } from '@/domain/ad-slot';
import { resolveMedia } from '@/domain/content';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { getAdSlotBanner } from '@/server/content/ad-slots';

interface AdSlotBannerProps {
  slotKey: AdSlotKey;
  locale: Locale;
}

const CARD = 'flex items-center gap-4 rounded-md border border-border-default p-4';

export async function AdSlotBanner({ slotKey, locale }: AdSlotBannerProps) {
  const banner = await getAdSlotBanner({ slotKey, locale });
  if (!banner) return null;

  const t = await getTranslations('advertise');
  const mediaProps = banner.image
    ? resolveMedia(banner.image, locale)
    : banner.imageKey
      ? { src: banner.imageKey, alt: banner.title }
      : null;

  return (
    <ContentSection spacing="tight">
      <aside aria-label={t('slotLabel')}>
        <p className="text-label text-content-secondary">{t('slotLabel')}</p>
        <div className="mt-3">
          <AdCard href={banner.href}>
            {mediaProps ? (
              <Media preset="avatar" className="size-16 shrink-0 rounded-md" {...mediaProps} />
            ) : null}
            <span className="text-body min-w-0 flex-1">{banner.title}</span>
          </AdCard>
        </div>
      </aside>
    </ContentSection>
  );
}

function AdCard({ href, children }: { href: string | null; children: ReactNode }) {
  if (!href) return <div className={CARD}>{children}</div>;

  if (/^https?:/i.test(href)) {
    return (
      <a href={href} className={CARD} target="_blank" rel="noopener noreferrer sponsored">
        {children}
      </a>
    );
  }

  if (/^(?:mailto|tel):/i.test(href)) {
    return (
      <a href={href} className={CARD}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={CARD}>
      {children}
    </Link>
  );
}
