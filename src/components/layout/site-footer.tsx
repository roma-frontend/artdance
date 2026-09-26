/**
 * SITE FOOTER — подвал: финал как у hero, только снизу.
 *
 * ARTDANCE на всю ширину — тот же контурный приём что в hero
 * (.hero-depth-word): прозрачный текст с обводкой + свечение,
 * глубина за курсором и при прокрутке (FooterParallaxFX).
 *
 * Креативные детали:
 *  • grain + виньетка как у киноплёнки
 *  • тонкая золотая нить поверху (как металлический отблеск сцены)
 *  • световой проход как в hero (hero-light-sweep)
 *  • madeIn как «титры» с трекингом
 */

import { useFormatter, useTranslations } from 'next-intl';

import { BrandMark } from '@/components/brand/brand-mark';
import { FooterParallaxFX } from '@/components/layout/footer-parallax-fx';
import { footerNavGroups, routes, site } from '@/config';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

type SocialKey = keyof typeof site.social;

const SOCIAL_LABELS: Record<SocialKey, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  facebook: 'Facebook',
};

export function SiteFooter() {
  const t = useTranslations();
  const format = useFormatter();
  const socials = (Object.keys(site.social) as SocialKey[]).filter((key) => site.social[key].length > 0);

  return (
    <footer className="footer-reveal-container footer-cinema relative overflow-hidden border-t border-border-on-cinema bg-surface-cinema">
      <FooterParallaxFX />

      {/* Верхняя золотая нить */}
      <div aria-hidden className="footer-hairline absolute inset-x-0 top-0 h-px" />
      {/* Кинозерно + виньетка */}
      <div aria-hidden className="footer-grain absolute inset-0" />
      <div aria-hidden className="footer-vignette absolute inset-0" />
      {/* Световой проход как в hero, но мягче */}
      <div aria-hidden className="footer-light-sweep absolute inset-0" />

      <div className="footer-content page-container section-y relative z-10 pb-8 md:pb-10">
        <div className="grid gap-10 lg:grid-cols-[2fr_repeat(4,1fr)]">
          <div>
            <Link href={routes.home()} className="flex items-center gap-3">
              <BrandMark className="text-accent" />
              <span className="text-card-title text-content-on-cinema">{t('brand.name')}</span>
            </Link>
            <p className="text-body-sm mt-4 max-w-(--layout-prose-max-width) text-content-on-cinema-muted">
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
                        'border border-border-on-cinema text-content-on-cinema-muted',
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
              <h2 id={`footer-${group.id}`} className="text-eyebrow mb-4 text-content-on-cinema">
                {t(group.titleKey)}
              </h2>
              <ul className="flex flex-col gap-2.5">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="text-body-sm text-content-on-cinema-muted transition-colors duration-normal ease-brand hover:text-accent"
                    >
                      {t(item.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border-on-cinema pt-6">
          <p className="text-caption text-content-on-cinema-muted">
            {t('footer.copyright', {
              year: format.dateTime(new Date(), { year: 'numeric' }),
              brand: t('brand.name'),
            })}
          </p>
          <p className="footer-credits text-caption tracking-widest text-content-on-cinema-muted uppercase">
            {t('brand.madeIn')}
          </p>
        </div>

      </div>

      {/* Контурное ARTDANCE — на всю ширину экрана, вне page-container чтобы не резался его max-width/padding */}
      <div
        aria-hidden="true"
        data-footer-word=""
        className="footer-depth-word pointer-events-none relative z-10 select-none px-4 pb-4 md:pb-6"
      >
        <span className="font-display block w-full text-center font-black tracking-tighter whitespace-nowrap leading-none">
          {t('brand.name')}
        </span>
      </div>
    </footer>
  );
}
