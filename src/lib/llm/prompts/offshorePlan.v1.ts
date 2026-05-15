/**
 * Step 2 (Offshore View) — LLM `gccPct` classifier prompt.
 *
 * Versioned: bump `PROMPT_VERSION` whenever the prompt text or schema
 * changes, which invalidates the server LRU + client localStorage caches.
 *
 * v3 — Binary GCC / Retained model. Every L4 Activity Group carries a
 * single `gccPct` 0-100 — the share of its total HC that migrates to
 * the primary India GCC. The old four-lane vocabulary (GccEligible /
 * GccWithOverlay / OnshoreRetained / EditorialCarveOut) and the
 * `offshoreStrictCarveOut` reason set were collapsed into this single
 * number per row.
 *
 * The LLM authors TWO things per row:
 *   - gccPct: integer 0-100.
 *   - reason: ONE sentence, ≤200 chars, Versant-grounded.
 *
 * The LLM does NOT touch headcount or dial values. Movable HC math stays
 * deterministic — the L4 `gccPct` rolls up via `l4Split` / `rollupSplit`
 * in `lib/offshore/offshoreSplit.ts`.
 *
 * Module-name + filename kept (`prompts/offshorePlan.v1.ts`) to keep
 * import paths stable across the binary-model cutover; the version string
 * itself is the cache-busting signal.
 */

export const PROMPT_VERSION = "offshore-plan.v3-gccpct";

export type LLMOffshoreRowInput = {
  rowId: string;
  towerId: string;
  towerName: string;
  /** L2 Job Grouping. */
  l2: string;
  /** L3 Job Family. */
  l3: string;
  /**
   * L4 Activity Group — the row being classified. Optional only for
   * back-compat with legacy v1 callers that sent only L2/L3.
   */
  l4?: string;
  /**
   * L5 Activity names that hang off this row (display-only context for the
   * model — typically capped to 3 in the user prompt to keep tokens lean).
   */
  l5Names?: string[];
  /**
   * @deprecated v1 wire field. Renamed to `l5Names` after the 5-layer
   * migration. Still accepted by the route for back-compat — at the prompt
   * boundary either field is treated as the activity name list.
   */
  l4Names?: string[];
  /** total = onshore FTE + offshore FTE + onshore CTR + offshore CTR */
  headcount: {
    fteOnshore: number;
    fteOffshore: number;
    contractorOnshore: number;
    contractorOffshore: number;
  };
  /**
   * Current Step-2 `gccPct` (0-100) on this row when one already exists —
   * the LLM may use it as a prior. `null` when the row has never been
   * classified.
   */
  dialPct: number | null;
  /** ≤200-char prior reason text, when available. */
  step2Rationale?: string;
};

export type LLMOffshoreRowResult = {
  rowId: string;
  /** Integer 0-100 — share of the row's HC that migrates to the primary GCC. */
  gccPct: number;
  /** Single sentence, ≤200 chars, Versant-grounded. */
  reason: string;
};

export type LLMOffshoreClassifyContext = {
  /** Configured GCC city names — the LLM may name them in justifications. */
  primaryGccCity: string;
  secondaryGccCity: string;
  contactCenterHub: string;
};

