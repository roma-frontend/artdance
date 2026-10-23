/** Карточка ссылки на страницу «Социальные танцы». Содержимое — `lib/seo/og-section-image.tsx`. */

import {
  ogImageAlt,
  ogImageContentType,
  ogImageSize,
} from "@/lib/seo/og-image";
import { sectionOgImage, sectionOgParams } from "@/lib/seo/og-section-image";
import { getDancesportHero } from "@/server/content/catalog";
import { assertEntitlementOrNotFound } from "@/server/entitlements/guard";

export const alt = ogImageAlt;
export const size = ogImageSize;
export const contentType = ogImageContentType;

export function generateStaticParams() {
  return sectionOgParams();
}

const renderSection = sectionOgImage(
  "socialEvents",
  () => getDancesportHero("socialEvents"),
);

/* Карточка раздела «Социальные танцы» живёт за модулем событий. */
export default async function Image(props: Parameters<typeof renderSection>[0]) {
  await assertEntitlementOrNotFound("events");
  return renderSection(props);
}
