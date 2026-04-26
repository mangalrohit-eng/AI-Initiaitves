import Link from "next/link";
import { getFooterNavLinks } from "@/config/products";
import { getPortalAudience } from "@/lib/portalAudience";
import { ChangelogFooterLink } from "./ChangelogFooterLink";

export function Footer() {
  const audience = getPortalAudience();
  const links = getFooterNavLinks(audience);

  return (
    <footer className="no-print border-t border-forge-border bg-forge-surface/95 py-6 text-xs text-forge-subtle">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 lg:px-8">
        <p className="text-center sm:text-left">
          Accenture-led Forge Program visualization — static research dataset for executive exploration. Not a system of record.
        </p>
        {links.length > 0 ? (
          <nav
            aria-label="Reference links"
            className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:justify-end"
          >
            {links.map((l, i) => {
              const isLast = i === links.length - 1;
              return (
                <span key={l.id} className="flex items-center gap-x-4">
                  {l.id === "changelog" ? (
                    <ChangelogFooterLink />
                  ) : (
                    <Link
                      href={l.path}
                      className="text-forge-subtle transition hover:text-forge-ink"
                    >
                      {l.name}
                    </Link>
                  )}
                  {!isLast ? (
                    <span aria-hidden className="text-forge-border-strong">
                      ·
                    </span>
                  ) : null}
                </span>
              );
            })}
          </nav>
        ) : null}
      </div>
    </footer>
  );
}
