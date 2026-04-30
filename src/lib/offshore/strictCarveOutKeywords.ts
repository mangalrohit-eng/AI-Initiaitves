/**
 * Step-5 (Offshore Plan) — keyword library for strict carve-outs.
 *
 * These lists are NO LONGER used by the selector to classify rows on the fly.
 * They drive `seedStrictCarveOuts(program)`, which pre-populates the
 * Assumptions tab carve-out section the first time a user lands on Step 5.
 * Once the carve-out is on the L3 row (`offshoreStrictCarveOut`), the user
 * can uncheck or re-tag — keywords never override user intent.
 *
 * Lane mapping (lives in selectOffshorePlan.classifyRow):
 *   - "Editorial" reason → EditorialCarveOut lane
 *   - "Talent" / "SOX" / "Sales" reasons → OnshoreRetained lane
 */
import type { AssessProgramV2, TowerId } from "@/data/assess/types";
import { towers } from "@/data/towers";

export type StrictCarveOutReason = "Editorial" | "Talent" | "SOX" | "Sales";

/**
 * Editorial / talent / on-air / brand-judgment keywords. Substring match,
 * case-insensitive. Hits seed an `Editorial` reason (Brian Carovillano veto
 * lane) on the matching L3 row.
 */
export const EDITORIAL_KEYWORDS: readonly string[] = [
  "editorial",
  "journalism",
  "news judgment",
  "newsroom",
  "anchor",
  "on-air",
  "on camera",
  "live broadcast",
  "live production",
  "studio",
  "set design",
  "stage",
  "wardrobe",
  "creative direction",
  "creative strategy",
  "brand identity",
  "brand strategy",
];

/**
 * Talent-relationship keywords — separated from EDITORIAL_KEYWORDS so the
 * Assumptions tab can show distinct reason chips. Hits seed a `Talent`
 * reason which routes to the OnshoreRetained lane.
 */
export const TALENT_KEYWORDS: readonly string[] = [
  "talent management",
  "talent relations",
  "talent contract",
  "agency relationship",
  "agent",
];

/**
 * SOX / treasury / first-public-year-sensitive keywords. Hits seed a `SOX`
 * reason → OnshoreRetained lane.
 */
export const SOX_KEYWORDS: readonly string[] = [
  "treasury",
  "credit rating",
  "covenant",
  "debt management",
  "sox",
  "internal controls",
  "10-k",
  "10-q",
  "disclosure",
  "regulatory",
  "regulator",
  "securities",
  "audit",
];

/**
 * Sales / relationship / brand-sensitive sales keywords. Hits seed a `Sales`
 * reason → OnshoreRetained lane.
 */
export const SALES_KEYWORDS: readonly string[] = [
  "key account",
  "client relationship",
  "partner relationship",
  "carriage",
  "deal",
  "negotiation",
  "ad sales relationship",
  "top tier ad",
];

/**
 * Strategic / executive judgment keywords — historically conflated with
 * editorial in the old selector. Hits seed a `Talent` reason (closest match
 * for executive-relationship work) → OnshoreRetained lane.
 *
 * If a row matches both a strategic keyword and an editorial keyword, the
 * Editorial reason wins (newsroom brand sensitivity is the stricter constraint).
 */
const STRATEGIC_KEYWORDS: readonly string[] = [
  "executive search",
  "strategic plan",
  "board",
  "c-suite",
  "leadership development",
  "m&a",
  "acquisition",
  "investment thesis",
  "outside counsel",
  "litigation",
  "crisis",
  "incident response",
  "executive support",
  "physical security",
  "real estate",
  "facilities",
  "lobby",
  "culture",
  "change management",
  "org design",
  "workforce planning",
];

/**
 * Some towers are defaulted entirely into `Editorial` (newsroom + production)
 * or `Talent` (programming-dev) by tower-id alone — keyword detection inside
 * those towers is then redundant but doesn't hurt. The seed inspects rows
 * regardless of tower so a back-office row inside Editorial-News doesn't
 * become an Editorial carve-out unless it actually matches a keyword.
 */
const TOWER_DEFAULT_REASON: Partial<Record<TowerId, StrictCarveOutReason>> = {
  "editorial-news": "Editorial",
  production: "Editorial",
  "programming-dev": "Talent",
};

function matchesAny(text: string, keywords: readonly string[]): boolean {
  for (const kw of keywords) {
    if (text.includes(kw)) return true;
  }
  return false;
}

/**
 * Heuristic seed: scan every L3 row, return `{ towerId, rowId, reason }` for
 * rows that should land in the Assumptions tab pre-checked. Matches are
 * scored in priority order (Editorial wins over the others).
 */
export function seedStrictCarveOuts(
  program: AssessProgramV2,
): Array<{ towerId: TowerId; rowId: string; reason: StrictCarveOutReason }> {
  const out: Array<{ towerId: TowerId; rowId: string; reason: StrictCarveOutReason }> = [];

  for (const tower of towers) {
    const towerId = tower.id as TowerId;
    const state = program.towers[towerId];
    if (!state || state.l3Rows.length === 0) continue;
    const towerDefault = TOWER_DEFAULT_REASON[towerId];

    for (const r of state.l3Rows) {
      const text = `${r.l2 ?? ""} ${r.l3 ?? ""}`.toLowerCase();
      const reason = pickReason(text, towerDefault);
      if (reason) out.push({ towerId, rowId: r.id, reason });
    }
  }

  return out;
}

function pickReason(
  text: string,
  towerDefault: StrictCarveOutReason | undefined,
): StrictCarveOutReason | null {
  // Editorial wins over everything else — newsroom brand sensitivity is the
  // strictest constraint Versant has.
  if (matchesAny(text, EDITORIAL_KEYWORDS)) return "Editorial";
  if (matchesAny(text, TALENT_KEYWORDS)) return "Talent";
  if (matchesAny(text, SOX_KEYWORDS)) return "SOX";
  if (matchesAny(text, SALES_KEYWORDS)) return "Sales";
  if (matchesAny(text, STRATEGIC_KEYWORDS)) return "Talent";
  return towerDefault ?? null;
}
