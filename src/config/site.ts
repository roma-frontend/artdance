/**
 * SITE — идентичность платформы. Ни одно из этих значений не должно
 * встречаться в компонентах литералом (включая название бренда и телефон).
 *
 * Тексты, зависящие от языка (описания, слоганы), живут в `src/i18n/messages`.
 * Здесь — только языко-независимые факты и адреса.
 */

import { clientEnv } from './env';

export const site = {
  /** Технический идентификатор бренда. Отображаемое имя — из i18n (`brand.name`). */
  id: 'artdance',
  name: 'ArtDance',
  legalEntity: 'ArtDance LLC',
  /** Заполнить после регистрации юрлица — используется в оферте и чеках. */
  taxId: '',
  foundedYear: 2026,

  url: clientEnv.NEXT_PUBLIC_APP_URL,
  domains: {
    primary: 'artdance.am',
    fallback: 'artdance.com',
  },

  contact: {
    email: 'hello@artdance.am',
    supportEmail: 'support@artdance.am',
    legalEmail: 'legal@artdance.am',
    /** E.164. Пустая строка = блок контактов скрывается, а не рендерит заглушку. */
    phone: '',
    whatsapp: '',
    telegram: '',
  },

  address: {
    country: 'AM',
    countryName: 'Armenia',
    city: 'Yerevan',
    street: '',
    postalCode: '',
    /** Координаты центра Еревана — дефолт карты, пока нет офиса. */
    geo: { lat: 40.1792, lng: 44.4991 },
  },

  social: {
    instagram: 'https://instagram.com/artdance.am',
    tiktok: 'https://tiktok.com/@artdance.am',
    youtube: 'https://youtube.com/@artdance.am',
    facebook: 'https://facebook.com/artdance.am',
  },

  /**
   * Внешние карты. Встроенная карта — отдельная задача плана (2.10) и требует
   * `NEXT_PUBLIC_MAPS_API_KEY`; ссылка «открыть в картах» работает без ключа и
   * нужна независимо от неё: маршрут человек всё равно строит в своём приложении.
   */
  maps: {
    directionsBase: 'https://www.google.com/maps/search/?api=1&query=',
  },

  /** Часовой пояс бизнеса. Все слоты и расписания считаются в нём. */
  timeZone: 'Asia/Yerevan',

  /**
   * id основной области страницы. Знают двое: ссылка «к содержимому» и сам
   * `<main>` каждого шаблона. Литерал в двух местах — это будущая битая ссылка.
   */
  mainContentId: 'content',

  /** Дефолтные операционные часы платформы (для валидации слотов студий). */
  operatingHours: {
    open: '08:00',
    close: '23:00',
  },
} as const;

export type Site = typeof site;

/** Абсолютный URL из относительного пути — для OG-тегов, писем, sitemap. */
export function absoluteUrl(path: string): string {
  const base = site.url.replace(/\/$/, '');
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
}

/**
 * Ссылка «открыть в картах» по координатам.
 *
 * Координаты, а не адрес строкой: у площадок в Ереване адрес часто описательный
 * («напротив входа в парк»), и поиск по нему приводит не туда. Точка приводит
 * туда всегда.
 */
export function directionsUrl(latitude: number, longitude: number): string {
  return `${site.maps.directionsBase}${latitude},${longitude}`;
}
