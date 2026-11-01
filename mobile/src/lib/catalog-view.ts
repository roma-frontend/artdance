import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/types';

import { mediaUri, posterBadge, type CatalogItem } from './catalog';
import { dateLabel, levelLabel, price, styleLabel, weekdayShort } from './format';

/** Как показать любой объект каталога одной карточкой: заголовок, фото, подпись, цена, бейдж. */
export type CardView = {
  slug: string;
  title: string;
  uri?: string;
  meta: string;
  price?: string;
  rating?: number;
  badge: string | null;
  /** «Мест нет» — бренд-цвет, «В тренде» — зелёный, как метка новинки. */
  badgeTone?: 'accent' | 'fresh';
  /** Уровень занятия в углу постера. */
  corner?: string;
};

export function cardView(item: CatalogItem, t: Messages, locale: Locale): CardView {
  const image = 'image' in item ? item.image : undefined;
  const base = {
    slug: item.slug,
    uri: image?.key ? mediaUri(image.key) : undefined,
    badge: 'spotsLeft' in item ? posterBadge(item, t) : null,
  };

  if ('instructorName' in item) {
    return {
      ...base,
      badgeTone: item.spotsLeft <= 0 ? 'accent' : 'fresh',
      corner: levelLabel(item.level, t),
      title: item.title,
      meta: `${weekdayShort(item.weekday, locale)} · ${item.startTime} · ${item.instructorName}`,
      price: item.price > 0 ? price(item.price, locale) : t.common.labels.free,
    };
  }
  if ('locationName' in item) {
    return {
      ...base,
      title: item.title,
      meta: `${dateLabel(item.startsAt, locale, { day: 'numeric', month: 'short' })} · ${item.locationName}`,
      price: item.price > 0 ? price(item.price, locale) : t.common.labels.free,
    };
  }
  if ('brand' in item) {
    return {
      ...base,
      title: item.title,
      meta: item.brand,
      price: `${item.priceFrom ? `${t.common.labels.from} ` : ''}${price(item.price, locale)}`,
    };
  }
  if ('district' in item) {
    return {
      ...base,
      title: item.name,
      meta: item.district,
      price: `${price(item.pricePerHour, locale)} / ${t.common.labels.perHour}`,
      rating: item.ratingAverage,
    };
  }
  return {
    ...base,
    title: item.name,
    meta: item.styles.slice(0, 2).map((s) => styleLabel(s, t)).join(' · ') || item.headline,
    price: item.hourlyRateFrom > 0 ? `${t.common.labels.from} ${price(item.hourlyRateFrom, locale)}` : undefined,
    rating: item.ratingAverage,
  };
}
