/** Карточка ссылки на перечень направлений. Содержимое — `lib/seo/og-section-image.tsx`. */

import { ogImageAlt, ogImageContentType, ogImageSize } from '@/lib/seo/og-image';
import { sectionOgImage, sectionOgParams } from '@/lib/seo/og-section-image';
import { getContentHero } from '@/server/content/catalog';

export const alt = ogImageAlt;
export const size = ogImageSize;
export const contentType = ogImageContentType;

export function generateStaticParams() {
  return sectionOgParams();
}

export default sectionOgImage('styles', getContentHero('styles'));
