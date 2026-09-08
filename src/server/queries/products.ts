/**
 * ТОВАРЫ ИЗ БАЗЫ.
 *
 * ## Цена карточки — минимальная из вариантов
 *
 * Покупатель видит, «от чего», а не среднее: цена, по которой нельзя купить ни
 * один размер, — это обещание, которое ломается на странице товара. Признак «от»
 * ставится, когда варианты стоят по-разному, — либо когда это подарочная карта.
 *
 * ## Подарочная карта распознаётся по категории, а не по флагу
 *
 * Колонки `isGiftCard` в схеме нет намеренно (решение при переносе на базу):
 * второй источник правды о том же факте разошёлся бы с первым. Категория —
 * `commerce.giftCardCategorySlug`, то есть настройка, а не строка по месту.
 *
 * ## Остаток — сумма по вариантам, без резерва
 *
 * `stock - reserved`: товар, лежащий в чужой неоплаченной корзине, не свободен.
 * Показать его свободным значит продать дважды.
 */

import 'server-only';

import { commerce, limits } from '@/config/business';
import { cacheTags, dataRevalidate } from '@/config/cache';
import {
  availableSorts,
  matchesQuery,
  paginate,
  sortByOption,
  type CatalogQuery,
  type CatalogSort,
} from '@/domain/catalog';
import type {
  CatalogPage,
  FacetOption,
  ProductCardItem,
  ProductDetail,
} from '@/domain/content';
import { db } from '@/lib/db';
import { defineQuery } from '@/server/query';

import { galleryRefs, firstMediaRef, mediaSelect, type MediaRow } from './media';

const productSelect = {
  slug: true,
  title: true,
  description: true,
  brand: true,
  basePrice: true,
  createdAt: true,
  category: { select: { slug: true } },
  media: { select: mediaSelect },
  variants: {
    where: { isActive: true },
    select: { sku: true, size: true, color: true, price: true, stock: true, reserved: true },
  },
} as const;

interface VariantRow {
  sku: string;
  size: string | null;
  color: string | null;
  price: number;
  stock: number;
  reserved: number;
}

interface ProductRow {
  slug: string;
  title: string;
  description: string;
  brand: string | null;
  basePrice: number;
  createdAt: Date;
  category: { slug: string };
  media: MediaRow[];
  variants: VariantRow[];
}

const publicProductWhere = { isActive: true };

/** Свободный остаток варианта: резерв уже обещан другому покупателю. */
function available(variant: VariantRow): number {
  return Math.max(0, variant.stock - variant.reserved);
}

function totalStock(row: ProductRow): number {
  return row.variants.reduce((sum, variant) => sum + available(variant), 0);
}

function priceOf(row: ProductRow): number {
  const prices = row.variants.map((variant) => variant.price);
  return prices.length > 0 ? Math.min(...prices) : row.basePrice;
}

function isGiftCard(row: ProductRow): boolean {
  return row.category.slug === commerce.giftCardCategorySlug;
}

export function toProductCard(row: ProductRow): ProductCardItem {
  const prices = row.variants.map((variant) => variant.price);
  const minPrice = priceOf(row);

  return {
    slug: row.slug,
    title: row.title,
    /** Бренд не обязателен в схеме: у собственных товаров его может не быть. */
    brand: row.brand ?? '',
    price: minPrice,
    priceFrom: prices.some((price) => price !== minPrice) || isGiftCard(row),
    stock: totalStock(row),
    image: firstMediaRef(row.media) ?? { key: '', alt: { hy: '', ru: '', en: '' } },
  };
}

function productWhere(query: CatalogQuery) {
  return {
    ...publicProductWhere,
    ...(query.category ? { category: { slug: query.category } } : {}),
    /*
     * Цена фильтруется по вариантам: товар подходит диапазону, если подходит хотя
     * бы один его размер — именно его покупатель и увидит в карточке.
     */
    ...(query.priceMin !== undefined || query.priceMax !== undefined
      ? {
          variants: {
            some: {
              isActive: true,
              price: {
                ...(query.priceMin !== undefined ? { gte: query.priceMin } : {}),
                ...(query.priceMax !== undefined ? { lte: query.priceMax } : {}),
              },
            },
          },
        }
      : {}),
  };
}

