'use client';

import { useRouter } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BlogFilterProps {
  categories: readonly string[];
  active: string | null;
  locale: string;
  labelAll: string;
}

export function BlogFilter({ categories, active, locale, labelAll }: BlogFilterProps) {
  const t = useTranslations('footer');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  if (categories.length === 0) return null;

  function setCategory(cat: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (cat) params.set('category', cat);
    else params.delete('category');
    params.delete('page');
    const qs = params.toString();
    startTransition(() => {
      router.push(`/${locale}/blog${qs ? `?${qs}` : ''}`);
    });
  }

  return (
    <nav aria-label={t('blogCategoriesLabel')} className={cn('flex flex-wrap gap-2', pending && 'opacity-60')}>
      <Button
        size="sm"
        variant={active === null ? 'accent' : 'outline'}
        onClick={() => setCategory(null)}
        aria-pressed={active === null}
      >
        {labelAll}
      </Button>
      {categories.map((cat) => (
        <Button
          key={cat}
          size="sm"
          variant={active === cat ? 'accent' : 'outline'}
          onClick={() => setCategory(cat)}
          aria-pressed={active === cat}
        >
          {cat}
        </Button>
      ))}
    </nav>
  );
}
