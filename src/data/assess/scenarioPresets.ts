import type { TowerId, TowerScenario } from "./types";

export type ScenarioPresetId = "conservative" | "base" | "aggressive";

export type ScenarioPreset = {
  id: ScenarioPresetId;
  label: string;
  /** One-line description anchored in Versant context. */
  blurb: string;
  /**
   * Per-tower offshore + AI dial values. Keys are the same tower ids used in
   * `src/data/towers.ts` and `AssessProgramV2.scenarios`. Missing keys leave
   * the user's existing dial alone — Workshops, Service, etc. fall back.
   */
  values: Partial<Record<TowerId, TowerScenario>>;
};

/**
 * Three scenario shapes anchored to Versant's actual context (BB- credit, NBCU
 * TSA expiration, on-air talent, political brand sensitivity, BlackLine /
 * Eightfold tooling, multi-entity JV close). The numbers are workshop starting
 * points, not Versant-reported.
 *
 * Conservative — leadership-defensible floor: keeps editorial / production /
 * sales relationship work onshore, stages AI behind 6 months of agent maturity.
 *
 * Base — the cost-weighted baseline used in the seeded program once tower leads
 * confirm starter defaults. The dials approximate the 4 % / 9 % uncapped /
 * capped band that drops the program to roughly 25 % blended OpEx reduction.
 *
 * Aggressive — what's plausible if every tower hits its addressable ceiling
 * (helpdesk fully offshored, full agent rollout against on-prem legacy stacks
 * decommissioned, Editorial co-pilot adopted past pilot).
 */
export const SCENARIO_PRESETS: Record<ScenarioPresetId, ScenarioPreset> = {
  conservative: {
    id: "conservative",
    label: "Conservative",
    blurb:
      "Keeps editorial / production / sales relationship work onshore and stages AI rollout behind 6 months of agent maturity. Defensible floor for the BB- credit committee.",
    values: {
      finance: { scenarioOffshorePct: 35, scenarioAIPct: 35 },
      hr: { scenarioOffshorePct: 30, scenarioAIPct: 30 },
      "research-analytics": { scenarioOffshorePct: 25, scenarioAIPct: 40 },
      legal: { scenarioOffshorePct: 15, scenarioAIPct: 25 },
      "corp-services": { scenarioOffshorePct: 30, scenarioAIPct: 25 },
      "tech-engineering": { scenarioOffshorePct: 40, scenarioAIPct: 35 },
      "operations-technology": { scenarioOffshorePct: 15, scenarioAIPct: 25 },
      sales: { scenarioOffshorePct: 10, scenarioAIPct: 25 },
      "marketing-comms": { scenarioOffshorePct: 20, scenarioAIPct: 30 },
      service: { scenarioOffshorePct: 35, scenarioAIPct: 35 },
      "editorial-news": { scenarioOffshorePct: 5, scenarioAIPct: 15 },
      production: { scenarioOffshorePct: 10, scenarioAIPct: 20 },
      "programming-dev": { scenarioOffshorePct: 10, scenarioAIPct: 20 },
    },
  },
  base: {
    id: "base",
    label: "Base",
    blurb:
      "Cost-weighted starter heuristic — the dials the 13 tower leads land on after a workshop on the seeded defaults. Anchors the OpEx case in the investment deck.",
    values: {
      finance: { scenarioOffshorePct: 50, scenarioAIPct: 55 },
      hr: { scenarioOffshorePct: 40, scenarioAIPct: 45 },
      "research-analytics": { scenarioOffshorePct: 35, scenarioAIPct: 60 },
      legal: { scenarioOffshorePct: 25, scenarioAIPct: 45 },
      "corp-services": { scenarioOffshorePct: 40, scenarioAIPct: 40 },
      "tech-engineering": { scenarioOffshorePct: 55, scenarioAIPct: 55 },
      "operations-technology": { scenarioOffshorePct: 25, scenarioAIPct: 40 },
      sales: { scenarioOffshorePct: 20, scenarioAIPct: 45 },
      "marketing-comms": { scenarioOffshorePct: 30, scenarioAIPct: 50 },
      service: { scenarioOffshorePct: 50, scenarioAIPct: 55 },
      "editorial-news": { scenarioOffshorePct: 10, scenarioAIPct: 30 },
      production: { scenarioOffshorePct: 20, scenarioAIPct: 35 },
      "programming-dev": { scenarioOffshorePct: 20, scenarioAIPct: 35 },
    },
  },
  aggressive: {
    id: "aggressive",
    label: "Aggressive",
    blurb:
      "Every addressable lever hit — helpdesk fully offshored, agents past pilot in Finance close, Editorial co-pilot adopted across the news desk. Upside case if execution holds.",
    values: {
      finance: { scenarioOffshorePct: 65, scenarioAIPct: 70 },
      hr: { scenarioOffshorePct: 55, scenarioAIPct: 60 },
      "research-analytics": { scenarioOffshorePct: 50, scenarioAIPct: 70 },
      legal: { scenarioOffshorePct: 40, scenarioAIPct: 60 },
      "corp-services": { scenarioOffshorePct: 55, scenarioAIPct: 55 },
      "tech-engineering": { scenarioOffshorePct: 70, scenarioAIPct: 70 },
      "operations-technology": { scenarioOffshorePct: 40, scenarioAIPct: 55 },
      sales: { scenarioOffshorePct: 35, scenarioAIPct: 60 },
      "marketing-comms": { scenarioOffshorePct: 45, scenarioAIPct: 65 },
      service: { scenarioOffshorePct: 65, scenarioAIPct: 70 },
      "editorial-news": { scenarioOffshorePct: 20, scenarioAIPct: 40 },
      production: { scenarioOffshorePct: 35, scenarioAIPct: 50 },
      "programming-dev": { scenarioOffshorePct: 35, scenarioAIPct: 50 },
    },
  },
};

export const SCENARIO_PRESET_ORDER: ScenarioPresetId[] = ["conservative", "base", "aggressive"];
