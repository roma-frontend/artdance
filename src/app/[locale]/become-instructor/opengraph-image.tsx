/**
 * Карточка ссылки на приглашение преподавать.
 *
 * Эту ссылку рассылают адресно — преподавателю, которого зовут на платформу, — и
 * превью здесь работает как первая страница предложения.
 */

import { ogImageAlt, ogImageContentType, ogImageSize } from '@/lib/seo/og-image';
import { sectionOgImage, sectionOgParams } from '@/lib/seo/og-section-image';
import { getContentHero } from '@/server/content/catalog';

export const alt = ogImageAlt;
export const size = ogImageSize;
export const contentType = ogImageContentType;

export function generateStaticParams() {
  return sectionOgParams();
}

export default sectionOgImage('becomeInstructor', getContentHero('becomeInstructor'));
