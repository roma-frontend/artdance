/**
 * PRODUCT CARD — карточка товара.
 *
 * Цена — минимальная из вариантов, и если варианты различаются по цене или это
 * подарочная карта, она подписана как «от». Без этого «12 500 ֏» на карточке
 * туфель, у которых 38-й размер стоит дороже, — обещание, которое корзина не
 * выполнит.
 *
 * Кнопки быстрого добавления в корзину здесь пока нет: она требует состояния
 * корзины и сервера, и кнопка, которая ничего не делает, хуже её отсутствия.
 * Придёт с волной commerce вместе с `CartScreen` — в макете это `.prod-quick`,
 * появляющаяся из градиента при наведении; на touch-устройствах она обязана быть
 * видна всегда, иначе функция недоступна половине пользователей.
 *
 * Метка «осталось мало» показывается от `commerce.lowStockThreshold` — того же
 * порога, что и у мест на занятии: один рычаг на весь продукт.
 */

import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Media } from '@/components/ui/media';
import { Price } from '@/components/ui/price';
import { commerce, routes } from '@/config';
import { resolveMedia, type ProductCardItem } from '@/domain/content';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  item: ProductCardItem;
  locale: Locale;
  className?: string;
}

export function ProductCard({ item, locale, className }: ProductCardProps) {
  const t = useTranslations();

  const soldOut = item.stock <= 0;
  const lowStock = !soldOut && item.stock <= commerce.lowStockThreshold;

  return (
    <article
      className={cn(
        'card-surface group relative flex h-full flex-col overflow-hidden rounded-lg',
        'border border-border-default bg-surface-card',
        'hover:-translate-y-1.5 hover:shadow-lg',
        'focus-within:-translate-y-1.5 focus-within:shadow-lg',
        className,
      )}
    >
      <div className="relative">
        <Media
          {...resolveMedia(item.image, locale)}
          preset="productCard"
          fallback="product"
          imageClassName="media-zoom group-hover:scale-105"
        />

        {soldOut ? (
          <Badge variant="signal" className="absolute top-3 left-3">
            {t('shop.outOfStock')}
          </Badge>
        ) : (
          lowStock && (
            <Badge variant="warning" className="absolute top-3 left-3">
              {t('shop.lowStock', { count: item.stock })}
            </Badge>
          )
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-eyebrow text-content-tertiary">{item.brand}</p>

        <h3 className="text-card-title mt-1.5">
          <Link
            href={routes.product(item.slug)}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {item.title}
          </Link>
        </h3>

        <div className="mt-auto pt-4">
          <Price amount={item.price} from={item.priceFrom} emphasis="total" />
        </div>
      </div>
    </article>
  );
}
