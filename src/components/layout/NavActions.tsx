"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, Bookmark } from "lucide-react";
import {
  getLastChangelogVisit,
  getPins,
  subscribe,
} from "@/lib/localStore";
import { changelog } from "@/data/changelog";
import { ShortlistDrawer } from "@/components/collab/ShortlistDrawer";

export function NavActions() {
  const [pinCount, setPinCount] = React.useState(0);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [hasNew, setHasNew] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);

    const recomputePins = () => setPinCount(getPins().length);
    const recomputeNew = () => {
      const lastVisit = getLastChangelogVisit();
      const newest = changelog
        .map((e) => new Date(e.date).getTime())
        .sort((a, b) => b - a)[0];
      if (!newest) {
        setHasNew(false);
        return;
      }
      if (!lastVisit) {
        setHasNew(true);
        return;
      }
      setHasNew(new Date(lastVisit).getTime() < newest);
    };

    recomputePins();
    recomputeNew();
    const unsubPins = subscribe("pins", recomputePins);
    const unsubVisit = subscribe("lastChangelogVisit", recomputeNew);
    return () => {
      unsubPins();
      unsubVisit();
    };
  }, []);

  return (
    <>
      <Link
        href="/changelog"
        className="relative inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-forge-body transition hover:bg-forge-well hover:text-forge-ink"
        aria-label="What's new"
      >
        <Bell className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">What&apos;s new</span>
        {mounted && hasNew ? (
          <span
            className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-accent-purple ring-2 ring-forge-surface"
            aria-hidden
          />
        ) : null}
      </Link>
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-forge-border bg-forge-surface px-3 py-2 text-forge-body shadow-sm transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
        aria-haspopup="dialog"
        aria-expanded={drawerOpen}
      >
        <Bookmark className="h-4 w-4" aria-hidden />
        <span>
          My program
          {mounted && pinCount > 0 ? (
            <span className="ml-1 rounded-full bg-accent-purple/15 px-1.5 py-0.5 font-mono text-[11px] text-accent-purple-dark">
              {pinCount}
            </span>
          ) : null}
        </span>
      </button>
      <ShortlistDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
