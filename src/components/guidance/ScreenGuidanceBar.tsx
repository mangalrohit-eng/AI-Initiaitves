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
  const {
    tier,
    title,
    actionHref,
    actionLabel,
    actionKind,
    secondaryActionHref,
    secondaryActionLabel,
  } = guidance;
  const styles = tierStyles(tier);

  const linkHref = React.useMemo(() => {
    if (!actionHref) return null;
    if (actionHref.startsWith("#")) {
      return pathname ? `${pathname}${actionHref}` : actionHref;
    }
    return actionHref;
  }, [actionHref, pathname]);

  const secondaryHref = React.useMemo(() => {
    if (!secondaryActionHref) return null;
    if (secondaryActionHref.startsWith("#")) {
      return pathname ? `${pathname}${secondaryActionHref}` : secondaryActionHref;
    }
    return secondaryActionHref;
  }, [secondaryActionHref, pathname]);

  const isConfirm = actionKind === "confirm" && actionLabel;
  const isLinkPrimary = !isConfirm && linkHref && actionLabel;
  const isSecondaryLink = secondaryHref && secondaryActionLabel;

  const hasActions =
    (mapStepLocked && onUnlock) ||
    (isConfirm && actionLabel && onConfirm) ||
    isLinkPrimary ||
    isSecondaryLink;

  const ctaClass = cn(
    "inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition sm:w-auto",
    tier === 1
      ? "bg-accent-amber text-near-black hover:bg-accent-amber/90"
      : "bg-accent-purple text-white hover:bg-accent-purple-dark",
  );

  const secondaryClass = cn(
    "inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-forge-border bg-forge-well/50 px-3.5 py-2 text-sm font-medium text-forge-body transition hover:border-accent-purple/35 hover:text-forge-ink sm:w-auto",
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
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-nowrap sm:items-center sm:justify-between sm:gap-4">
        <div className="flex w-full min-w-0 items-start gap-2.5 sm:flex-1">
          <span className="flex shrink-0 items-center gap-1.5 pt-px" aria-hidden>
            <span className="font-mono text-sm font-semibold leading-none text-accent-purple">
              &gt;
            </span>
            <CircleDot className={cn("h-4 w-4 shrink-0", styles.icon)} />
          </span>
          <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-forge-ink">{title}</p>
        </div>
        {hasActions ? (
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-nowrap sm:items-center sm:justify-end">
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
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-nowrap sm:items-center">
                <Link href={linkHref!} className={cn("inline-flex w-full sm:w-auto", ctaClass)}>
                  {actionLabel}
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
                {isSecondaryLink ? (
                  <Link
                    href={secondaryHref!}
                    className={cn("inline-flex w-full sm:w-auto", secondaryClass)}
                  >
                    {secondaryActionLabel}
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                ) : null}
              </div>
            ) : isSecondaryLink ? (
              <div className="w-full sm:w-auto">
                <Link href={secondaryHref!} className={cn("inline-flex w-full sm:w-auto", secondaryClass)}>
                  {secondaryActionLabel}
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
