/**
 * Карточка ссылки на вопросы и ответы.
 *
 * Без кадра: фотография над списком вопросов ничего не сообщает, а в макете её у
 * этой страницы и нет. Карточка типографская — тёмная плоскость с акцентом.
 */

import { ogImageAlt, ogImageContentType, ogImageSize } from '@/lib/seo/og-image';
import { sectionOgImage, sectionOgParams } from '@/lib/seo/og-section-image';

export const alt = ogImageAlt;
export const size = ogImageSize;
export const contentType = ogImageContentType;

export function generateStaticParams() {
  return sectionOgParams();
}

export default sectionOgImage('faq');
