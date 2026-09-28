import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative overflow-hidden rounded-md bg-interactive-hover",
        "animate-pulse motion-reduce:animate-none",
        "after:absolute after:inset-0 after:-translate-x-full after:bg-gradient-to-r after:from-transparent after:via-white/10 after:to-transparent",
        "after:animate-[shimmer_1.4s_ease-in-out_infinite] motion-reduce:after:hidden",
        className,
      )}
      aria-hidden
      aria-busy
      {...props}
    />
  )
}

/**
 * Морфинг skeleton → контент: crossfade 160ms (docs/10 §1).
 * Обёртка уже в DOM — контент подменяет скелет прозрачностью, без «щелчка».
 */
export function SkeletonSwap({
  loading,
  skeleton,
  children,
}: {
  loading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <div
        aria-hidden={loading ? undefined : true}
        className={loading ? 'transition-opacity duration-[160ms]' : 'pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-[160ms]'}
      >
        {loading ? skeleton : null}
      </div>
      <div className={loading ? 'pointer-events-none absolute inset-0 opacity-0' : 'transition-opacity duration-[160ms]'}>{children}</div>
    </div>
  );
}

export { Skeleton }
