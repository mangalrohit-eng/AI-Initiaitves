import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-forge-subtle">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex items-center gap-2">
            {i > 0 ? <ChevronRight className="h-4 w-4 text-forge-hint" aria-hidden /> : null}
            {c.href ? (
              <Link href={c.href} className="text-forge-body transition hover:text-accent-purple-dark">
                {c.label}
              </Link>
            ) : (
              <span className="font-medium text-forge-ink">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
