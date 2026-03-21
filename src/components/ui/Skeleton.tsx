export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-surface-alt rounded ${className}`}
      aria-hidden
    />
  );
}

export function TableSkeleton({ rows = 10, cols = 8 }: { rows?: number; cols?: number }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-surface">
      <div className="px-4 py-3 border-b border-border">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="p-1">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-3 px-3 py-2.5">
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton
                key={j}
                className={`h-3.5 ${j === 0 ? "w-28" : "w-10"}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
