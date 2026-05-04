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
  ProgramSynthesisLLM,
  Quadrant,
} from "@/lib/cross-tower/aiProjects";
import type { CrossTowerAssumptions } from "@/lib/cross-tower/assumptions";
import type { BuildupPoint, ProjectKpis } from "@/lib/cross-tower/composeProjects";
import type { SelectProgramResult } from "@/lib/initiatives/selectProgram";

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
    inPlanL4Count: number;
    inPlanL5Count: number;
    liveProjects: number;
  };
  synthesis: ProgramSynthesisLLM | null;
  projects: DeckProjectSlice[];
};

const NARRATIVE_MAX = 220;

function cap(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function collectKeyShifts(brief: NonNullable<AIProjectResolved["brief"]>): string[] {
  const out: string[] = [];
  const pushPool = (pool: readonly string[]) => {
    for (const line of pool) {
      const c = cap(line, 120);
      if (c && !out.includes(c)) out.push(c);
      if (out.length >= 3) return;
    }
  };
  pushPool(brief.work.keyShifts);
  pushPool(brief.workforce.keyShifts);
  pushPool(brief.workbench.keyShifts);
  if (out.length < 3) {
    pushPool(brief.digitalCore.dataRequirements);
  }
  return out.slice(0, 3);
}

export function trimProjectForDeck(p: AIProjectResolved): DeckProjectSlice {
  const l5Names = p.constituents.map((c) => c.name).filter(Boolean);
  const keyShifts = p.brief ? collectKeyShifts(p.brief) : [];
  const agentSummaries = (p.brief?.agents ?? []).slice(0, 3).map((a) => ({
    name: a.name,
    type: a.type,
  }));
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
    l5Names,
    keyShifts,
    agentSummaries,
  };
}

export type BuildDeckPayloadArgs = {
  projects: AIProjectResolved[];
  buildup: BuildupPoint[];
  kpis: ProjectKpis;
  synthesis: ProgramSynthesisLLM | null;
  generatedAt: string | null;
  /** Snapshot behind KPIs/curve — use `state.appliedAssumptions ?? draftAssumptions`. */
  assumptionsForFootnote: CrossTowerAssumptions;
  program: SelectProgramResult;
  redactDollars: boolean;
  isFirstRunForCopy: boolean;
};

export function buildDeckPayload(args: BuildDeckPayloadArgs): CrossTowerDeckPayload {
  const inPlanL4 = new Set<string>();
  for (const row of args.program.initiatives) inPlanL4.add(row.l3.rowId);
  const liveProjects = args.projects.filter((p) => !p.isStub).length;
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
      inPlanL4Count: inPlanL4.size,
      inPlanL5Count: args.program.initiatives.length,
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
    return "Versant's cross-tower AI plan, structured as one AI Project per in-plan L4 Activity Group. Click Generate plan to author each project's 4-lens brief, score it on the Value × Effort 2x2, and stage the 24-month roadmap. Numerics, lineage, and the value buildup curve update deterministically.";
  }
  return "Cross-tower AI plan, with one AI Project per L4 Activity Group. Each project ships its own 4-lens brief (Work / Workforce / Workbench / Digital Core), is scored on the Value × Effort 2x2, and threads into the 24-month roadmap. Open the AI Projects tab to drill into briefs.";
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
