"use client";

import type { SelectProgramResult } from "@/lib/initiatives/selectProgram";
import { ArchitectureStackDiagram } from "./techView/ArchitectureStackDiagram";
import { RequestFlowDiagram } from "./techView/RequestFlowDiagram";
import { TowerAgentMapTable } from "./techView/TowerAgentMapTable";

/**
 * Tech View tab body — three stacked subviews:
 *
 *   1. ArchitectureStackDiagram — six-layer top-down stack with vendor pills
 *      and NBCU TSA carve-out callouts.
 *   2. RequestFlowDiagram — eight-step end-to-end flow with determinism-
 *      boundary annotations under each step.
 *   3. TowerAgentMapTable — 13-row table joining the static tower-agent
 *      blueprint with live counts from `program.architecture`.
 *
 * Fully deterministic — Tech View has no LLM authorship.
 */
export function TechViewModule({ program }: { program: SelectProgramResult }) {
  return (
    <div className="space-y-8">
      <ArchitectureStackDiagram />
      <div className="border-t border-forge-border" aria-hidden />
      <RequestFlowDiagram />
      <div className="border-t border-forge-border" aria-hidden />
      <TowerAgentMapTable program={program} />
    </div>
  );
}
