/**
 * МЕТАДАННЫЕ СТРАНИЦЫ — одна функция вместо ручного набора полей на каждой.
 *
 * Причина существования: `generateMetadata` требует canonical, hreflang для трёх
 * локалей, Open Graph, Twitter и `robots`. Набирать это на тридцати страницах
 * означает однажды забыть hreflang — и потерять локаль в выдаче именно на той
 * странице, где о ней никто не вспомнит.
 *
 * Отличие от сигнатуры в `docs/09-helpers-catalog.md`: сюда приходят готовые
 * `title` и `description`, а не ключи перевода. Причина в данных: у страницы
 * раздела заголовок из каталога переводов, а у страницы занятия — название из
 * базы, и ключа для него не существует. Вызывающая сторона уже держит
 * `getTranslations` в руках, поэтому просить у неё строку дешевле, чем грузить
 * каталог сообщений внутри помощника второй раз.
 *
 * Шаблон заголовка (`%s — ArtDance`) применяет корневой layout, поэтому здесь
 * бренд к заголовку не приписывается: иначе он попадёт в него дважды.
 *
 * **Картинки здесь нет, и это осознанно.** `og:image` ставит файловое соглашение
 * Next: в каждом публичном сегменте лежит `opengraph-image.tsx`, который рисует
 * карточку этой страницы (`src/lib/seo/og-image.tsx`). Объявить картинку отсюда
 * нельзя по двум причинам, и обе проверены на сборке:
 *
 *   • адрес сгенерированной карточки содержит отпечаток содержимого и известен
 *     только сборщику;
 *   • **`openGraph.images` в метаданных ОТМЕНЯЕТ файловое соглашение целиком.**
 *     Не дополняет — отменяет: со строкой `images: [defaultImage]` страница
 *     занятия отдавала общую заглушку вместо своей карточки, хотя
 *     `classes/[slug]/opengraph-image.tsx` собирался и лежал рядом.
 *
 * Файловая карточка НЕ наследуется вложенными сегментами (проверено выводом
 * сборки: `/en/about` не получал `og:image` от `app/[locale]/opengraph-image.tsx`),
 * поэтому файл нужен в каждом сегменте. Что покрытие не разъехалось, следит
 * `src/lib/seo/og-coverage.test.ts`.
 *
 * `twitter:image` отдельно не объявляется: своего файлового соглашения
 * (`twitter-image.tsx`) у нас нет, а Twitter при его отсутствии берёт `og:image`.
 * Вторая копия каждой карточки ради дубля тега удвоила бы время сборки.
 */

import type { Metadata } from 'next';

import { absoluteUrl, seo } from '@/config';
import { localeMeta, type Locale } from '@/i18n/config';

import { localeAlternates } from './sitemap';

export interface BuildMetadataInput {
  locale: Locale;
  /** Путь без префикса локали — только из `routes`, не строкой. */
  path: string;
  title: string;
  description?: string;
  /**
   * `article` для сущностей с содержанием (занятие, событие, запись блога),
   * `profile` для человека, `website` для разделов.
   */
  openGraphType?: 'website' | 'article' | 'profile';
  keywords?: readonly string[];
  /** Приватные и служебные страницы: из индекса и из ссылочного веса. */
  noIndex?: boolean;
}

export function buildMetadata(input: BuildMetadataInput): Metadata {
  const { locale, path, title, description, openGraphType = 'website', keywords, noIndex } = input;

  const canonical = path === '/' ? `/${locale}` : `/${locale}${path}`;

  return {
    title,
    ...(description === undefined ? {} : { description }),
    ...(keywords && keywords.length > 0 ? { keywords: [...keywords] } : {}),

    /*
     * Закрытая от индексации страница не объявляет ни canonical, ни языковые
     * альтернативы: и то и другое — приглашение обойти `noindex`.
     */
    ...(noIndex === true
      ? {
          robots: { index: false, follow: false },
          /*
           * Пустой `canonical` вместо отсутствия поля: метаданные страницы
           * заменяют `alternates` целиком, а молчание оставило бы значение
           * корневого макета — то есть «корзина и есть главная страница».
           */
          alternates: { canonical: null },
        }
      : {
          alternates: { canonical, languages: localeAlternates(path) },
          robots: { index: true, follow: true },
        }),

    openGraph: {
      type: openGraphType,
      siteName: seo.openGraph.siteName,
      locale: localeMeta[locale].bcp47,
      url: absoluteUrl(canonical),
      title,
      ...(description === undefined ? {} : { description }),
    },

    twitter: {
      card: seo.twitter.card,
      site: seo.twitter.site,
      title,
      ...(description === undefined ? {} : { description }),
    },
  };
}
