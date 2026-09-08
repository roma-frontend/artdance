/**
 * КАРТОЧКА ССЫЛКИ НА РАЗДЕЛ — общая часть для всех страниц без своей сущности.
 *
 * Зачем отдельный модуль. Файловое соглашение Next привязывает `og:image` к
 * СЕГМЕНТУ и не наследует его вложенным: `app/[locale]/opengraph-image.tsx` даёт
 * картинку главной и только ей, а `/about`, `/faq`, `/classes` остаются без
 * превью (проверено выводом сборки). Значит, файл нужен в каждом публичном
 * сегменте — и, чтобы эти файлы не превратились в двадцать копий одной разметки,
 * содержимое карточки живёт здесь, а в сегменте остаётся объявление: какой
 * заголовок и какой кадр.
 *
 * Состав карточки: заголовок страницы из `seo.*` — то есть ровно тот текст,
 * который уже стоит в `<title>` и в выдаче, — и позиционирование бренда строкой
 * деталей. Описание страницы (`seo.*.description`) сюда не идёт намеренно: оно
 * рассчитано на 158 символов, а в строке карточки помещается около шестидесяти,
 * и обрезанное на середине предложение выглядит хуже, чем его отсутствие.
 */

import 'server-only';

import { getTranslations, setRequestLocale } from 'next-intl/server';

import type { MediaRef } from '@/domain/content';
import { locales, type Locale } from '@/i18n/config';

import { renderOgCard } from './og-image';

/**
 * Локали для статической сборки картинки.
 *
 * Объявляются в каждом сегменте заново: параметры маршрута картинка не
 * наследует, и без этого списка Next рисует её по запросу — то есть при каждой
 * отправке ссылки в мессенджер.
 */
export function sectionOgParams(): Array<{ locale: string }> {
  return locales.map((locale) => ({ locale }));
}

/**
 * Разделы, у которых есть заголовок в `seo.*`.
 *
 * Союз литералов, а не `string`: из него собирается ключ перевода, и
 * несуществующий раздел должен быть ошибкой сборки, а не пустой карточкой с
 * `MISSING_MESSAGE` вместо заголовка.
 */
export type SectionOgKey =
  | 'discover'
  | 'classes'
  | 'instructors'
  | 'studios'
  | 'events'
  | 'shop'
  | 'styles'
  | 'about'
  | 'contact'
  | 'faq'
  | 'help'
  | 'pricing'
  | 'becomeInstructor'
  | 'listYourStudio'
  | 'giftCards';

interface SectionImageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Компонент картинки раздела.
 *
 * Кадр необязателен: у справки, вопросов, контактов и тарифов фотографии нет —
 * там карточка типографская, и это не заглушка, а второй законный вариант
 * (см. шапку `og-image.tsx`).
 */
export function sectionOgImage(key: SectionOgKey, image?: MediaRef | null) {
  return async function OgSectionImage({ params }: SectionImageProps) {
    const { locale } = await params;
    setRequestLocale(locale as Locale);

    const t = await getTranslations({ locale: locale as Locale });

    return renderOgCard({
      title: t(`seo.${key}.title`),
      meta: [t('brand.positioning')],
      imageKey: image?.key ?? null,
    });
  };
}
