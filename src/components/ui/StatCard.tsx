interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
}

export function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="border-l-2 border-border pl-4">
      <p className="text-xs text-muted uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-2xl font-semibold tracking-tight font-mono">
        {value}
      </p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  );
}
