/**
 * АДМИНСКИЙ ПРОМО-БАННЕР — плавающая полоса, которая ждёт первого экрана.
 *
 * Текст приходит из `Banner`: администратор создаёт запись в `/admin/banners`,
 * включает её, задаёт заголовок и ссылку. После сохранения тег
 * `content:banners` обновляется server action-ом, поэтому production не требует
 * пересборки.
 *
 * **Почему полоса не в первой секции.** Главная открывается кинематографичным
 * первым экраном во всю высоту окна с видео. Любая полоса над ним занимает его
 * место и «отрезает» кадр. Поэтому баннер вынесен из потока на самый низ окна и
 * появляется только тогда, когда hero уже прокручен (логика — в
 * `announcement-bar-dismiss.tsx`). На первом экране разметки баннера в потоке нет
 * вовсе: видео остаётся на всю высоту.
 *
 * Форма — не кадр и не бегущая строка, а компактная карточка: точка-маркер,
 * заголовок, подпись «View details» со стрелкой и кнопка закрытия. Так промо
 * читается как уведомление поверх страницы, а не как ещё одна секция.
 */

import { getTranslations } from 'next-intl/server';

import { AnnouncementBarDismiss } from '@/components/layout/announcement-bar-dismiss';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { getLiveBanners, type LiveBanner } from '@/server/content/banners';

interface AnnouncementBarProps {
  locale: Locale;
}

export async function AnnouncementBar({ locale }: AnnouncementBarProps) {
  const banner = (await getLiveBanners(locale))[0];
  if (!banner) return null;
  const t = await getTranslations('common');

  return (
    <AnnouncementBarDismiss bannerKey={banner.key}>
      <BannerContent banner={banner} linkLabel={t('actions.viewDetails')} />
    </AnnouncementBarDismiss>
  );
}

function BannerContent({ banner, linkLabel }: { banner: LiveBanner; linkLabel: string }) {
  const inner = (
    <>
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-metal" />
      <span className="text-body-sm min-w-0 truncate text-content-on-cinema">{banner.title}</span>
      {banner.href ? (
        <span className="text-label ml-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-metal-on-cinema uppercase transition-colors duration-normal ease-brand group-hover/banner:text-content-on-cinema">
          <span className="hidden sm:inline">{linkLabel}</span>
          <span aria-hidden className="transition-transform duration-normal ease-brand group-hover/banner:translate-x-0.5">
            →
          </span>
        </span>
      ) : null}
    </>
  );

  const className = 'group/banner flex min-w-0 flex-1 items-center gap-3';

  /* Ссылка на внешний ресурс — обычный `<a>`; внутренняя проходит через роутер. */
  if (banner.href && /^(?:https?:|mailto:|tel:)/i.test(banner.href)) {
    const external = /^https?:/i.test(banner.href);
    return (
      <a
        href={banner.href}
        className={className}
        target={external ? '_blank' : undefined}
        rel={external ? 'noreferrer' : undefined}
      >
        {inner}
      </a>
    );
  }

  if (!banner.href) return <span className={className}>{inner}</span>;

  return (
    <Link href={banner.href} className={className}>
      {inner}
    </Link>
  );
}
