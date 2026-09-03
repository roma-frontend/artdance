/**
 * SITE FOOTER — подвал с колонками ссылок, соцсетями и правовой строкой.
 *
 * Состав колонок объявлен данными (`footerNavGroups`), а не разметкой: раздел
 * выключенного модуля не попадает в подвал так же, как не попадает в шапку.
 * Пустая колонка не рендерится вовсе.
 *
 * Год в копирайте — из системного времени, а не литерал: подвал не должен
 * устаревать первого января. Соцсети берутся из `site.social`, и пустое значение
 * означает «ссылки нет», а не «ссылка ведёт в никуда».
 *
 * Соцсети подписаны названием, а не значком: в lucide 1.x брендовых иконок нет,
 * а рисовать их по памяти — верный способ получить искажённый чужой логотип.
 * Название платформы читается однозначно, переводится не нужно и не зависит от
 * набора иконок. Это единственные внешние ссылки в подвале, поэтому у них
 * `rel="noreferrer"` и предупреждение о новой вкладке для скринридера.
 */

import { useFormatter, useTranslations } from 'next-intl';

import { BrandMark } from '@/components/brand/brand-mark';
import { footerNavGroups, routes, site } from '@/config';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

type SocialKey = keyof typeof site.social;

/** Отображаемые названия платформ. Не переводятся: это имена собственные. */
const SOCIAL_LABELS: Record<SocialKey, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  facebook: 'Facebook',
};

export function SiteFooter() {
  const t = useTranslations();
  const format = useFormatter();

  const socials = (Object.keys(site.social) as SocialKey[]).filter(
    (key) => site.social[key].length > 0,
  );

  return (
    <footer className="border-t border-border-default bg-surface-raised">
      <div className="page-container section-y">
        <div className="grid gap-10 lg:grid-cols-[2fr_repeat(4,1fr)]">
          <div>
            <Link href={routes.home()} className="flex items-center gap-3">
              <BrandMark className="text-accent" />
              <span className="text-card-title">{t('brand.name')}</span>
            </Link>

            <p className="text-body-sm mt-4 max-w-(--layout-prose-max-width) text-content-secondary">
              {t('footer.description')}
            </p>

            {socials.length > 0 && (
              <ul className="mt-6 flex flex-wrap items-center gap-2">
                {socials.map((key) => (
                  <li key={key}>
                    <a
                      href={site.social[key]}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        'text-caption inline-flex items-center rounded-full px-3 py-1.5',
                        'border border-border-default text-content-secondary',
                        'transition-colors duration-normal ease-brand',
                        'hover:border-accent hover:text-accent',
                      )}
                    >
                      {SOCIAL_LABELS[key]}
                      <span className="sr-only"> ({t('a11y.openInNewTab')})</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {footerNavGroups.map((group) => (
            <nav key={group.id} aria-labelledby={`footer-${group.id}`}>
              <h2
                id={`footer-${group.id}`}
                className="text-eyebrow mb-4 text-content-primary"
              >
                {t(group.titleKey)}
              </h2>
              <ul className="flex flex-col gap-2.5">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="text-body-sm text-content-secondary transition-colors duration-normal ease-brand hover:text-accent"
                    >
                      {t(item.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border-default pt-6">
          <p className="text-caption text-content-tertiary">
            {t('footer.copyright', {
              year: format.dateTime(new Date(), { year: 'numeric' }),
              brand: t('brand.name'),
            })}
          </p>
          <p className="text-caption text-content-tertiary">{t('brand.madeIn')}</p>
        </div>
      </div>
    </footer>
  );
}
