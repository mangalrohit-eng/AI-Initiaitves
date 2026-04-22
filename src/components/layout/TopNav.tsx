import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#1a1a2e]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent-purple/40 bg-gradient-to-br from-accent-purple/30 to-accent-teal/20 font-mono text-lg font-semibold text-white shadow-glow transition group-hover:scale-[1.02]">
            &gt;
          </div>
          <div>
            <div className="font-display text-sm font-semibold tracking-wide text-white">Forge Program</div>
            <div className="text-xs text-white/60">Versant Media Group</div>
          </div>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/"
            className="rounded-md px-3 py-2 text-white/80 transition hover:bg-white/5 hover:text-white"
          >
            Towers
          </Link>
          <ChevronRight className="h-4 w-4 text-white/30" aria-hidden />
          <Link
            href="/summary"
            className="rounded-md px-3 py-2 text-white/80 transition hover:bg-white/5 hover:text-white"
          >
            Executive Summary
          </Link>
        </nav>
      </div>
    </header>
  );
}
