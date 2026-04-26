"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { getLastChangelogVisit, subscribe } from "@/lib/localStore";
import { changelog } from "@/data/changelog";

/**
 * "What's new" in the top nav, with the unread dot so logic stays
 * next to the changelog (internal / full builds).
 */
export function ChangelogNavItem() {
  const [mounted, setMounted] = React.useState(false);
  const [hasNew, setHasNew] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const recompute = () => {
      const lastVisit = getLastChangelogVisit();
      const times = changelog.map((e) => new Date(e.date).getTime()).sort((a, b) => b - a);
      const newest = times[0];
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
    recompute();
    return subscribe("lastChangelogVisit", recompute);
  }, []);

  return (
    <Link
      href="/changelog"
      className="relative inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-forge-body transition hover:bg-forge-well hover:text-forge-ink"
      aria-label="What&apos;s new"
    >
      <Bell className="h-4 w-4 flex-shrink-0" aria-hidden />
      <span className="hidden sm:inline">What&apos;s new</span>
      {mounted && hasNew ? (
        <span
          className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent-purple ring-2 ring-forge-surface"
          aria-hidden
        />
      ) : null}
    </Link>
  );
}
