import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-forge-border bg-forge-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-accent-purple bg-forge-surface font-mono text-lg font-semibold text-accent-purple transition group-hover:bg-accent-purple group-hover:text-white">
            &gt;
          </div>
          <div>
            <div className="font-display text-sm font-semibold tracking-wide text-forge-ink">Forge Program</div>
            <div className="text-xs text-forge-subtle">Versant Media Group</div>
          </div>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/" className="rounded-md px-3 py-2 text-forge-body transition hover:bg-forge-well hover:text-forge-ink">
            Towers
          </Link>
          <ChevronRight className="h-4 w-4 text-forge-hint" aria-hidden />
          <Link href="/summary" className="rounded-md px-3 py-2 text-forge-body transition hover:bg-forge-well hover:text-forge-ink">
            Executive Summary
          </Link>
        </nav>
      </div>
    </header>
  );
}
