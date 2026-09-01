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
