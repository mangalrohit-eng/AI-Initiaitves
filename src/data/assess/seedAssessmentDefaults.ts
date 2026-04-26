import type { L4WorkforceRow, TowerId } from "./types";

/**
 * Versant-aware starter heuristic for L4 offshoring% and AI-impact%.
 *
 * Inputs are the L2 / L3 / L4 capability labels (case-insensitive substring match) plus
 * the tower id, which sets a prior. Rules then add deltas. Output is clamped to a
 * realistic band (5–85% offshore, 10–75% AI) and rounded to the nearest 5 for a clean
 * workshop starting point.
 *
 * Logic considers Versant's profile (US news / sports / streaming under a TSA expiration,
 * on-air talent, political brand sensitivity, multi-entity JV, BB- credit) so:
 *   - Editorial, on-air, deal-making, executive judgment, live broadcast, regulatory
 *     filings → low offshore, low AI.
 *   - AP/AR, reconciliation, payroll, helpdesk, document review, transcription,
 *     monitoring/screening, analytics → high offshore, high AI.
 *   - Things in between (FP&A, sales ops, tech engineering) sit mid-range.
 *
 * Not Versant-reported. Workshop starting point only.
 */
type Priors = { offshore: number; ai: number };

const TOWER_PRIORS: Record<TowerId, Priors> = {
  finance: { offshore: 50, ai: 55 },
  hr: { offshore: 40, ai: 45 },
  "research-analytics": { offshore: 35, ai: 60 },
  legal: { offshore: 25, ai: 45 },
  "corp-services": { offshore: 40, ai: 40 },
  "tech-engineering": { offshore: 55, ai: 55 },
  "operations-technology": { offshore: 25, ai: 40 },
  sales: { offshore: 20, ai: 45 },
  "marketing-comms": { offshore: 30, ai: 50 },
  service: { offshore: 50, ai: 55 },
  "editorial-news": { offshore: 10, ai: 30 },
  production: { offshore: 20, ai: 35 },
  "programming-dev": { offshore: 20, ai: 35 },
};

type Rule = {
  keywords: string[];
  offshore?: number;
  ai?: number;
};

/** Routine, codified, transactional → higher offshore + AI. */
const ROUTINE_RULES: Rule[] = [
  { keywords: ["accounts payable", "invoice processing", "invoice approval"], offshore: 20, ai: 15 },
  { keywords: ["accounts receivable", "billing"], offshore: 20, ai: 15 },
  { keywords: ["reconciliation", "reconcile", "intercompany"], offshore: 15, ai: 15 },
  { keywords: ["expense", "travel and expense", "t&e"], offshore: 15, ai: 10 },
  { keywords: ["payroll"], offshore: 15, ai: 10 },
  { keywords: ["procurement", "sourcing", "purchase order", "vendor onboarding"], offshore: 10, ai: 10 },
  { keywords: ["helpdesk", "service desk", "tier 1", "l1 support", "first line support"], offshore: 20, ai: 15 },
  { keywords: ["data entry", "data ingestion", "data capture"], offshore: 15, ai: 15 },
  { keywords: ["general ledger", "month-end", "journal entry"], offshore: 10, ai: 10 },
  { keywords: ["tax filing", "tax compliance", "sales tax"], offshore: 5, ai: 10 },
  { keywords: ["benefit administration", "leave administration", "case management"], offshore: 10, ai: 5 },
  { keywords: ["shared service", "back-office", "administr", "operations support"], offshore: 10, ai: 5 },
  { keywords: ["software test", "qa test", "test automation"], offshore: 15, ai: 10 },
  { keywords: ["category management", "spend analysis"], offshore: 10, ai: 10 },
  { keywords: ["billing operations", "subscription operations"], offshore: 15, ai: 15 },
];

/** AI-friendly patterns regardless of geography (analytics, models, doc work). */
const AI_FRIENDLY_RULES: Rule[] = [
  { keywords: ["forecast", "valuation", "prediction", "scoring"], ai: 15 },
  { keywords: ["report", "dashboard", "analytics", "insight"], ai: 10 },
  { keywords: ["detection", "monitoring", "surveillance", "screening", "fraud"], ai: 15 },
  { keywords: ["personaliz", "recommend", "targeting", "segmentation"], ai: 15 },
  { keywords: ["document review", "contract review", "nda", "template"], ai: 15 },
  { keywords: ["search", "research", "discovery"], ai: 10 },
  { keywords: ["categoriz", "extract", "summari", "tag", "metadata", "transcrib", "translation", "captioning"], ai: 20, offshore: 5 },
  { keywords: ["chatbot", "first line", "intake", "ticket triage"], ai: 15 },
  { keywords: ["lead qualification", "lead scoring", "outreach", "sales enablement"], ai: 10 },
  { keywords: ["compliance check", "compliance monitoring", "audit support"], ai: 15 },
];

