/**
 * Карточка ссылки по умолчанию — для всего сайта.
 *
 * Лежит в корне локали, поэтому её наследует каждая страница, у которой нет
 * своей: главная, листинги, справка, тарифы, правовые документы, хабы
 * направлений. Раньше на их месте стоял `og:image` с адресом
 * `/media/og/default.jpg`, файла по которому в `public` нет, — то есть превью не
 * было ни у одной страницы сайта.
 *
 * Текст берётся из каталога переводов, поэтому карточка у ссылки на армянскую
 * версию армянская. Заголовком стоит слоган, а не название раздела: карточка
 * общая, и обещать конкретную страницу она не должна.
 */

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { locales, type Locale } from '@/i18n/config';
import {
  ogImageAlt,
  ogImageContentType,
  ogImageSize,
  renderOgCard,
} from '@/lib/seo/og-image';

export const alt = ogImageAlt;
export const size = ogImageSize;
export const contentType = ogImageContentType;

/**
 * Локали перечисляются здесь ещё раз, хотя их уже объявил макет.
 *
 * Картинка — отдельный маршрут, и параметры сегмента для него не наследуются:
 * без этого списка Next не знает, для каких адресов её собирать, и рисует по
 * запросу. Проверяется по выводу `next build`: у собранной заранее картинки
 * стоит `●`, у динамической — `ƒ`.
 */
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

interface ImageProps {
  params: Promise<{ locale: string }>;
}

export default async function Image({ params }: ImageProps) {
  const { locale } = await params;
  /*
   * Как и на страницах: без объявления локали `next-intl` считает рендер
   * зависящим от запроса, и картинка перестаёт собираться заранее — каждая
   * ссылка, отправленная в мессенджер, поднимала бы функцию.
   */
  setRequestLocale(locale as Locale);

  const t = await getTranslations({ locale: locale as Locale });

  return renderOgCard({
    title: t('brand.tagline'),
    meta: [t('brand.positioning')],
    imageKey: 'hero-dancer',
  });
}
