import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  Low: "border-accent-teal/40 bg-accent-teal/10 text-accent-teal",
  Medium: "border-accent-amber/40 bg-accent-amber/10 text-accent-amber",
  High: "border-accent-red/40 bg-accent-red/10 text-accent-red",
  Critical: "border-accent-red/40 bg-accent-red/10 text-accent-red",
  Important: "border-accent-amber/40 bg-accent-amber/10 text-accent-amber",
  "Nice-to-have": "border-white/20 bg-white/5 text-white/70",
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
