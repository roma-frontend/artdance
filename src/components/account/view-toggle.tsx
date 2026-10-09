'use client';

import { LayoutGrid, LayoutList } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';

import { cn } from '@/lib/utils';

export type AccountView = 'list' | 'grid';

export function ViewToggle({ value }: { value: AccountView }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const set = (next: AccountView) => {
    const params = new URLSearchParams(sp.toString());
    if (next === 'list') params.delete('view');
    else params.set('view', 'grid');
    // Сбрасываем page при смене вида — иначе пустая страница
    params.delete('page');
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  return (
    <div
      role="group"
      aria-label="View"
      className="inline-flex overflow-hidden rounded-full border border-border-default bg-surface-sunken p-0.5"
    >
      <button
        type="button"
        aria-pressed={value === 'list'}
        aria-label="List view"
        onClick={() => set('list')}
        className={cn(
          'inline-flex size-8 items-center justify-center rounded-full transition',
          value === 'list'
            ? 'bg-surface-card text-content-primary shadow-sm ring-1 ring-border-default'
            : 'text-content-tertiary hover:text-content-secondary',
        )}
      >
        <LayoutList className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-pressed={value === 'grid'}
        aria-label="Grid view"
        onClick={() => set('grid')}
        className={cn(
          'inline-flex size-8 items-center justify-center rounded-full transition',
          value === 'grid'
            ? 'bg-surface-card text-content-primary shadow-sm ring-1 ring-border-default'
            : 'text-content-tertiary hover:text-content-secondary',
        )}
      >
        <LayoutGrid className="size-4" aria-hidden />
      </button>
    </div>
  );
}


