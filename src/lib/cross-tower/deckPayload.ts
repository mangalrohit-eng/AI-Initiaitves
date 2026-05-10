/**
 * Cross-Tower AI Plan — print deck payload (localStorage bridge).
 *
 * `sessionStorage` is **per tab** — a tab opened with `window.open` cannot read
 * the opener's sessionStorage, so the deck uses **localStorage** (same-origin,
 * shared across tabs). The next Export overwrites the same key (we avoid
 * remove-on-read so React Strict Mode's double effect in dev does not clear
 * the payload before the second mount).
 *
 * Full trimmed payloads can still hit quota — `trimProjectForDeck` keeps only
 * fields the slide renderer needs.
 */

import type {
  AIProjectResolved,
  Quadrant,
} from "@/lib/cross-tower/aiProjects";
import type { ProgramSynthesisLLMV6 } from "@/lib/cross-tower/composeProjectsV6";
import type { CrossTowerAssumptions } from "@/lib/cross-tower/assumptions";
import type { BuildupPoint, ProjectKpis } from "@/lib/cross-tower/composeProjects";
import type { SelectProgramResultV6 } from "@/lib/initiatives/selectV6Program";

export const CROSS_TOWER_DECK_STORAGE_KEY = "forge.crossTowerDeck.payload.v1" as const;

export const DECK_PAYLOAD_VERSION = 1 as const;

/** Condensed project row for deck slides (no full `constituents`). */
export type DeckProjectSlice = {
  id: string;
  parentL4ActivityGroupName: string;
  primaryTowerName: string;
  name: string;
  narrative: string;
  quadrant: Quadrant | null;
  attributedAiUsd: number;
  isStub: boolean;
  isDeprioritized: boolean;
  l5Names: string[];
  /** Up to 3 bullets across lenses. */
  keyShifts: string[];
  /** Up to 3 agents. */
  agentSummaries: { name: string; type: string }[];
};

export type CrossTowerDeckPayload = {
  version: typeof DECK_PAYLOAD_VERSION;
  generatedAt: string | null;
  redactDollars: boolean;
  /** Drives `defaultExecutiveSummary` when `synthesis` is null. */
  isFirstRunForCopy: boolean;
  kpis: ProjectKpis;
  buildup: BuildupPoint[];
  assumptions: Pick<
    CrossTowerAssumptions,
    | "programStartMonth"
    | "rampMonths"
    | "p1PhaseStartMonth"
    | "p2PhaseStartMonth"
    | "p3PhaseStartMonth"
    | "p1BuildMonths"
    | "p2BuildMonths"
    | "p3BuildMonths"
  >;
  programMeta: {
    towersInScope: number;
    /** Count of L3 Job Family rows that cleared the plan threshold. */
    inPlanJobFamilyCount: number;
    /** Count of in-plan AI Solutions (one per L3 row, post curation). */
    inPlanSolutionCount: number;
    liveProjects: number;
  };
  synthesis: ProgramSynthesisLLMV6 | null;
  projects: DeckProjectSlice[];
};

const NARRATIVE_MAX = 220;

