/**
 * Ask Forge — Q&A surface that answers questions across the authored Versant
 * corpus AND the user's live workshop data (FTE rows, dials, modeled savings).
 *
 * The LLM returns a strict JSON envelope (validated server-side) made of
 * typed `AskBlock` cards. The client renders each block with a real
 * component — ranked bar chart, tower snapshot, metric tile, etc. — never
 * markdown. ClientMode redaction happens at render time so persisted
 * conversation history correctly redacts when the toggle flips after the
 * fact.
 */

import type { ImpactTier } from "@/data/types";

/** Citation kinds — drive the icon on the chip and the provenance drawer's source-row layout. */
export type AskCitationKind =
  | "tower"
  | "process"
  | "brief"
  | "workshopRow"
  | "capNode"
  | "versantContext";

export type AskCitation = {
  kind: AskCitationKind;
  /** Stable id within the kind (tower id, brief id, workshop row id, etc.). */
  id: string;
  /** Human-readable label rendered on the chip. */
  label: string;
  /** Optional in-app deep link the chip routes to when clicked. */
  href?: string;
};

/** One numeric series item on a ranking / breakdown block. */
export type AskSeriesItem = {
  label: string;
  value: number;
  sublabel?: string;
};

/** Common subtype on every block — citations indexed to the block. */
type AskBlockBase = {
  /** Optional citations specific to this block. */
  citations?: AskCitation[];
};

/** Hero metric — single big mono number with trend + subtext. */
export type AskMetricBlock = AskBlockBase & {
  kind: "metric";
  label: string;
  /**
   * Pre-formatted display string when the LLM wants to emit a string
   * directly (e.g. "TBD" or "—"). Numeric `numericValue` is preferred
   * for AnimatedNumber count-up; if both are set, numeric wins.
   */
  value: string;
  numericValue?: number;
  /** Unit suffix appended to numeric values. Hidden when `useRedactDollars()` is on for `$`. */
  unit?: "FTE" | "$" | "%" | "rows" | "towers" | "initiatives";
  subtext?: string;
  trend?: "up" | "down" | "flat";
};

/** Top-N ranked list with horizontal bars (recharts). */
export type AskRankingBlock = AskBlockBase & {
  kind: "ranking";
  title: string;
  /** Drives axis label and ClientMode redaction. */
  unit: "FTE" | "$" | "%" | "count" | "rows";
  items: AskSeriesItem[];
};

/** Stacked / grouped breakdown — onshore vs offshore, contractor vs FTE, etc. */
export type AskBreakdownBlock = AskBlockBase & {
  kind: "breakdown";
  title: string;
  unit: "FTE" | "$" | "%";
  /** Rows are categories (e.g. towers), each with the same series keys. */
  rows: { label: string; segments: { name: string; value: number }[] }[];
};

/** Side-by-side comparison card. */
export type AskCompareBlock = AskBlockBase & {
  kind: "compare";
  left: { title: string; lines: string[] };
  right: { title: string; lines: string[] };
};

/** Tower at-a-glance card. */
export type AskTowerSnapshotBlock = AskBlockBase & {
  kind: "towerSnapshot";
  /** Canonical tower id (e.g. `editorial-news`). */
  towerId: string;
  name: string;
  versantLeads: string[];
  accentureLeads: string[];
  impactTier: ImpactTier;
  topOpportunity: string;
  kpis: { label: string; value: string }[];
};

/** Initiative (AI Process Brief) summary. */
export type AskInitiativeBlock = AskBlockBase & {
  kind: "initiative";
  briefId: string;
  name: string;
  /** Brief routing tier — never "P3" (briefs only carry P1/P2). */
  tier: "P1" | "P2";
  impactTier: ImpactTier;
  towerId: string;
  agents: string[];
  tools: string[];
  keyMetric: string;
};

/** Brand-affinity result — surfaces narrative mentions across the corpus. */
export type AskBrandLensBlock = AskBlockBase & {
  kind: "brandLens";
  brand: string;
  mentions: { kind: "tower" | "brief" | "capNode" | "process"; id: string; label: string }[];
};

/** Plain text — backtick markers become mono spans. NO markdown. */
export type AskProseBlock = AskBlockBase & {
  kind: "prose";
  text: string;
};

/** Soft callout — TBD / redaction notice / empty-workshop state. */
export type AskNoteBlock = AskBlockBase & {
  kind: "note";
  severity: "info" | "warn";
  text: string;
};

/** Discriminated union of every renderable block. */
export type AskBlock =
  | AskMetricBlock
  | AskRankingBlock
  | AskBreakdownBlock
  | AskCompareBlock
  | AskTowerSnapshotBlock
  | AskInitiativeBlock
  | AskBrandLensBlock
  | AskProseBlock
  | AskNoteBlock;

/** What the LLM returns per turn. */
export type AskAssistantResponse = {
  blocks: AskBlock[];
  citations: AskCitation[];
  followUps: string[];
};

/** One turn in the conversation. */
export type AskMessage =
  | {
      role: "user";
      id: string;
      content: string;
      createdAt: string;
    }
  | {
      role: "assistant";
      id: string;
      response: AskAssistantResponse;
      createdAt: string;
      modelId?: string;
      latencyMs?: number;
      /** Set when the turn ended in error (network / rate-limit / abort). */
      error?: { code: AskErrorCode; message: string };
    };

export type AskErrorCode =
  | "rate_limit"
  | "api_key_missing"
  | "prompt_too_large"
  | "user_aborted"
  | "network"
  | "validation_failed"
  | "timeout"
  | "unknown";

