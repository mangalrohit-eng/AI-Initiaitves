// Single source of truth for AI priority visual language.
// Red is deliberately retired from priority and reserved for risk surfaces.
// P1 uses deep navy (gravitas, "lead first") and sits clearly away from the
// brand accent purple (#A100FF) to avoid visual confusion.

import type { AiPriority } from "@/data/types";
import type { LucideIcon } from "lucide-react";
import { Clock, Rocket, Target } from "lucide-react";

export type Tier = "P1" | "P2" | "P3";

export function priorityTier(p?: AiPriority): Tier | null {
  if (!p) return null;
  if (p.startsWith("P1")) return "P1";
  if (p.startsWith("P2")) return "P2";
  if (p.startsWith("P3")) return "P3";
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
export const TIER_META: Record<
  Tier,
  { label: string; window: string; gradient: string; ring: string; icon: LucideIcon }
> = {
  P1: {
    label: "Immediate",
    window: "0–6 months",
    gradient: "from-[#0F3460] to-[#2A5A9E]",
    ring: "border-[#0F3460]/25 bg-[#0F3460]/5",
    icon: Rocket,
  },
  P2: {
    label: "Near-term",
    window: "6–12 months",
    gradient: "from-[#FFB300] to-[#FFD64A]",
    ring: "border-[#FFB300]/35 bg-[#FFB300]/5",
    icon: Clock,
  },
  P3: {
    label: "Medium-term",
    window: "12–24 months",
    gradient: "from-[#00BFA5] to-[#4DD4BE]",
    ring: "border-[#00BFA5]/35 bg-[#00BFA5]/5",
    icon: Target,
  },
};