function matchesText(row: ProductRow, term: string | undefined): boolean {
  return matchesQuery(term, [
    row.title,
    row.description,
    row.brand ?? undefined,
    ...row.variants.flatMap((variant) => [variant.size ?? undefined, variant.color ?? undefined]),
  ]);
}

function productSortKeys() {
  return {
    /** В наличии — выше: товар, который нельзя купить, не должен открывать список. */
    relevance: (row: ProductRow) => (totalStock(row) > 0 ? 0 : 1),
    price: priceOf,
    createdAt: (row: ProductRow) => row.createdAt.getTime(),
  };
}

export const productSortOptions: readonly CatalogSort[] = availableSorts(productSortKeys());

export const getProductList = defineQuery({
  name: 'productList',
  tags: () => [cacheTags.products()],
  revalidate: dataRevalidate.catalog,
  handler: async (query: CatalogQuery): Promise<CatalogPage<ProductCardItem>> => {
    const rows = (await db.product.findMany({
      where: productWhere(query),
      select: productSelect,
      take: limits.query.maxRows,
    })) as unknown as ProductRow[];

    const filtered = rows.filter((row) => matchesText(row, query.q));
    const sorted = sortByOption(filtered, query.sort, productSortKeys());
    const page = paginate(sorted, query.page, query.pageSize);

    return { ...page, items: page.items.map(toProductCard) };
  },
});

export const getProductDetail = defineQuery({
  name: 'productDetail',
  tags: (slug: string) => [cacheTags.product(slug), cacheTags.products()],
  revalidate: dataRevalidate.entity,
  handler: async (slug: string): Promise<ProductDetail | null> => {
    const row = (await db.product.findFirst({
      where: { slug, ...publicProductWhere },
      select: productSelect,
    })) as unknown as ProductRow | null;

    if (!row) return null;

    const related = (await db.product.findMany({
      where: { ...publicProductWhere, category: { slug: row.category.slug }, slug: { not: slug } },
      select: productSelect,
      take: limits.styleHub.classes,
    })) as unknown as ProductRow[];

    return {
      ...toProductCard(row),
      description: row.description,
      categorySlug: row.category.slug,
      variants: row.variants.map((variant) => ({
        sku: variant.sku,
        ...(variant.size ? { size: variant.size } : {}),
        ...(variant.color ? { color: variant.color } : {}),
        price: variant.price,
        stock: available(variant),
      })),
      /** Галерея — все кадры товара в объявленном порядке; первый совпадает с карточкой. */
      gallery: galleryRefs(row.media),
      isGiftCard: isGiftCard(row),
      related: related.map(toProductCard),
    };
  },
});

/** Товар, у которого остаток ниже порога: определяет метку «осталось мало». */
export function isLowStock(stock: number): boolean {
  return stock > 0 && stock <= commerce.lowStockThreshold;
}

export const getProductCategories = defineQuery({
  name: 'productCategories',
  tags: () => [cacheTags.products(), cacheTags.catalogStats()],
  revalidate: dataRevalidate.catalogStats,
  handler: async (): Promise<readonly FacetOption[]> => {
    const rows = await db.productCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        slug: true,
        name: true,
        _count: { select: { products: { where: publicProductWhere } } },
      },
    });

    return rows.map((row) => ({
      value: row.slug,
      /**
       * Категории — контент заказчика, а не словарь домена: их названия приходят
       * из `ProductCategoryTranslation`, а не из каталога переводов интерфейса.
       * Поэтому здесь имя из данных, а не ключ i18n.
       */
      labelKey: row.name,
      count: row._count.products,
    }));
  },
});
