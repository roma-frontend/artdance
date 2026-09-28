/**
 * PRODUCT VARIANTS — выбор варианта, остаток, добавление в корзину.
 *
 * Принимает ProductDetail (variants уже с available stock),
 * показывает размеры/цвета, цену выбранного варианта и кнопку.
 */

'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Price } from '@/components/ui/price';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { commerce } from '@/config/business';
import type { ProductDetail } from '@/domain/content';
import { cartAdd } from '@/lib/cart/api';
import { useCartStore } from '@/lib/cart/store';
import { cn } from '@/lib/utils';

interface ProductVariantsProps {
  product: ProductDetail;
  className?: string;
}

export function ProductVariants({ product, className }: ProductVariantsProps) {
  const t = useTranslations();
  const [selectedSku, setSelectedSku] = useState<string | null>(product.variants[0]?.sku ?? null);
  const [qty, setQty] = useState(1);
  const [pending, setPending] = useState(false);
  const [added, setAdded] = useState(false);

  const selected = useMemo(
    () => product.variants.find((v) => v.sku === selectedSku) ?? product.variants[0] ?? null,
    [product.variants, selectedSku],
  );

  // Для подарочных карт вариант — номинал; stock = 999 (из фикстур), пропускаем low check
  const lowStock = selected ? selected.stock > 0 && selected.stock <= commerce.lowStockThreshold && !product.isGiftCard : false;
  const outOfStock = selected ? selected.stock <= 0 && !product.isGiftCard : false;

  const add = async () => {
    if (!selected) return;
    // Находим id варианта по sku через запрос — в ProductDetail sku есть, id нет;
    // поэтому ищем по slug+sku через api: достаточно передать variantId = sku как прокси,
    // а сервер резолвит по sku в service — упростим: передаём sku, сервер найдёт по sku.
    setPending(true);
    try {
      // Резолвим variant id по sku через скрытый lookup: передаём sku как variantId,
      // service найдёт по sku если uuid не нашёлся.
      const snap = await fetch('/api/cart/variant-id?sku=' + encodeURIComponent(selected.sku), { cache: 'no-store' }).then(async (r) => {
        if (r.ok) {
          const j = (await r.json()) as { id: string };
          return j.id;
        }
        return null;
      }).catch(() => null);
      const variantId = snap ?? selected.sku;
      const res = await cartAdd(variantId, qty);
      if (res) {
        useCartStore.getState().setSnapshot(res);
        setAdded(true);
        setTimeout(() => setAdded(false), 2000);
      }
    } finally {
      setPending(false);
    }
  };

  if (product.variants.length === 0) {
    return (
      <p className={cn('text-body text-content-tertiary', className)}>{t('shop.outOfStock')}</p>
    );
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Варианты */}
      <div className="flex flex-wrap gap-2">
        {product.variants.map((v) => (
          <button
            key={v.sku}
            type="button"
            onClick={() => setSelectedSku(v.sku)}
            className={cn(
              'rounded-md border px-3 py-2 text-body-sm font-medium transition-colors',
              selectedSku === v.sku
                ? 'border-accent bg-accent-soft text-content-accent'
                : 'border-border-default bg-surface-card hover:border-border-strong',
            )}
            aria-pressed={selectedSku === v.sku}
          >
            {[v.size, v.color].filter(Boolean).join(' · ') || v.sku}
            <span className="ms-2 text-content-tertiary">{v.price.toLocaleString()} ֏</span>
          </button>
        ))}
      </div>

      {selected && (
        <>
          <div className="flex items-center gap-3">
            <Price amount={selected.price} emphasis="total" />
            {outOfStock && <Badge variant="signal">{t('shop.outOfStock')}</Badge>}
            {lowStock && <Badge variant="warning">{t('shop.lowStock', { count: selected.stock })}</Badge>}
          </div>

          <div className="flex items-center gap-3">
            <QuantityStepper value={qty} onChange={setQty} disabled={outOfStock || pending} label={t('common.labels.quantity')} />
            <Button onClick={add} disabled={outOfStock || pending} variant="accent">
              {added ? '✓' : t('common.actions.addToCart')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
