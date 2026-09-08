/**
 * Карточка ссылки на страницу контактов.
 *
 * Без кадра: у страницы с формой обращения фотографии нет ни в макете, ни по
 * смыслу — снимок танцующих над полем «тема обращения» обещает не то.
 */

import { ogImageAlt, ogImageContentType, ogImageSize } from '@/lib/seo/og-image';
import { sectionOgImage, sectionOgParams } from '@/lib/seo/og-section-image';

export const alt = ogImageAlt;
export const size = ogImageSize;
export const contentType = ogImageContentType;

export function generateStaticParams() {
  return sectionOgParams();
}

export default sectionOgImage('contact');