/* =====================================================================
 * Streaming protocol — newline-delimited JSON events
 * ==================================================================== */

export type AskStreamEvent =
  | { kind: "stage"; stage: AskStage; label: string }
  | { kind: "blocks"; blocks: AskBlock[] }
  | { kind: "citations"; citations: AskCitation[] }
  | { kind: "followUps"; followUps: string[] }
  | { kind: "meta"; modelId: string; latencyMs: number }
  | { kind: "error"; code: AskErrorCode; message: string }
  | { kind: "done" };

export type AskStage =
  | "received"
  | "reading_workshop"
  | "cross_ref"
  | "compiling"
  | "drafting"
  | "validating";

/* =====================================================================
 * Request body — the shape the client sends to /api/ask
 * ==================================================================== */

export type AskRequestBody = {
  /** Trimmed conversation history (last N turns). The current user prompt is the last entry. */
  messages: AskRequestMessage[];
  /** Client-computed program digest (FTE roll-ups, top-N aggregates, etc.). */
  programDigest: ProgramDigest;
  /** When true, modeled-$ figures are stripped from the digest and the prompt forbids emitting them. */
  clientMode: boolean;
};

export type AskRequestMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string };

/* =====================================================================
 * Program digest — compact roll-up of AssessProgramV5 + scenarioModel
 * ==================================================================== */

export type ProgramDigest = {
  hasWorkshopData: boolean;
  /** ISO timestamp of the most recent tower update. */
  lastUpdated?: string;
  totals: ProgramTotals;
  perTower: TowerDigest[];
  topAggregates: ProgramTopAggregates;
  /** True when ClientMode was on at digest-build time — server defends in depth. */
  clientModeRedacted: boolean;
};

export type ProgramTotals = {
  towerCount: number;
  contributingTowerCount: number;
  l4RowCount: number;
  fteOnshore: number;
  fteOffshore: number;
  contractorOnshore: number;
  contractorOffshore: number;
  /** Total program FTE (sum of FTE + contractor onshore + offshore). */
  totalHeadcount: number;
  /** Modeled annual cost across all rows. Replaced with `null` when ClientMode is on. */
  poolUsd: number | null;
  modeledOffshoreUsd: number | null;
  modeledAiUsd: number | null;
  modeledCombinedUsd: number | null;
  weightedOffshorePct: number;
  weightedAiPct: number;
};

export type TowerDigest = {
  towerId: string;
  towerName: string;
  rowCount: number;
  fteOnshore: number;
  fteOffshore: number;
  contractorOnshore: number;
  contractorOffshore: number;
  totalHeadcount: number;
  poolUsd: number | null;
  weightedOffshorePct: number;
  weightedAiPct: number;
  modeledOffshoreUsd: number | null;
  modeledAiUsd: number | null;
  modeledCombinedUsd: number | null;
  /** Top L3 (Job Family) headcount roll-ups inside this tower — top 5. */
  topL3sByHeadcount: { l3: string; totalHeadcount: number; rowCount: number }[];
  /** Top L4 rows by offshore plan % — top 5. */
  topL4sByOffshorePct: { l4Id: string; l4: string; l3: string; offshorePct: number; totalHeadcount: number }[];
  /** Top L4 rows by total modeled saving — top 5. */
  topL4sByModeledSaving: { l4Id: string; l4: string; l3: string; modeledCombinedUsd: number | null; totalHeadcount: number }[];
};

export type ProgramTopAggregates = {
  /** Top 5 towers by total headcount. */
  topTowersByHeadcount: { towerId: string; towerName: string; totalHeadcount: number }[];
  /** Top 5 towers by modeled combined saving (null entries when ClientMode is on). */
  topTowersByModeledSaving: { towerId: string; towerName: string; modeledCombinedUsd: number | null }[];
  /** Top 5 towers by weighted offshore plan %. */
  topTowersByOffshorePct: { towerId: string; towerName: string; weightedOffshorePct: number }[];
  /** Top 10 L4 rows program-wide by offshore plan %. */
  topL4sByOffshorePct: {
    towerId: string;
    towerName: string;
    l4Id: string;
    l4: string;
    l3: string;
    offshorePct: number;
    totalHeadcount: number;
  }[];
  /** Top 10 L4 rows program-wide by modeled combined saving. */
  topL4sByModeledSaving: {
    towerId: string;
    towerName: string;
    l4Id: string;
    l4: string;
    l3: string;
    modeledCombinedUsd: number | null;
    totalHeadcount: number;
  }[];
};

/* =====================================================================
 * Static corpus digest — server-cached compact view of authored content
 * ==================================================================== */

export type StaticCorpusDigest = {
  towers: StaticTowerDigest[];
  briefs: StaticBriefDigest[];
  /** Brand list pulled from `buildVersantContext` for cross-reference. */
  brands: string[];
};

export type StaticTowerDigest = {
  id: string;
  name: string;
  versantLeads: string[];
  accentureLeads: string[];
  impactTier: ImpactTier;
  totalProcesses: number;
  aiEligibleProcesses: number;
  topOpportunityHeadline: string;
  narrativeSummary?: string;
  /** Brand names mentioned in the tower's description / narrative. */
  brandsMentioned: string[];
};

export type StaticBriefDigest = {
  id: string;
  name: string;
  towerId: string;
  briefRoutingTier: "P1" | "P2";
  impactTier: ImpactTier;
  keyMetric: string;
  agents: string[];
  tools: string[];
  brandsMentioned: string[];
};
