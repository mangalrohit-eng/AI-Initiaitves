import Link from "next/link";
import { getOrderedNavItems, type NavItem } from "@/config/products";
import { getProductIcon, getStaticLinkIcon } from "@/config/productIcons";
import { getPortalAudience, isInternalSurfaceAllowed } from "@/lib/portalAudience";
import { SignOutButton } from "./SignOutButton";
import { NavActions } from "./NavActions";
import { HelpMenu } from "./HelpMenu";
import { ClientModeToggle } from "./ClientModeToggle";

function renderNavItem(item: NavItem) {
  if (item.kind === "product") {
    const I = getProductIcon(item.product.iconId);
    return (
      <Link
        key={`p-${item.product.id}`}
        href={item.product.path}
        className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-forge-body transition hover:bg-forge-well hover:text-forge-ink"
      >
        <I className="h-4 w-4" aria-hidden />
        <span>{item.product.navLabel}</span>
      </Link>
    );
  }
  const s = item.link;
  const I = s.iconId ? getStaticLinkIcon(s.iconId) : null;
  return (
    <Link
      key={`s-${s.id}`}
      href={s.path}
      className="inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-2 text-forge-body transition hover:bg-forge-well hover:text-forge-ink sm:px-3"
    >
      {I ? <I className="h-4 w-4 flex-shrink-0" aria-hidden /> : null}
      <span className="truncate sm:whitespace-normal">{s.name}</span>
    </Link>
  );
}

export function TopNav() {
  const audience = getPortalAudience();
  const items = getOrderedNavItems(audience);
  const showCollab = isInternalSurfaceAllowed(audience);

  return (
    <header className="no-print sticky top-0 z-40 border-b border-forge-border bg-forge-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex min-w-0 flex-shrink-0 items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border-2 border-accent-purple bg-forge-surface font-mono text-lg font-semibold text-accent-purple transition group-hover:bg-accent-purple group-hover:text-white">
            &gt;
          </div>
          <div className="min-w-0">
            <div className="font-display text-sm font-semibold tracking-wide text-forge-ink">Forge Program</div>
            <div className="text-xs text-forge-subtle">Versant Media Group</div>
          </div>
        </Link>
        <nav className="flex min-w-0 flex-wrap items-center justify-end gap-1 text-sm sm:gap-2">
          {items.map((item) => renderNavItem(item))}
          {showCollab ? (
            <>
              <div className="ml-1 h-5 w-px bg-forge-border" aria-hidden />
              <NavActions />
            </>
          ) : null}
          <div className="h-5 w-px bg-forge-border" aria-hidden />
          <ClientModeToggle />
          <HelpMenu />
          <SignOutButton />
        </nav>
      </div>
    </header>
  );
}
