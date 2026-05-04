// Single source of truth for AI priority visual language.
//
// Two priority concepts coexist in the codebase:
//
//   - `Tier` ("P1" | "P2" | "P3") — the active program-level tiering surfaced
//     across the cross-tower views. Driven by `ProgramTier` (which adds a
//     "Deprioritized" bucket); use `tierFromProgramTier()` to convert.
//   - `AiPriority` (the legacy "P1 — Immediate (0-6mo)" full string) — still
//     present on canonical operating-model rows as a back-compat input to the
//     binary `feasibility` derivation; never displayed as a priority chip.
//
// Visual tokens (`TIER_HEX`, `TIER_STYLES`, `TIER_META`) are kept stable so
// every chart, badge, and roadmap card pulls from the same palette.
//
// Red is deliberately retired from priority and reserved for risk surfaces.
// P1 uses deep navy (gravitas, "lead first") and sits clearly away from the
// brand accent purple (#A100FF) to avoid visual confusion.

import type { LucideIcon } from "lucide-react";
import { Clock, Rocket, Target } from "lucide-react";
import type { ProgramTier } from "@/data/types";

export type Tier = "P1" | "P2" | "P3";

/**
 * Convert a `ProgramTier` (which includes "Deprioritized") into the visual
 * `Tier` used by every chart / badge token. Returns `null` for the
 * Deprioritized bucket — callers render a muted gray treatment instead.
 */
export function tierFromProgramTier(pt: ProgramTier | undefined | null): Tier | null {
  if (!pt) return null;
  if (pt === "P1" || pt === "P2" || pt === "P3") return pt;
  return null;
}

export function tierFromShort(p?: "P1" | "P2" | "P3" | string): Tier | null {
  if (!p) return null;
  if (p === "P1" || p === "P2" || p === "P3") return p;
  return null;
}

// Hex values are starting points; kept centralized so they can be tuned once.
export const TIER_HEX: Record<Tier, { solid: string; soft: string; deep: string }> = {
  P1: { solid: "#0F3460", soft: "rgba(15, 52, 96, 0.08)", deep: "#0B274A" },
  P2: { solid: "#FFB300", soft: "rgba(255, 179, 0, 0.12)", deep: "#B37A00" },
  P3: { solid: "#00BFA5", soft: "rgba(0, 191, 165, 0.1)", deep: "#00806E" },
};

/**
 * Muted-gray treatment for the "Deprioritized" bucket. Visually distinct
 * from any active P-tier — surfaces it as below-the-line context without
 * competing for attention with in-plan initiatives.
 */
export const DEPRIORITIZED_HEX = {
  solid: "#6B7280",
  soft: "rgba(107, 114, 128, 0.08)",
  deep: "#374151",
};

export const DEPRIORITIZED_STYLES = {
  badge: "border-slate-300 bg-slate-100 text-slate-700",
  row: "bg-slate-50",
  dot: "bg-slate-500",
  border: "border-slate-300",
} as const;

// Tailwind-style class strings used by landscape rows, roadmap cards, and dots.
export const TIER_STYLES: Record<Tier, { badge: string; row: string; dot: string; border: string }> = {
  P1: {
    badge: "border-[#0F3460]/30 bg-[#0F3460]/10 text-[#0B274A]",
    row: "bg-[#0F3460]/[0.04]",
    dot: "bg-[#0F3460]",
    border: "border-[#0F3460]/25",
  },
  P2: {
    badge: "border-[#FFB300]/50 bg-[#FFB300]/15 text-amber-900",
    row: "bg-[#FFB300]/[0.05]",
    dot: "bg-[#FFB300]",
    border: "border-[#FFB300]/35",
  },
  P3: {
    badge: "border-[#00BFA5]/45 bg-[#00BFA5]/10 text-emerald-900",
    row: "bg-[#00BFA5]/[0.05]",
    dot: "bg-[#00BFA5]",
    border: "border-[#00BFA5]/35",
  },
};

// Metadata for the roadmap columns (label, time window, icon, gradient).
//
// `label` carries the new 2x2 semantics — "Quick Wins" / "Fill-ins" /
// "Strategic Builds" — replacing the old "Immediate / Near-term / Medium-term"
// horizon framing. Default phase starts align with `PHASE_START_MONTHS`
// (P1=M1, P2=M6, P3=M12); the windows below are planning horizons those
// starts imply, not statements of relative importance.
export const TIER_META: Record<
  Tier,
  { label: string; window: string; gradient: string; ring: string; icon: LucideIcon }
> = {
  P1: {
    label: "Quick Wins",
    window: "0–6 months · high feasibility, high impact",
    gradient: "from-[#0F3460] to-[#2A5A9E]",
    ring: "border-[#0F3460]/25 bg-[#0F3460]/5",
    icon: Rocket,
  },
  P2: {
    label: "Fill-ins",
    window: "6–12 months · high feasibility, lower impact",
    gradient: "from-[#FFB300] to-[#FFD64A]",
    ring: "border-[#FFB300]/35 bg-[#FFB300]/5",
    icon: Clock,
  },
  P3: {
    label: "Strategic Builds",
    window: "12–24 months · lower feasibility, high impact",
    gradient: "from-[#00BFA5] to-[#4DD4BE]",
    ring: "border-[#00BFA5]/35 bg-[#00BFA5]/5",
    icon: Target,
  },
};
