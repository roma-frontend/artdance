/**
 * BRAND MARK — знак бренда: фигура танцовщицы в прыжке.
 *
 * Inline SVG, а не файл через `Media`: знак нужен в шапке при первой отрисовке
 * (это часть LCP-кадра), он меньше килобайта, и лишний сетевой запрос ради него
 * не оправдан. Цвет — `currentColor`, поэтому знак наследует цвет текста
 * родителя и работает и на светлой шапке, и над тёмным hero без второй копии.
 *
 * Знак декоративен: рядом с ним всегда стоит словесная марка «ArtDance»,
 * поэтому у него `aria-hidden` — иначе скринридер прочитает бренд дважды.
 *
 * Геометрия взята из прототипа без изменений.
 */

import { mediaBaseUrl } from '@/config/media';

interface BrandMarkProps {
  className?: string;
  compact?: boolean;
  /** solid=true → header on light bg (island/scrolled/non-hero); solid=false → over cinema hero (always dark bg) */
  solid?: boolean;
}

function brandSrc(name: 'logo' | 'logoOnDark'): string {
  const key = name === 'logo' ? 'brand/logo.png' : 'brand/logo-on-dark.png';
  const cdn = (mediaBaseUrl ?? '').trim().replace(/\/$/, '');
  if (cdn) return `${cdn}/${key}`;
  return `/${key}`;
}

export function BrandMark({ className, compact = false, solid }: BrandMarkProps) {
  if (compact) {
    const isOverHeroCompact = solid === false;
    if (isOverHeroCompact) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brandSrc('logoOnDark')}
          alt=""
          width={1151}
          height={389}
          aria-hidden
          fetchPriority="high"
          decoding="async"
          className={`h-6 w-auto shrink-0 object-contain sm:h-7 ${className ?? ''}`}
        />
      );
    }
    return (
      <span className={`inline-flex shrink-0 items-center ${className ?? ''}`} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={brandSrc('logo')}
          alt=""
          width={1151}
          height={389}
          aria-hidden
          fetchPriority="high"
          decoding="async"
          className="block h-6 w-auto object-contain sm:h-7 in-[[data-theme=dark]]:hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={brandSrc('logoOnDark')}
          alt=""
          width={1151}
          height={389}
          aria-hidden
          fetchPriority="high"
          decoding="async"
          className="hidden h-6 w-auto object-contain sm:h-7 in-[[data-theme=dark]]:block"
        />
      </span>
    );
  }

  const isOverHero = solid === false;

  // Over cinema hero: dark bg in both themes → always on-dark variant
  if (isOverHero) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={brandSrc('logoOnDark')}
        alt=""
        width={1151}
        height={389}
        aria-hidden
        fetchPriority="high"
        decoding="async"
        className={`h-7 w-auto shrink-0 object-contain sm:h-8 ${className ?? ''}`}
      />
    );
  }

  // Everywhere else (island/scrolled/auth): respect html[data-theme="dark"] — NOT html.dark
  // Tailwind v4 dark: по умолчанию html.dark, а у нас токены на [data-theme="dark"]
  return (
    <span className={`inline-flex shrink-0 items-center ${className ?? ''}`} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={brandSrc('logo')}
        alt=""
        width={1151}
        height={389}
        aria-hidden
        fetchPriority="high"
        decoding="async"
        className="block h-7 w-auto object-contain sm:h-8 in-[[data-theme=dark]]:hidden"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={brandSrc('logoOnDark')}
        alt=""
        width={1151}
        height={389}
        aria-hidden
        fetchPriority="high"
        decoding="async"
        className="hidden h-7 w-auto object-contain sm:h-8 in-[[data-theme=dark]]:block"
      />
    </span>
  );
}
