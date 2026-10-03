/**
 * ADMIN SKELETONS — точные отражения боевых блоков.
 *
 * Каждый скелетон повторяет геометрию своего блока пиксель-в-пиксель,
 * чтобы подмена не давала CLS. Размеры, отступы, гриды — 1:1 с оригиналом.
 * Шимер — через `Skeleton` (pulse + shimmer 1.4s), гасится при reduced-motion.
 * Контент обёрнут в aria-busy, а не на каждой плитке.
 */

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Header — AdminPageHeader: mb-6 sm:mb-8, h1 text-2xl/3xl, subtitle body-sm
// ---------------------------------------------------------------------------
export function AdminPageHeaderSkeleton({ withActions = false }: { withActions?: boolean }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between"
    >
      <span className="sr-only">Загрузка заголовка</span>
      <div className="min-w-0 flex-1 space-y-3">
        <Skeleton className="h-7 w-48 sm:h-8 rounded-lg" />
        <Skeleton className="h-4 w-full max-w-prose rounded-md" />
        <Skeleton className="hidden h-4 w-2/3 max-w-prose rounded-md sm:block" />
      </div>
      {withActions ? (
        <div className="flex shrink-0 gap-2">
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card — rounded-2xl border p-4 sm:p-5
// ---------------------------------------------------------------------------
function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border-default bg-surface-card p-4 shadow-sm sm:p-5">
      <Skeleton className="h-3 w-20 rounded-md" />
      <Skeleton className="mt-3 h-6 w-24 rounded-md sm:h-7" />
      <Skeleton className="mt-2 h-3 w-32 rounded-md" />
    </div>
  );
}

export function StatGridSkeleton({
  count = 8,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn('grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4', className)}
    >
      <span className="sr-only">Загрузка показателей</span>
      {Array.from({ length: count }, (_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filters — rounded-2xl border p-4 flex col sm:row
// ---------------------------------------------------------------------------
export function AdminFiltersSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-3 rounded-2xl border border-border-default bg-surface-card p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end"
    >
      <span className="sr-only">Загрузка фильтров</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:min-w-56 sm:max-w-sm">
        <Skeleton className="h-3 w-16 rounded-md" />
        <Skeleton className="h-10 w-full rounded-full" />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 sm:w-48">
        <Skeleton className="h-3 w-14 rounded-md" />
        <Skeleton className="h-10 w-full rounded-full" />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 sm:w-48">
        <Skeleton className="h-3 w-14 rounded-md" />
        <Skeleton className="h-10 w-full rounded-full" />
      </div>
      <Skeleton className="h-9 w-full rounded-full sm:w-28 self-end" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shortcuts grid — grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3
// ---------------------------------------------------------------------------
export function AdminShortcutsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Загрузка быстрых ссылок</span>
      <Skeleton className="mb-4 h-5 w-40 rounded-md" />
      <ul className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: count }, (_, i) => (
          <li
            key={i}
            className="flex items-center justify-between gap-2 rounded-2xl border border-border-default bg-surface-card px-4 py-3.5 shadow-sm"
          >
            <Skeleton className="h-4 flex-1 rounded-md" />
            <Skeleton className="size-4 rounded-full shrink-0" />
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table skeleton — отражает DataTable.
// Desktop: overflow-hidden rounded-xl border + header sticky + rows
// Mobile:  rounded-2xl cards gap-3
// ---------------------------------------------------------------------------
export function AdminTableSkeleton({
  rows = 6,
  columns = 5,
  withMobile = true,
}: {
  rows?: number;
  columns?: number;
  withMobile?: boolean;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="flex flex-col gap-3">
      <span className="sr-only">Загрузка таблицы</span>

      {/* Mobile cards — sm:hidden mirror */}
      {withMobile ? (
        <div className="flex flex-col gap-3 sm:hidden">
          {Array.from({ length: Math.min(rows, 4) }, (_, i) => (
            <div
              key={`m-${i}`}
              className="flex flex-col gap-3 rounded-2xl border border-border-default bg-surface-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/5 rounded-md" />
                  <div className="flex gap-1.5">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </div>
                <Skeleton className="size-5 rounded shrink-0" />
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border-subtle pt-3">
                {Array.from({ length: 4 }, (_, j) => (
                  <div key={j} className="space-y-1.5">
                    <Skeleton className="h-3 w-16 rounded-md" />
                    <Skeleton className="h-4 w-20 rounded-md" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Desktop table — hidden sm:block */}
      <div
        className={cn(
          'overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-sm',
          withMobile ? 'hidden sm:block' : 'block',
        )}
      >
        {/* header */}
        <div className="flex items-center gap-4 border-b border-border-default bg-surface-raised/80 px-4 py-3">
          {Array.from({ length: columns }, (_, i) => (
            <Skeleton key={i} className={cn('h-3 flex-1 rounded-md', i === 0 && 'flex-[1.6]')} />
          ))}
        </div>
        {/* rows */}
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex items-center gap-4 border-b border-border-subtle px-4 py-4 last:border-b-0">
            {Array.from({ length: columns }, (_, c) => (
              <Skeleton key={c} className={cn('h-4 flex-1 rounded-md', c === 0 && 'flex-[1.6] h-4')} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview composite — KPI + actions for /overview
// ---------------------------------------------------------------------------
export function AdminOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-24 rounded-md" />
        <StatGridSkeleton count={4} />
        <Skeleton className="h-4 w-64 rounded-md" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-32 rounded-md" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-10 w-full rounded-full" />
          <Skeleton className="h-10 w-full rounded-full" />
          <Skeleton className="h-9 w-32 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Catalog hub skeleton — grid md:grid-cols-2 xl:grid-cols-3 cards
// ---------------------------------------------------------------------------
export function AdminCatalogSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Загрузка каталога разделов</span>
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="rounded-lg border border-border-default bg-surface-card p-5">
            <Skeleton className="h-5 w-32 rounded-md" />
            <Skeleton className="mt-3 h-4 w-full rounded-md" />
            <Skeleton className="mt-2 h-4 w-3/4 rounded-md" />
            <Skeleton className="mt-3 h-3 w-20 rounded-md" />
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Report range pills + stats + two lists
// ---------------------------------------------------------------------------
export function AdminReportsSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
      <StatGridSkeleton count={4} />
      <div className="grid gap-8 md:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i}>
            <Skeleton className="mb-4 h-5 w-40 rounded-md" />
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }, (_, j) => (
                <div key={j} className="flex justify-between gap-3 border-b border-border-subtle pb-2">
                  <Skeleton className="h-4 w-32 rounded-md" />
                  <Skeleton className="h-4 w-20 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full page composite — header + stat + shortcuts (для /admin root)
// ---------------------------------------------------------------------------
export function AdminDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeaderSkeleton />
      <StatGridSkeleton count={10} />
      <AdminShortcutsSkeleton />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic list page composite — header + filters + table
// ---------------------------------------------------------------------------
export function AdminListPageSkeleton({
  headerWithActions = false,
  showFilters = true,
  rows = 6,
  columns = 5,
}: {
  headerWithActions?: boolean;
  showFilters?: boolean;
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeaderSkeleton withActions={headerWithActions} />
      {showFilters ? <AdminFiltersSkeleton /> : null}
      <AdminTableSkeleton rows={rows} columns={columns} />
      <Skeleton className="h-4 w-40 rounded-md" />
    </div>
  );
}
