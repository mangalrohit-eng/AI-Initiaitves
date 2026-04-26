"use client";

import * as React from "react";
import { animate, useMotionValue, type AnimationPlaybackControls } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = {
  /** Dollar value to render. Updates animate continuously as the value ticks. */
  value: number;
  /** Whether to show the trailing currency unit. Defaults to true. */
  showUnit?: boolean;
  /** Force a specific unit; otherwise auto-picks B / M / K. */
  forceUnit?: "B" | "M" | "K" | "raw";
  /** Decimal places for auto-units (B/M default 2, K default 0). */
  decimals?: number;
  className?: string;
  /** Animation duration in seconds. Default 0.7 — fast enough to feel live. */
  durationSec?: number;
  /** When true, prefixes the rendered string with `$`. Default true. */
  prefix?: boolean;
};

/**
 * Smooth animated money counter — the headline impact number on the home and
 * summary pages, and the inline modeled-$ delta on each tower lever row.
 *
 * Updates ride a `useMotionValue` driven by `framer-motion`'s `animate` so a
 * slider drag re-targets without restarting from zero — the number ticks from
 * its current state to the new value.
 */
export function MoneyCounter({
  value,
  showUnit = true,
  forceUnit,
  decimals,
  className,
  durationSec = 0.7,
  prefix = true,
}: Props) {
  const mv = useMotionValue(value);
  const [display, setDisplay] = React.useState(value);
  const controlsRef = React.useRef<AnimationPlaybackControls | null>(null);

  React.useEffect(() => {
    controlsRef.current?.stop();
    controlsRef.current = animate(mv, value, {
      duration: durationSec,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    return () => {
      controlsRef.current?.stop();
    };
  }, [value, durationSec, mv]);

  return (
    <span className={cn("tabular-nums", className)}>
      {formatMoney(display, { showUnit, forceUnit, decimals, prefix })}
    </span>
  );
}

export function formatMoney(
  value: number,
  opts: { showUnit?: boolean; forceUnit?: "B" | "M" | "K" | "raw"; decimals?: number; prefix?: boolean } = {},
): string {
  const { showUnit = true, forceUnit, decimals, prefix = true } = opts;
  const abs = Math.abs(value);
  const $ = prefix ? "$" : "";
  if (forceUnit === "raw") {
    return `${value < 0 ? "-" : ""}${$}${Math.round(abs).toLocaleString()}`;
  }
  if (forceUnit === "B" || (!forceUnit && abs >= 1_000_000_000)) {
    const d = decimals ?? 2;
    return `${value < 0 ? "-" : ""}${$}${(abs / 1_000_000_000).toFixed(d)}${showUnit ? "B" : ""}`;
  }
  if (forceUnit === "M" || (!forceUnit && abs >= 1_000_000)) {
    const d = decimals ?? 1;
    return `${value < 0 ? "-" : ""}${$}${(abs / 1_000_000).toFixed(d)}${showUnit ? "M" : ""}`;
  }
  if (forceUnit === "K" || (!forceUnit && abs >= 1_000)) {
    const d = decimals ?? 0;
    return `${value < 0 ? "-" : ""}${$}${(abs / 1_000).toFixed(d)}${showUnit ? "K" : ""}`;
  }
  return `${value < 0 ? "-" : ""}${$}${Math.round(abs).toLocaleString()}`;
}

/**
 * Lightweight animated percent counter — used in cinematic scoreboards on the
 * tower assessment page where the cost-weighted dial moves with each drag.
 */
export function PercentCounter({
  value,
  decimals = 1,
  className,
  durationSec = 0.7,
}: {
  value: number;
  decimals?: number;
  className?: string;
  durationSec?: number;
}) {
  const mv = useMotionValue(value);
  const [display, setDisplay] = React.useState(value);
  const controlsRef = React.useRef<AnimationPlaybackControls | null>(null);

  React.useEffect(() => {
    controlsRef.current?.stop();
    controlsRef.current = animate(mv, value, {
      duration: durationSec,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    return () => {
      controlsRef.current?.stop();
    };
  }, [value, durationSec, mv]);

  return (
    <span className={cn("tabular-nums", className)}>
      {display.toFixed(decimals)}%
    </span>
  );
}
