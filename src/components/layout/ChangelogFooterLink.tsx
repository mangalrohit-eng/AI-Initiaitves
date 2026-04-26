"use client";

import * as React from "react";
import Link from "next/link";
import { getLastChangelogVisit, subscribe } from "@/lib/localStore";
import { changelog } from "@/data/changelog";

/**
 * "What's new" link rendered in the global footer, with the small unread
 * dot so reviewers see the badge without the changelog occupying top-nav
 * real estate.
 */
export function ChangelogFooterLink() {
  const [mounted, setMounted] = React.useState(false);
  const [hasNew, setHasNew] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const recompute = () => {
      const lastVisit = getLastChangelogVisit();
      const times = changelog
        .map((e) => new Date(e.date).getTime())
        .sort((a, b) => b - a);
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
      className="relative inline-flex items-center gap-1.5 text-forge-subtle transition hover:text-forge-ink"
    >
      <span>What&apos;s new</span>
      {mounted && hasNew ? (
        <span
          className="inline-block h-1.5 w-1.5 rounded-full bg-accent-purple"
          aria-label="New entries since your last visit"
        />
      ) : null}
    </Link>
  );
}
