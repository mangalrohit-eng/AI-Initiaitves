import Link from "next/link";

export type BreadcrumbItem = {
  label: string;
  /** Omit on the active (last) crumb. */
  href?: string;
};

/**
 * Compact breadcrumb trail using the Accenture `>` chevron motif.
 * Renders nothing when fewer than 2 items are provided.
 */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (!items || items.length < 2) return null;
  return (
    <nav aria-label="Breadcrumb" className="no-print text-xs text-forge-subtle">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={`${idx}-${item.label}`} className="flex items-center gap-1.5">
              {idx > 0 ? (
                <span aria-hidden className="font-mono text-forge-hint">
                  &gt;
                </span>
              ) : null}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="rounded transition hover:text-forge-ink hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={isLast ? "font-medium text-forge-body" : "text-forge-subtle"}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
