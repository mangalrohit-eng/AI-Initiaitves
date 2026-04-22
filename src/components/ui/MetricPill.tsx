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
    <div
      className={cn(
        "rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 shadow-inner shadow-black/20",
        className,
      )}
    >
      <div className="text-[10px] uppercase tracking-wider text-white/45">{label}</div>
      <div className="font-mono text-sm font-semibold text-transparent bg-gradient-to-r from-accent-purple-light to-white bg-clip-text">
        {value}
      </div>
    </div>
  );
}
