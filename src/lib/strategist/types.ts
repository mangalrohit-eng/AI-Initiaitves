/**
 * AI Transformation Strategist — output types for the Cross-Tower
 * "Outcome Clusters" view.
 *
 * Three outputs are authored in a single LLM pass:
 *
 *   Output 1 — Business Outcome Clusters: 4-6 cross-tower outcomes the
 *              AI plan should drive (e.g. "Legal as a Predictive Risk &
 *              Opportunity Engine"). Business-outcome-led, not tool-led.
 *   Output 2 — Discrete AI Initiatives per cluster: 4-7 named initiatives
 *              with current state, future state, value category, sizing
 *              tier (HIGH/MEDIUM/LOW), and dependencies.
 *   Output 3 — Orchestration & Data Layer: shared infrastructure the
 *              plan implies (data flows, identity / entity / content
 *              resolution, agent-to-agent APIs, governance), plus which
 *              initiatives are blocked without the layer.
 *
 * Cluster ids are deterministic kebab-case slugs of the cluster title so
 * Step 4 can link back to a stable target without server round-trip.
 */

import type { TowerId } from "@/data/assess/types";

export type ValueCategory =
  | "Cost avoidance"
  | "FTE redeployment"
  | "Revenue acceleration"
  | "Risk reduction";

export type ValueSizingTier = "HIGH" | "MEDIUM" | "LOW";

/** Output 1 — one Business Outcome Cluster. */
export type OutcomeCluster = {
  /** Deterministic kebab-case slug of `title`. Stable across runs. */
  id: string;
  /** Headline, e.g. "Legal as a Predictive Risk & Opportunity Engine". */
  title: string;
  /** 2-3 sentence Versant-grounded narrative. */
  narrative: string;
  /** Tower ids this cluster spans (canonical TowerId strings). */
  towers: TowerId[];
  /** Headline outcome metric, e.g. "Days from contract to risk score". */
  headlineMetric?: string;
};

/** Output 2 — one Discrete AI Initiative inside a cluster. */
export type StrategistInitiative = {
  /** Deterministic kebab-case slug of `name`. */
  id: string;
  /** Cluster this initiative slots under. References `OutcomeCluster.id`. */
  clusterId: string;
  /** Initiative name, 5-10 words, action+object. */
  name: string;
  /** Tower ids the initiative touches. */
  towers: TowerId[];
  /** What FTEs / tools do today (Versant-grounded). */
  currentState: string;
  /** What agents / models / automation will do instead. */
  futureState: string;
  /** Value category — one or more. */
  valueCategories: ValueCategory[];
  /** HIGH / MEDIUM / LOW — relative impact, NOT dollar figures. */
  valueTier: ValueSizingTier;
  /** Data, systems, or other initiatives this depends on. */
  dependencies: string[];
};

/** Output 3 — one shared infrastructure block. */
export type OrchestrationBlock = {
  /** What data flows between which towers (1-3 sentences). */
  dataFlows: string;
  /** What identity / entity / content resolution is required. */
  identityResolution: string;
  /** Agent-to-agent APIs or event streams. */
  agentApis: string;
  /** Governance, policy, and access controls above the layer. */
  governance: string;
  /** Initiative ids blocked without the layer. */
  blockedInitiativeIds: string[];
  /** Open-ended "why orchestration cannot be built initiative-by-initiative". */
  whyShared: string;
};

export type StrategistOutputs = {
  clusters: OutcomeCluster[];
  initiatives: StrategistInitiative[];
  orchestration: OrchestrationBlock;
  modelId: string;
  promptVersion: string;
  generatedAt: string;
  /** Hash of the strategist input — cache key. */
  inputHash: string;
};

/**
 * Deterministic kebab-case slug — used to derive `cluster.id` from
 * `cluster.title` and `initiative.id` from `initiative.name`. Mirrors
 * the prompt rule so the server validator can detect drift.
 */
export function slugifyForId(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "x"
  );
}
