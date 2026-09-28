'use client';

import { ShoppingBagIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cartAdd } from '@/lib/cart/api';
import { useCartStore } from '@/lib/cart/store';

export function ProductQuickAdd({ variantId, title }: { variantId: string; title: string }) {
  const t = useTranslations();
  const [adding, setAdding] = useState(false);

  return (
    <Button
      size="sm"
      variant="contrast"
      pending={adding}
      pendingLabel={String(t('common.states.loading'))}
      aria-label={`${String(t('common.actions.addToCart'))} — ${title}`}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (adding) return;
        setAdding(true);
        try {
          const snap = await cartAdd(variantId, 1);
          if (snap) useCartStore.getState().setSnapshot(snap);
          toast.success('Добавлено в корзину');
          try { navigator.vibrate?.([12]); } catch {}
        } catch {
          toast.error('Ошибка');
        } finally {
          setAdding(false);
        }
      }}
      className="shadow-lg backdrop-blur-sm"
    >
      <ShoppingBagIcon className="size-4" aria-hidden /> {t('common.actions.addToCart')}
    </Button>
  );
}
