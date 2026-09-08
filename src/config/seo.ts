/**
 * SEO — конфигурация метаданных и структурированных данных.
 *
 * Тексты (title/description) берутся из i18n по ключам, объявленным здесь.
 * Никаких `<title>Классы танцев в Ереване</title>` в компонентах.
 */

import { site } from './site';
import { locales } from '@/i18n/config';
import { mediaFallbacks } from './media';

export const seo = {
  titleTemplate: '%s — {brand}',
  /** Максимальные длины для линтера контента в админке. */
  limits: {
    titleMax: 60,
    descriptionMax: 158,
    ogTitleMax: 70,
    ogDescriptionMax: 200,
  },

  openGraph: {
    type: 'website',
    siteName: site.name,
    defaultImage: mediaFallbacks.openGraph,
    imageWidth: 1200,
    imageHeight: 630,
    /**
     * Раскладка карточки для соцсетей (`src/lib/seo/og-image.tsx`).
     *
     * Пиксели, а не токены типографики, и это не упущение: карточка — плакат
     * фиксированного размера 1200×630, который никогда не переносится по строкам
     * иначе и не масштабируется под экран. Шкала интерфейса рассчитана на
     * противоположное, и подставлять её сюда значило бы связать два размера,
     * меняющихся по разным поводам.
     *
     * Здесь они лежат вместе, чтобы «сделайте заголовок на превью крупнее» было
     * правкой одной строки, а не поиском числа в разметке картинки.
     */
    card: {
      padding: 56,
      /** Логотип: кегль, разрядка и длина золотой черты перед ним. */
      brandSize: 26,
      brandTracking: 6,
      brandRuleWidth: 36,
      /** Метка вида сущности в правом верхнем углу. */
      kindSize: 22,
      kindTracking: 3,
      /** Надзаголовок: направление, тип события, район. */
      eyebrowSize: 26,
      eyebrowTracking: 5,
      /**
       * Пределы длины в символах.
       *
       * Надзаголовок и строка деталей набраны в одну строку без переноса: то, что
       * не поместилось, уехало бы за край карточки. Порог для заголовка — общий
       * `seo.limits.ogTitleMax`, он же проверяет длину в админке.
       */
      eyebrowMax: 42,
      metaMax: 64,
      titleSize: 72,
      /** Кегль для длинного заголовка: в две строки он читается, в три — нет. */
      titleSizeLong: 58,
      titleLongThreshold: 44,
      metaSize: 30,
      /** Расстояние между надзаголовком, заголовком и строкой деталей. */
      gap: 16,
      /**
       * Насколько гасится фотография под текстом.
       *
       * Вуали (`scrim.bottomStrong`) на карточке не хватает, и это видно только
       * на светлом кадре: она рассчитана на плитку каталога, где подпись стоит у
       * самого низа, а здесь под текст уходит три строки, и верхняя приходится на
       * ту часть градиента, где затемнения почти нет. На портрете инструктора,
       * снятом в зале с окнами, золотой надзаголовок и приглушённая строка
       * деталей на нём практически исчезали.
       *
       * Приём тот же, что у баннера раздела (`PageHero`: `brightness-[0.45]` плюс
       * градиент): кадр приглушается целиком, вуаль добавляет плотности внизу.
       * Значение то же, что у баннера, и подобрано по худшему случаю —
       * золотому надзаголовку на светлой стене зала: вуаль в этой точке даёт около
       * 0,4 плотности, и при более светлом кадре подпись уходит ниже 3:1.
       */
      photoBrightness: 0.45,
    },
  },

  twitter: {
    card: 'summary_large_image',
    site: '@artdance_am',
  },

  /** Приоритеты и частота обновления для sitemap. */
  sitemap: {
    priorities: {
      home: 1,
      discover: 0.9,
      instructors: 0.9,
      classes: 0.9,
      studios: 0.8,
      shop: 0.8,
      events: 0.7,
      courses: 0.7,
      content: 0.5,
      legal: 0.3,
    },
    changeFrequency: {
      home: 'daily',
      catalog: 'daily',
      entity: 'weekly',
      content: 'monthly',
      legal: 'yearly',
    },
  },

  /** JSON-LD: какие типы схем генерируются для каких сущностей. */
  structuredData: {
    organization: 'Organization',
    website: 'WebSite',
    instructor: 'Person',
    studio: 'LocalBusiness',
    danceClass: 'Course',
    event: 'Event',
    product: 'Product',
    review: 'Review',
    breadcrumb: 'BreadcrumbList',
    faq: 'FAQPage',
  },

  /** Языковые альтернативы для hreflang. */
  hreflang: {
    locales,
    xDefault: 'en',
  },
} as const;

export type SeoConfig = typeof seo;