export function buildOffshoreSystemPrompt(
  ctx: LLMOffshoreClassifyContext,
): string {
  return [
    "You are an Accenture managing director writing the row-by-row offshore migration plan for Versant Media Group's GCC India build-out. For each L4 Activity Group I send you, you decide what share of that row's total headcount migrates to the primary India GCC versus stays retained onshore.",
    "",
    "Hierarchy context (5-layer Versant capability map):",
    "  L1 Function > L2 Job Grouping > L3 Job Family > L4 Activity Group > L5 Activity.",
    "  Each row I send you IS one L4 Activity Group. The L5 Activity names are display-only context for what the work actually involves — do not classify them individually.",
    "",
    "Versant Media Group (NASDAQ: VSNT) is the spin-off of NBCUniversal's news, sports, streaming, and digital portfolio: MS NOW, CNBC, Golf Channel, GolfNow, GolfPass, USA Network, E!, Syfy, Oxygen True Crime, Fandango, Rotten Tomatoes, SportsEngine, Free TV Networks. ~$6.7B revenue, ~$2.4B Adj. EBITDA, ~$2.75B debt (BB-), running on NBCU shared services until each TSA expires.",
    "",
    `GCC build-out (assumptions you should reference by name): primary GCC = ${ctx.primaryGccCity}; secondary GCC = ${ctx.secondaryGccCity} (finance back-office + HR ops); contact-center hub = ${ctx.contactCenterHub} (multi-brand subscriber + customer support). Destination routing is deterministic and out of your scope — do NOT recommend cities; only return the GCC %.`,
    "",
    "OUTPUT — return ONE integer `gccPct` per row, 0-100:",
    "  - 100 — every individual on this row moves to the GCC. Reserve for fully transactional / repeatable rows with no US-business-hour client touch.",
    "  - 70-90 — heavy GCC delivery with a small onshore overlay (coverage windows, tier-2 escalation, named client-relationship leads).",
    "  - 40-60 — split rows: substantial GCC delivery, substantial onshore retention (US-business-hour client touch, judgment-heavy escalation, regulator-facing handoffs).",
    "  - 10-30 — predominantly retained onshore; small GCC footprint (back-office support, monitoring, documentation).",
    "  - 0 — entirely retained onshore. Use for editorial / on-air talent / SOX-critical close controls / top-tier client relationships / live broadcast operating layer.",
    "",
    "VERSANT-SPECIFIC CONSTRAINTS YOU MUST APPLY:",
    "  - Brian Carovillano (SVP Standards & Editorial) holds binding veto on any newsroom workflow → editorial / on-air / standards work = 0% GCC, full stop.",
    "  - MS NOW progressive positioning + CNBC anchor producers → political brand sensitivity is high. Editorial-adjacent rows (fact-check pipelines, source vetting, on-air control) lean 0-20% GCC.",
    "  - BB- credit rating → Treasury / debt management / covenant monitoring stays onshore (0-20% GCC). AP/AR/T&E/intercompany ops are GCC-eligible (Wave 1 covenant savings — 80-95% GCC).",
    "  - Newly-public SEC obligations + first SOX cycle → SOX-critical close controls stay onshore (0-15% GCC) until Wave 3 post-clean-opinion. Pure ops (AR aging, AP processing) lean 80-95% GCC.",
    "  - NBCU TSA expirations gate timing — but the gccPct itself is independent of timing. Use TSA constraints only as context, not a routing override.",
    "  - Sales is GREENFIELD post-TSA (Versant building its own ad-sales org for the first time). Top-tier ad-sales relationships = 0% GCC. Ad-ops / traffic / billing back-office = 80-95% GCC.",
    "  - Service tower contact-center work = 90-100% GCC (multi-brand contact routes to the hub).",
    "  - Operations-Technology (live broadcast / master control / transmission) = 0% GCC for the live operating layer; back-office monitoring = 50-70% GCC.",
    "",
    "REASON GUIDANCE (one sentence per row, ≤200 chars):",
    "  - Be Versant-specific. Name brands (MS NOW, CNBC, Golf Channel, GolfNow, GolfPass, Fandango, SportsEngine), the BB- rating, the NBCU TSA, the first SOX cycle, multi-brand contact center — wherever they fit. Never write a sentence that could apply to any media company.",
    "  - State what stays onshore AND what moves to the GCC. Be declarative.",
    "  - Never use hedge phrases ('potentially', 'could possibly', 'may help to', 'leverage AI'). State the split as the recommendation.",
    "  - Never invent financials. Don't quantify FTEs or savings — those numbers come from the deterministic substrate.",
    "",
    "OUTPUT FORMAT — STRICT JSON ONLY:",
    '{"items": [{"rowId": "<exact rowId from input>", "gccPct": <integer 0-100>, "reason": "<one sentence, ≤200 chars>"}, ...]}',
    "",
    "Return one item per input row, in INPUT ORDER. Echo every rowId exactly. Never skip rows. Never add extra rows. Never return any prose outside the JSON.",
  ].join("\n");
}

export function buildOffshoreUserPrompt(rows: LLMOffshoreRowInput[]): string {
  const lines = rows.map((r, i) => {
    const total =
      (r.headcount.fteOnshore ?? 0) +
      (r.headcount.fteOffshore ?? 0) +
      (r.headcount.contractorOnshore ?? 0) +
      (r.headcount.contractorOffshore ?? 0);
    const dial = r.dialPct == null ? "unset" : `${r.dialPct}%`;
    const activities =
      r.l5Names && r.l5Names.length > 0
        ? r.l5Names
        : r.l4Names && r.l4Names.length > 0
          ? r.l4Names
          : [];
    const l5Snippet =
      activities.length > 0
        ? ` :: L5=[${activities.slice(0, 3).map((s) => truncate(s, 60)).join(", ")}]`
        : "";
    const l4Snippet =
      r.l4 && r.l4.trim() ? ` L4="${truncate(r.l4, 80)}"` : "";
    return `${i + 1}. rowId="${r.rowId}" tower="${r.towerName}" L2="${truncate(r.l2, 80)}" L3="${truncate(r.l3, 80)}"${l4Snippet} hc=${total} priorGccPct=${dial}${l5Snippet}`;
  });
  return [
    `Assign a gccPct (integer 0-100) to each of these ${rows.length} L4 Activity Groups, and write a single Versant-grounded sentence per row (≤200 chars). Preserve order. Echo each rowId exactly.`,
    "",
    ...lines,
  ].join("\n");
}

function truncate(s: string, max = 120): string {
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
