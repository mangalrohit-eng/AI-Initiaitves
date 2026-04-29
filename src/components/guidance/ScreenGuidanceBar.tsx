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
  onConfirm,
  onUnlock,
  mapStepLocked,
}: {
  guidance: ResolvedJourneyGuidance;
  className?: string;
  onConfirm?: () => void;
  onUnlock?: () => void;
  /**
   * When the tower lead has marked L1–L3 as reviewed (lock). Shows an
   * secondary Unlock control on the Capability Map.
   */
  mapStepLocked?: boolean;
}) {
  const pathname = usePathname();
  const { tier, title, actionHref, actionLabel, actionKind } = guidance;
  const styles = tierStyles(tier);

  const linkHref = React.useMemo(() => {
    if (!actionHref) return null;
    if (actionHref.startsWith("#")) {
      return pathname ? `${pathname}${actionHref}` : actionHref;
    }
    return actionHref;
  }, [actionHref, pathname]);

  const isConfirm = actionKind === "confirm" && actionLabel;
  const isLinkPrimary = !isConfirm && linkHref && actionLabel;

  const ctaClass = cn(
    "inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition sm:w-auto",
    tier === 1
      ? "bg-accent-amber text-near-black hover:bg-accent-amber/90"
      : "bg-accent-purple text-white hover:bg-accent-purple-dark",
  );

  if (isConfirm && process.env.NODE_ENV === "development" && !onConfirm) {
    // eslint-disable-next-line no-console
    console.warn("ScreenGuidanceBar: actionKind confirm without onConfirm");
  }

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
        <div className="flex w-full shrink-0 flex-wrap items-stretch justify-end gap-2 sm:items-center sm:pl-0 pl-7">
          {mapStepLocked && onUnlock ? (
            <button
              type="button"
              onClick={onUnlock}
              className="inline-flex w-full min-w-0 items-center justify-center rounded-lg border border-forge-border bg-forge-well/50 px-3.5 py-2 text-sm font-medium text-forge-body transition hover:border-accent-purple/35 hover:text-forge-ink sm:w-auto"
            >
              Unlock to edit map
            </button>
          ) : null}
          {isConfirm && actionLabel && onConfirm ? (
            <div className="w-full sm:w-auto">
              <button type="button" onClick={onConfirm} className={cn("w-full", ctaClass)}>
                {actionLabel}
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : isLinkPrimary ? (
            <div className="w-full sm:w-auto">
              <Link href={linkHref!} className={cn("inline-flex w-full sm:w-auto", ctaClass)}>
                {actionLabel}
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
