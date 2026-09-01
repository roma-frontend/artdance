/**
 * Skeleton раздела. Служит fallback'ом для streaming: страница отдаётся
 * пользователю сразу, а серверные данные подтягиваются потоком.
 *
 * Цвет — `bg-skeleton`, семантический токен. Анимация уважает
 * `prefers-reduced-motion` через глобальное правило в `globals.css`.
 */

export default function Loading() {
  return (
    <main className="page-container section-y" aria-busy="true">
      <div className="animate-pulse space-y-6">
        <div className="h-3 w-28 rounded-full bg-skeleton" />
        <div className="h-10 w-2/3 rounded-md bg-skeleton" />
        <div className="h-4 w-1/2 rounded-md bg-skeleton" />
        <div className="grid gap-4 pt-6 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="space-y-3">
              <div className="aspect-[3/4] rounded-lg bg-skeleton" />
              <div className="h-4 w-3/4 rounded-md bg-skeleton" />
              <div className="h-3 w-1/2 rounded-md bg-skeleton" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
