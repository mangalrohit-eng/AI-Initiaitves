"use client";

import * as React from "react";
import { Bookmark } from "lucide-react";
import { getPins, subscribe } from "@/lib/localStore";
import { ShortlistDrawer } from "@/components/collab/ShortlistDrawer";

export function NavActions() {
  const [pinCount, setPinCount] = React.useState(0);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const recomputePins = () => setPinCount(getPins().length);
    recomputePins();
    return subscribe("pins", recomputePins);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-forge-border bg-forge-surface px-2 py-2 text-forge-body shadow-sm transition hover:border-accent-purple/40 hover:text-accent-purple-dark sm:px-3"
        aria-haspopup="dialog"
        aria-expanded={drawerOpen}
      >
        <Bookmark className="h-4 w-4 flex-shrink-0" aria-hidden />
        <span className="hidden sm:inline">
          My program
          {mounted && pinCount > 0 ? (
            <span className="ml-1 rounded-full bg-accent-purple/15 px-1.5 py-0.5 font-mono text-[11px] text-accent-purple-dark">
              {pinCount}
            </span>
          ) : null}
        </span>
        {mounted && pinCount > 0 ? (
          <span className="sm:hidden font-mono text-[11px] text-accent-purple-dark">({pinCount})</span>
        ) : null}
      </button>
      <ShortlistDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