/** US-required / sensitive / relationship-driven → lower offshore (and usually lower AI). */
const SENSITIVE_RULES: Rule[] = [
  { keywords: ["editorial", "journalism", "journal", "anchor", "reporter", "fact-check", "fact check", "news judgment"], offshore: -25, ai: -15 },
  { keywords: ["editorial decision", "story selection"], offshore: -25, ai: -20 },
  { keywords: ["political", "regulator", "regulatory", "securities filing", "disclosure", "10-k", "10-q", "lobby"], offshore: -15 },
  { keywords: ["negotiat", "deal making", "partner relationship", "client relationship", "key account", "account executive", "carriage"], offshore: -15, ai: -15 },
  { keywords: ["m&a", "acquisition", "investment thesis"], offshore: -10, ai: -10 },
  { keywords: ["counsel", "litigation", "outside counsel"], offshore: -15, ai: -10 },
  { keywords: ["live broadcast", "live production", "on-camera", "on-air", "host", "talent management"], offshore: -15, ai: -10 },
  { keywords: ["studio", "set design", "wardrobe", "location scouting", "stage", "physical security"], offshore: -15, ai: -15 },
  { keywords: ["brand identity", "brand strategy", "creative direction", "creative strategy", "visual identity"], offshore: -20, ai: -10 },
  { keywords: ["culture", "change management", "org design", "workforce planning", "talent strategy", "leadership development"], offshore: -10, ai: -10 },
  { keywords: ["strategy", "strategic plan", "board", "c-suite", "csuite", "executive search"], offshore: -10, ai: -10 },
  { keywords: ["crisis", "incident response"], offshore: -15, ai: -10 },
  { keywords: ["treasury", "credit rating", "covenant", "debt management"], offshore: -10, ai: -5 },
  { keywords: ["real estate", "facilities", "office services"], offshore: -10, ai: -10 },
];

const ALL_RULES: Rule[] = [...ROUTINE_RULES, ...AI_FRIENDLY_RULES, ...SENSITIVE_RULES];

const OFFSHORE_MIN = 5;
const OFFSHORE_MAX = 85;
const AI_MIN = 10;
const AI_MAX = 75;

function clampRound5(value: number, min: number, max: number): number {
  const clamped = Math.max(min, Math.min(max, value));
  return Math.round(clamped / 5) * 5;
}

export type L4Defaults = { offshorePct: number; aiPct: number };

export function inferL4Defaults(
  towerId: TowerId,
  l2: string,
  l3: string,
  l4: string,
): L4Defaults {
  const priors = TOWER_PRIORS[towerId] ?? { offshore: 30, ai: 40 };
  let offshore = priors.offshore;
  let ai = priors.ai;
  const text = `${l2} ${l3} ${l4}`.toLowerCase();
  for (const rule of ALL_RULES) {
    if (rule.keywords.some((k) => text.includes(k))) {
      if (rule.offshore != null) offshore += rule.offshore;
      if (rule.ai != null) ai += rule.ai;
    }
  }
  return {
    offshorePct: clampRound5(offshore, OFFSHORE_MIN, OFFSHORE_MAX),
    aiPct: clampRound5(ai, AI_MIN, AI_MAX),
  };
}

export type ApplyDefaultsMode = "fillBlanks" | "overwriteAll";

export type ApplyDefaultsResult = {
  rows: L4WorkforceRow[];
  /** Number of cells that were actually changed (offshore + AI). */
  changedCells: number;
  /** Number of rows that received any change. */
  changedRows: number;
};

/**
 * Apply the Versant-aware starter offshore% / AI% to every L4 row of a tower.
 *
 * - `fillBlanks`: only set the value when the row's existing value is `undefined` or
 *   `null`. Existing explicit values are preserved. Always safe.
 * - `overwriteAll`: replace every row's offshore% and AI% with the inferred starter.
 *   Used when a tower lead wants to reset after editing the L1–L4 maps or rules.
 */
export function applyTowerStarterDefaults(
  rows: L4WorkforceRow[],
  towerId: TowerId,
  mode: ApplyDefaultsMode = "fillBlanks",
): ApplyDefaultsResult {
  let changedCells = 0;
  let changedRows = 0;
  const next = rows.map((r) => {
    const d = inferL4Defaults(towerId, r.l2, r.l3, r.l4);
    let nextOff = r.l4OffshoreAssessmentPct;
    let nextAi = r.l4AiImpactAssessmentPct;
    let touched = false;
    if (mode === "overwriteAll" || nextOff == null) {
      if (nextOff !== d.offshorePct) {
        nextOff = d.offshorePct;
        changedCells += 1;
        touched = true;
      }
    }
    if (mode === "overwriteAll" || nextAi == null) {
      if (nextAi !== d.aiPct) {
        nextAi = d.aiPct;
        changedCells += 1;
        touched = true;
      }
    }
    if (touched) changedRows += 1;
    return touched
      ? { ...r, l4OffshoreAssessmentPct: nextOff, l4AiImpactAssessmentPct: nextAi }
      : r;
  });
  return { rows: next, changedCells, changedRows };
}

/** How many rows are missing offshore%, AI%, or either. */
export function countBlankL4Defaults(rows: L4WorkforceRow[]): {
  offshoreBlanks: number;
  aiBlanks: number;
  totalBlanks: number;
} {
  let offshoreBlanks = 0;
  let aiBlanks = 0;
  let totalBlanks = 0;
  for (const r of rows) {
    const offMissing = r.l4OffshoreAssessmentPct == null;
    const aiMissing = r.l4AiImpactAssessmentPct == null;
    if (offMissing) offshoreBlanks += 1;
    if (aiMissing) aiBlanks += 1;
    if (offMissing || aiMissing) totalBlanks += 1;
  }
  return { offshoreBlanks, aiBlanks, totalBlanks };
}
