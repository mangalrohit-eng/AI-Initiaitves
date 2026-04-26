import type { L3WorkforceRow, TowerId } from "./types";

/**
 * Versant-aware starter heuristic for L3 offshoring% and AI-impact%.
 *
 * Inputs are the L2 / L3 capability labels (case-insensitive substring match) plus
 * the tower id, which sets a prior. Rules then add deltas. Output is clamped to a
 * realistic band (5–85% offshore, 10–75% AI) and rounded to the nearest 5 for a clean
 * starting point.
 *
 * Logic considers Versant's profile (US news / sports / streaming under a TSA expiration,
 * on-air talent, political brand sensitivity, multi-entity JV, BB- credit) so:
 *   - Editorial, on-air, deal-making, executive judgment, live broadcast, regulatory
 *     filings → low offshore, low AI.
 *   - AP/AR, reconciliation, payroll, helpdesk, analytics → high offshore, high AI.
 *   - Things in between (FP&A, sales ops, tech engineering) sit mid-range.
 *
 * Not Versant-reported. Illustrative starting point only.
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

/**
 * Routine, codified, transactional → higher offshore + AI.
 *
 * These keywords describe L2/L3 capability buckets (e.g., "Accounts Payable",
 * "Service Desk"), not L4 activity verbs. The heuristic now scores at L3, so
 * very narrow per-activity tells (e.g., "match-pay-and-extract") have been
 * removed in favor of the broader sub-capability vocabulary.
 */
const ROUTINE_RULES: Rule[] = [
  { keywords: ["accounts payable"], offshore: 20, ai: 15 },
  { keywords: ["accounts receivable", "billing"], offshore: 20, ai: 15 },
  { keywords: ["reconciliation", "intercompany"], offshore: 15, ai: 15 },
  { keywords: ["expense", "travel and expense", "t&e"], offshore: 15, ai: 10 },
  { keywords: ["payroll"], offshore: 15, ai: 10 },
  { keywords: ["procurement", "sourcing", "vendor onboarding"], offshore: 10, ai: 10 },
  { keywords: ["helpdesk", "service desk", "tier 1", "first line support"], offshore: 20, ai: 15 },
  { keywords: ["general ledger", "month-end", "close"], offshore: 10, ai: 10 },
  { keywords: ["tax", "tax compliance"], offshore: 5, ai: 10 },
  { keywords: ["benefit", "leave", "case management"], offshore: 10, ai: 5 },
  { keywords: ["shared service", "back-office", "operations support"], offshore: 10, ai: 5 },
  { keywords: ["software test", "qa", "test automation"], offshore: 15, ai: 10 },
  { keywords: ["category management", "spend analysis"], offshore: 10, ai: 10 },
  { keywords: ["billing operations", "subscription operations"], offshore: 15, ai: 15 },
];

/** AI-friendly patterns regardless of geography (analytics, models, doc work). */
const AI_FRIENDLY_RULES: Rule[] = [
  { keywords: ["forecast", "valuation", "prediction"], ai: 15 },
  { keywords: ["report", "dashboard", "analytics", "insight"], ai: 10 },
  { keywords: ["detection", "monitoring", "surveillance", "screening", "fraud"], ai: 15 },
  { keywords: ["personaliz", "recommend", "targeting", "segmentation"], ai: 15 },
  { keywords: ["document review", "contract review"], ai: 15 },
  { keywords: ["search", "research", "discovery"], ai: 10 },
  { keywords: ["chatbot", "intake", "ticket triage"], ai: 15 },
  { keywords: ["lead qualification", "lead scoring", "sales enablement"], ai: 10 },
  { keywords: ["compliance check", "compliance monitoring", "audit support"], ai: 15 },
];

/** US-required / sensitive / relationship-driven → lower offshore (and usually lower AI). */
const SENSITIVE_RULES: Rule[] = [
  { keywords: ["editorial", "journalism", "news judgment"], offshore: -25, ai: -15 },
  { keywords: ["political", "regulator", "regulatory", "securities", "disclosure", "10-k", "10-q", "lobby"], offshore: -15 },
  { keywords: ["negotiation", "deal", "partner relationship", "client relationship", "key account", "carriage"], offshore: -15, ai: -15 },
  { keywords: ["m&a", "acquisition", "investment thesis"], offshore: -10, ai: -10 },
  { keywords: ["counsel", "litigation", "outside counsel"], offshore: -15, ai: -10 },
  { keywords: ["live broadcast", "live production", "on-camera", "on-air", "talent management"], offshore: -15, ai: -10 },
  { keywords: ["studio", "set design", "wardrobe", "stage", "physical security"], offshore: -15, ai: -15 },
  { keywords: ["brand identity", "brand strategy", "creative direction", "creative strategy", "visual identity"], offshore: -20, ai: -10 },
  { keywords: ["culture", "change management", "org design", "workforce planning", "talent strategy", "leadership development"], offshore: -10, ai: -10 },
  { keywords: ["strategy", "strategic plan", "board", "c-suite", "executive search"], offshore: -10, ai: -10 },
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

export type L3Defaults = { offshorePct: number; aiPct: number };

export function inferL3Defaults(
  towerId: TowerId,
  l2: string,
  l3: string,
): L3Defaults {
  const priors = TOWER_PRIORS[towerId] ?? { offshore: 30, ai: 40 };
  let offshore = priors.offshore;
  let ai = priors.ai;
  const text = `${l2} ${l3}`.toLowerCase();
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
  rows: L3WorkforceRow[];
  /** Number of cells that were actually changed (offshore + AI). */
  changedCells: number;
  /** Number of rows that received any change. */
  changedRows: number;
};

/**
 * Apply the Versant-aware starter offshore% / AI% to every L3 row of a tower.
 *
 *   - `fillBlanks`: only set values for rows where the field is currently blank.
 *   - `overwriteAll`: replace every row's offshore% and AI% with the heuristic
 *     output. Used when a tower lead wants to reset after editing the maps.
 */
export function applyTowerStarterDefaults(
  rows: L3WorkforceRow[],
  towerId: TowerId,
  mode: ApplyDefaultsMode = "fillBlanks",
): ApplyDefaultsResult {
  let changedCells = 0;
  let changedRows = 0;
  const next = rows.map((r) => {
    const d = inferL3Defaults(towerId, r.l2, r.l3);
    let nextOff = r.offshoreAssessmentPct;
    let nextAi = r.aiImpactAssessmentPct;
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
      ? { ...r, offshoreAssessmentPct: nextOff, aiImpactAssessmentPct: nextAi }
      : r;
  });
  return { rows: next, changedCells, changedRows };
}

/** How many rows are missing offshore%, AI%, or either. */
export function countBlankL3Defaults(rows: L3WorkforceRow[]): {
  offshoreBlanks: number;
  aiBlanks: number;
  totalBlanks: number;
} {
  let offshoreBlanks = 0;
  let aiBlanks = 0;
  let totalBlanks = 0;
  for (const r of rows) {
    const offMissing = r.offshoreAssessmentPct == null;
    const aiMissing = r.aiImpactAssessmentPct == null;
    if (offMissing) offshoreBlanks += 1;
    if (aiMissing) aiBlanks += 1;
    if (offMissing || aiMissing) totalBlanks += 1;
  }
  return { offshoreBlanks, aiBlanks, totalBlanks };
}
