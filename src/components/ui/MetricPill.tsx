import { cn } from "@/lib/utils";

export function MetricPill({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-forge-border bg-forge-surface px-3 py-2 shadow-sm", className)}>
      <div className="text-[10px] uppercase tracking-wider text-forge-hint">{label}</div>
      <div className="font-mono text-sm font-semibold text-accent-purple-dark">{value}</div>
    </div>
  );
}
