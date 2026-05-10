import * as React from "react";
import type { Process, SolutionBrief } from "@/data/types";
import { deriveSolutionBriefFromProcess } from "@/lib/assess/curateBriefLLM";
import { WhatItDoesSection } from "./sections/WhatItDoesSection";
import { HowItWorksSection } from "./sections/HowItWorksSection";
import { SourcingApproachSection } from "./sections/SourcingApproachSection";
import { BuyOptionsSection } from "./sections/BuyOptionsSection";
import { ReferenceArchitectureSection } from "./sections/ReferenceArchitectureSection";
import { AgentsToDevelopSection } from "./sections/AgentsToDevelopSection";

/**
 * Renders the six-section client narrative for an AI Solution.
 *
 * Source of truth is `Process.solutionBrief`; if absent (legacy cache
 * predating the curate-brief prompt v2026-05-solution-brief upgrade),
 * derives a deterministic fallback brief from the rest of the
 * `Process` so the layout still renders. The detail page surfaces a
 * "regenerate to refresh" hint elsewhere when the cache is stale.
 *
 * The order is fixed so the narrative reads top-to-bottom:
 *   A. What it does
 *   B. How it works
 *   C. Sourcing verdict
 *   D. Vendor / buy options (hidden when empty)
 *   E. Reference architecture
 *   F. AI agents to develop (hidden on pure Buy verdicts with no
 *      build-side agents)
 */
export function SolutionBriefView({ process }: { process: Process }) {
  const brief: SolutionBrief =
    process.solutionBrief ?? deriveSolutionBriefFromProcess(process);

  // Section D's framing changes based on the sourcing verdict so a
  // "Build" page that still lists adjacent vendors doesn't read as a
  // contradiction.
  const buyVariant: "buy" | "adjacent" =
    brief.sourcing.approach === "Buy" ? "buy" : "adjacent";

  return (
    <div className="space-y-5">
      <WhatItDoesSection brief={brief} painPoints={process.currentPainPoints} />
      <HowItWorksSection brief={brief} />
      <SourcingApproachSection brief={brief} />
      <BuyOptionsSection brief={brief} variant={buyVariant} />
      <ReferenceArchitectureSection brief={brief} />
      <AgentsToDevelopSection brief={brief} />
    </div>
  );
}