function cap(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function trimProjectForDeck(p: AIProjectResolved): DeckProjectSlice {
  // v6: an AI Solution IS one L3 initiative and the cross-tower view
  // doesn't realize the full four-lens brief — so we surface the v6
  // fields (tagline, primaryVendor, aiRationale) as the slide content.
  const keyShifts = v6KeyShifts(p);
  return {
    id: p.id,
    parentL4ActivityGroupName: p.parentL4ActivityGroupName,
    primaryTowerName: p.primaryTowerName,
    name: p.name,
    narrative: cap(p.narrative, NARRATIVE_MAX),
    quadrant: p.quadrant,
    attributedAiUsd: p.attributedAiUsd,
    isStub: p.isStub,
    isDeprioritized: p.isDeprioritized,
    l5Names: [],
    keyShifts,
    agentSummaries: [],
  };
}

function v6KeyShifts(p: AIProjectResolved): string[] {
  const out: string[] = [];
  if (p.tagline) out.push(cap(p.tagline, 120));
  if (p.aiRationale && out.length < 3) out.push(cap(p.aiRationale, 160));
  if (p.primaryVendor && out.length < 3) {
    out.push(cap(`Vendor stack: ${p.primaryVendor}`, 120));
  }
  return out.slice(0, 3);
}

export type BuildDeckPayloadArgs = {
  projects: AIProjectResolved[];
  buildup: BuildupPoint[];
  kpis: ProjectKpis;
  synthesis: ProgramSynthesisLLMV6 | null;
  generatedAt: string | null;
  /** Snapshot behind KPIs/curve — use `state.appliedAssumptions ?? draftAssumptions`. */
  assumptionsForFootnote: CrossTowerAssumptions;
  program: SelectProgramResultV6;
  redactDollars: boolean;
  isFirstRunForCopy: boolean;
};

export function buildDeckPayload(args: BuildDeckPayloadArgs): CrossTowerDeckPayload {
  // Under v6 each `AIProjectResolved` IS one L3 AI Initiative. The
  // in-plan Job Family count rolls up by parent L3 row id from the
  // program selector; the in-plan Solution count is the live project
  // count (one project per initiative).
  const inPlanJobFamilies = new Set<string>();
  for (const row of args.program.initiatives) {
    inPlanJobFamilies.add(row.l3RowId);
  }
  const inPlanSolutionCount = args.projects.filter((p) => !p.isStub).length;
  const liveProjects = inPlanSolutionCount;
  return {
    version: DECK_PAYLOAD_VERSION,
    generatedAt: args.generatedAt,
    redactDollars: args.redactDollars,
    isFirstRunForCopy: args.isFirstRunForCopy,
    kpis: args.kpis,
    buildup: args.buildup,
    assumptions: {
      programStartMonth: args.assumptionsForFootnote.programStartMonth,
      rampMonths: args.assumptionsForFootnote.rampMonths,
      p1PhaseStartMonth: args.assumptionsForFootnote.p1PhaseStartMonth,
      p2PhaseStartMonth: args.assumptionsForFootnote.p2PhaseStartMonth,
      p3PhaseStartMonth: args.assumptionsForFootnote.p3PhaseStartMonth,
      p1BuildMonths: args.assumptionsForFootnote.p1BuildMonths,
      p2BuildMonths: args.assumptionsForFootnote.p2BuildMonths,
      p3BuildMonths: args.assumptionsForFootnote.p3BuildMonths,
    },
    programMeta: {
      towersInScope: args.program.towersInScope.length,
      inPlanJobFamilyCount: inPlanJobFamilies.size,
      inPlanSolutionCount,
      liveProjects,
    },
    synthesis: args.synthesis,
    projects: args.projects.map(trimProjectForDeck),
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export type ParseDeckPayloadResult =
  | { ok: true; payload: CrossTowerDeckPayload }
  | { ok: false; error: string };

export function parseDeckPayloadJson(raw: string | null): ParseDeckPayloadResult {
  if (raw == null || raw === "") {
    return { ok: false, error: "No deck data found. Return to the plan and click Export deck again." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false, error: "Deck data was corrupted. Export again from the Cross-Tower AI Plan page." };
  }
  if (!isRecord(parsed)) {
    return { ok: false, error: "Invalid deck payload." };
  }
  if (parsed.version !== DECK_PAYLOAD_VERSION) {
    return { ok: false, error: "Unsupported deck export version. Regenerate from the plan page." };
  }
  if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.buildup)) {
    return { ok: false, error: "Invalid deck payload structure." };
  }
  return { ok: true, payload: parsed as CrossTowerDeckPayload };
}

export type WriteDeckPayloadResult =
  | { ok: true }
  | { ok: false; error: "quota" | "unknown" };

/** Mirrors `defaultExecutiveSummary` in CrossTowerAiPlanClient for deck parity. */
export function deckExecutiveFallback(isFirstRun: boolean): string {
  if (isFirstRun) {
    return "Versant's cross-tower AI plan, sourced directly from the L3 AI Initiatives curated in each tower workshop. Click Regenerate plan to score every solution on the Value × Effort 2x2, sequence them across a 24-month roadmap, and roll up the program-level executive summary, risks, and architecture. Numerics and the value buildup curve update deterministically.";
  }
  return "Cross-tower AI plan, sourced directly from the L3 AI Initiatives in scope. Each solution carries its own deep-dive brief, is scored on Value × Effort, and threads into the 24-month roadmap. Click any solution to open its Work / Workforce / Workbench / Digital Core brief.";
}

export function writeDeckPayloadToLocalStorage(
  payload: CrossTowerDeckPayload,
): WriteDeckPayloadResult {
  try {
    const json = JSON.stringify(payload);
    localStorage.setItem(CROSS_TOWER_DECK_STORAGE_KEY, json);
    return { ok: true };
  } catch (e) {
    const name = e instanceof DOMException ? e.name : "";
    if (name === "QuotaExceededError") return { ok: false, error: "quota" };
    return { ok: false, error: "unknown" };
  }
}
