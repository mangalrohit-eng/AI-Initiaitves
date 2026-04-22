import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  Low: "border-accent-teal/45 bg-accent-teal/10 text-emerald-800",
  Medium: "border-accent-amber/50 bg-amber-50 text-amber-900",
  High: "border-accent-red/45 bg-red-50 text-red-900",
  Critical: "border-accent-red/45 bg-red-50 text-red-900",
  Important: "border-accent-amber/50 bg-amber-50 text-amber-900",
  "Nice-to-have": "border-forge-border bg-forge-well text-forge-body",
};

export function Badge({
  children,
  tone = "Medium",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof styles | string;
  className?: string;
}) {
  const key = tone in styles ? tone : "Medium";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles[key] ?? styles.Medium,
        className,
      )}
    >
      {children}
    </span>
  );
}
