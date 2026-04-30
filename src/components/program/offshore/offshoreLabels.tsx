import * as React from "react";
import type { AssessProgramV2 } from "@/data/assess/types";
import type {
  CarveOutClass,
  CarveOutFlag,
  GccDestination,
  UsLocation,
} from "@/lib/offshore/selectOffshorePlan";
import { offshoreLocationLabels } from "@/lib/offshore/offshoreLocationLabels";

/** Pretty-print a US source location enum to a chip-friendly label. */
export function usLocationLabel(loc: UsLocation): string {
  switch (loc) {
    case "NycHq":
      return "NYC HQ";
    case "EnglewoodCliffs":
      return "Englewood Cliffs NJ";
    case "DcBureau":
      return "DC bureau";
    case "Distributed":
      return "Distributed";
  }
}

/**
 * Pretty-print a destination enum. The `program` argument carries the user's
 * GCC location assumptions — primary / secondary city + contact-center hub —
 * so the label always reflects the currently-configured names.
 */
export function destinationLabel(
  dest: GccDestination,
  program: AssessProgramV2,
): string {
  const labels = offshoreLocationLabels(program);
  switch (dest) {
    case "PrimaryGcc":
      return `${labels.primary} GCC`;
    case "SecondaryGcc":
      return `${labels.secondary} GCC`;
    case "ContactCenterHub":
      return labels.hasHub ? `${labels.hub} contact` : `${labels.primary} GCC`;
    case "OnshoreRetained":
      return "Onshore retained";
  }
}

/** Lane label for the 4-bucket scope view. */
export function carveOutClassLabel(c: CarveOutClass): string {
  switch (c) {
    case "GccEligible":
      return "GCC-eligible";
    case "GccWithOverlay":
      return "GCC + onshore overlay";
    case "OnshoreRetained":
      return "Onshore retained";
    case "EditorialCarveOut":
      return "Editorial / talent carve-out";
  }
}

/** Color tokens for a carve-out class — used as the lane accent + chip border. */
export function carveOutClassAccent(c: CarveOutClass): {
  border: string;
  bg: string;
  text: string;
  dot: string;
} {
  switch (c) {
    case "GccEligible":
      return {
        border: "border-accent-purple/40",
        bg: "bg-accent-purple/5",
        text: "text-accent-purple-dark",
        dot: "bg-accent-purple",
      };
    case "GccWithOverlay":
      return {
        border: "border-accent-teal/40",
        bg: "bg-accent-teal/5",
        text: "text-accent-teal",
        dot: "bg-accent-teal",
      };
    case "OnshoreRetained":
      return {
        border: "border-accent-amber/40",
        bg: "bg-accent-amber/5",
        text: "text-accent-amber",
        dot: "bg-accent-amber",
      };
    case "EditorialCarveOut":
      return {
        border: "border-accent-red/40",
        bg: "bg-accent-red/5",
        text: "text-accent-red",
        dot: "bg-accent-red",
      };
  }
}

/** Chip color by carve-out flag (mirrors the design-system priority palette). */
export function carveOutFlagAccent(flag: CarveOutFlag): {
  border: string;
  bg: string;
  text: string;
} {
  switch (flag) {
    case "Editorial":
      return {
        border: "border-accent-red/40",
        bg: "bg-accent-red/10",
        text: "text-accent-red",
      };
    case "Talent":
      return {
        border: "border-accent-amber/40",
        bg: "bg-accent-amber/10",
        text: "text-accent-amber",
      };
    case "SOX":
      return {
        border: "border-accent-teal/40",
        bg: "bg-accent-teal/10",
        text: "text-accent-teal",
      };
    case "Sales":
      return {
        border: "border-accent-purple/40",
        bg: "bg-accent-purple/10",
        text: "text-accent-purple-dark",
      };
  }
}

/** Format an integer as e.g. `1,200`. Always rounds; never returns NaN. */
export function fmtInt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return Math.round(n).toLocaleString("en-US");
}

/** Compact <chip> primitive for any of the labeled enums above. */
export function Chip({
  children,
  border,
  bg,
  text,
  className,
}: {
  children: React.ReactNode;
  border: string;
  bg: string;
  text: string;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        border,
        bg,
        text,
        className ?? "",
      ].join(" ")}
    >
      {children}
    </span>
  );
}

/** Tier color — High / Medium / Low. */
export function tierAccent(tier: "HIGH" | "MEDIUM" | "LOW"): string {
  if (tier === "HIGH") return "text-accent-red";
  if (tier === "MEDIUM") return "text-accent-amber";
  return "text-accent-teal";
}
