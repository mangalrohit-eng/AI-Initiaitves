"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, CircleDot } from "lucide-react";
import type { GuidanceTier, ResolvedJourneyGuidance } from "@/lib/guidance/types";
import { cn } from "@/lib/utils";

function tierStyles(tier: GuidanceTier): { border: string; icon: string } {
  if (tier === 1) {
    return {
      border: "border-accent-amber/40 bg-gradient-to-br from-accent-amber/10 via-transparent to-transparent",
      icon: "text-accent-amber",
    };
  }
  return {
    border: "border-accent-purple/35 bg-gradient-to-br from-accent-purple/8 via-transparent to-transparent",
    icon: "text-accent-purple",
  };
}

export function ScreenGuidanceBar({
  guidance,
  className,
}: {
  guidance: ResolvedJourneyGuidance;
  className?: string;
}) {
  const pathname = usePathname();
  const { tier, title, actionHref, actionLabel } = guidance;
  const styles = tierStyles(tier);

  const linkHref = React.useMemo(() => {
    if (!actionHref) return null;
    if (actionHref.startsWith("#")) {
      return pathname ? `${pathname}${actionHref}` : actionHref;
    }
    return actionHref;
  }, [actionHref, pathname]);

  return (
    <section
      role="region"
      aria-label="Primary next action for this page"
      className={cn(
        "rounded-2xl border p-3.5 sm:p-4 shadow-[0_0_0_1px_rgba(161,0,255,0.12)]",
        styles.border,
        className,
      )}
    >
      <div className="flex flex-wrap items-start gap-3 sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 gap-2.5">
          <span
            className="mt-0.5 font-mono text-sm font-semibold text-accent-purple"
            aria-hidden
          >
            &gt;
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CircleDot className={cn("h-4 w-4 shrink-0", styles.icon)} aria-hidden />
              <p className="text-sm font-medium leading-snug text-forge-ink">{title}</p>
            </div>
          </div>
        </div>
        {linkHref && actionLabel ? (
          <div className="shrink-0 w-full sm:w-auto sm:pl-0 pl-7">
            <Link
              href={linkHref}
              className={cn(
                "inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition sm:w-auto",
                tier === 1
                  ? "bg-accent-amber text-near-black hover:bg-accent-amber/90"
                  : "bg-accent-purple text-white hover:bg-accent-purple-dark",
              )}
            >
              {actionLabel}
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
