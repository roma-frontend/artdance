/** Карточка ссылки на страницу «Реклама». Содержимое — `lib/seo/og-section-image.tsx`. */

import {
  ogImageAlt,
  ogImageContentType,
  ogImageSize,
} from "@/lib/seo/og-image";
import { sectionOgImage, sectionOgParams } from "@/lib/seo/og-section-image";
import { getDancesportHero } from "@/server/content/catalog";

export const alt = ogImageAlt;
export const size = ogImageSize;
export const contentType = ogImageContentType;

export function generateStaticParams() {
  return sectionOgParams();
}

export default sectionOgImage("advertise", getDancesportHero("advertise"));
