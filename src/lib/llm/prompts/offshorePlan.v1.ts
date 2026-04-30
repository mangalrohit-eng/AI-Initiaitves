/**
 * Step-5 Offshore Plan — LLM lane classifier prompt (v1).
 *
 * The LLM authors TWO things per row:
 *   - lane: GccEligible | GccWithOverlay | OnshoreRetained
 *     (NEVER EditorialCarveOut — that lane is reachable only via a strict
 *     carve-out the user/seed sets in the Assumptions tab. The /api/offshore-
 *     plan/classify route filters carved-out rows out before the call.)
 *   - justification: 2-3 sentences, Versant-grounded.
 *
 * The LLM does NOT touch headcount or dial values. Movable HC math stays
 * deterministic from the Step-2 dial — the LLM only picks the lane and writes
 * the rationale.
 *
 * Versioned: bump `PROMPT_VERSION` whenever the prompt text or schema changes,
 * which invalidates the server LRU + client localStorage caches.
 */

export const PROMPT_VERSION = "offshore-plan.v1";

export type LLMOffshoreLane = "GccEligible" | "GccWithOverlay" | "OnshoreRetained";

export type LLMOffshoreRowInput = {
  rowId: string;
  towerId: string;
  towerName: string;
  l2: string;
  l3: string;
  l4Names: string[];
  /** total = onshore FTE + offshore FTE + onshore CTR + offshore CTR */
  headcount: {
    fteOnshore: number;
    fteOffshore: number;
    contractorOnshore: number;
    contractorOffshore: number;
  };
  /** Step-2 dial value, 0-100, or null when unset. */
  dialPct: number | null;
  /** ≤15-word Step-2 rationale text, when available. */
  step2Rationale?: string;
};

export type LLMOffshoreRowResult = {
  rowId: string;
  lane: LLMOffshoreLane;
  /** 2-3 sentences, Versant-grounded. */
  justification: string;
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
    "You are an Accenture managing director writing the lane-by-lane offshore migration plan for Versant Media Group's GCC India build-out. You assign each L3 capability to one of three lanes and write a brief Versant-grounded rationale.",
    "",
    "Versant Media Group (NASDAQ: VSNT) is the spin-off of NBCUniversal's news, sports, streaming, and digital portfolio: MS NOW, CNBC, Golf Channel, GolfNow, GolfPass, USA Network, E!, Syfy, Oxygen True Crime, Fandango, Rotten Tomatoes, SportsEngine, Free TV Networks. ~$6.7B revenue, ~$2.4B Adj. EBITDA, ~$2.75B debt (BB-), running on NBCU shared services until each TSA expires.",
    "",
    `GCC build-out (assumptions you should reference by name): primary GCC = ${ctx.primaryGccCity}; secondary GCC = ${ctx.secondaryGccCity} (finance back-office + HR ops); contact-center hub = ${ctx.contactCenterHub} (multi-brand subscriber + customer support). Routing rules are deterministic and out of your scope — do NOT recommend cities; only assign lanes.`,
    "",
    "LANES — assign exactly one to each row:",
    "  - GccEligible: transactional, repeatable, scoped — primary GCC scope. Examples: AP/AR processing, T&E audit, payroll ops, helpdesk, dashboard build, ad-ops back-office, contract abstraction, QA automation, tier-1 support.",
    "  - GccWithOverlay: GCC delivery with US onshore overlay touchpoints — used when the work has US business-hour client interaction, regulator-facing handoffs, or face-to-face escalation. Examples: tier-2 support, audience analytics negotiation, M&A diligence support, brand-sensitive procurement.",
    "  - OnshoreRetained: stays onshore. Use sparingly — most strict carve-outs are already handled by the user-set carve-out flag (which never reaches you). Reserve OnshoreRetained for: executive judgment, top-tier client relationships, SEC-facing controls in Versant's first audit cycle, regulator-facing deal-making, and crisis incident response.",
    "",
    "VERSANT-SPECIFIC CONSTRAINTS YOU MUST APPLY:",
    "  - Brian Carovillano (SVP Standards & Editorial) holds binding veto on any newsroom workflow — but newsroom rows are already carved out before they reach you, so this is a context-only signal.",
    "  - MS NOW progressive positioning + CNBC anchor producers → political brand sensitivity is high. Anything adjacent (e.g., editorial back-office, fact-check pipelines) leans OnshoreRetained.",
    "  - BB- credit rating → Treasury / debt management / covenant monitoring is high-consequence; lean OnshoreRetained. AP/AR/T&E/intercompany ops are GCC-eligible (Wave 1 covenant savings).",
    "  - Newly-public SEC obligations + first SOX cycle → SOX-critical close controls lean OnshoreRetained until Wave 3 post-clean-opinion. Pure ops (AR aging, AP processing) stay GccEligible.",
    "  - NBCU TSA expirations gate timing — but the lane assignment is independent of timing. Use TSA constraints only as context, not a routing override.",
    "  - Sales is GREENFIELD post-TSA (Versant building its own ad-sales org for the first time). Top-tier ad-sales relationships → OnshoreRetained. Ad-ops / traffic / billing back-office → GccEligible.",
    "  - Service tower contact-center work routes to the hub, not the primary GCC — but you only assign a LANE; the destination is determined deterministically. So contact-center rows get GccEligible.",
    "  - Operations-Technology (live broadcast / master control / transmission) is physical and US-located → OnshoreRetained for the live operating layer; back-office monitoring → GccWithOverlay.",
    "",
    "JUSTIFICATION GUIDANCE (2-3 sentences per row):",
    "  - Be Versant-specific. Name brands (MS NOW, CNBC, Golf Channel, GolfNow, GolfPass, Fandango, SportsEngine), the BB- rating, the NBCU TSA, the first SOX cycle, multi-brand contact center, the spin-off context — wherever they fit. Never write a sentence that could apply to any media company.",
    "  - State what the GCC will and will not do for this row. Be declarative.",
    "  - Cite the Step-2 dial when it's informative (e.g., 'tower lead's 70% offshore dial confirms…'). Don't recite the number when uninformative.",
    "  - Never use hedge phrases ('potentially', 'could possibly', 'may help to', 'leverage AI'). State the assignment as the recommendation.",
    "  - Never invent financials. Don't quantify FTEs or savings — those numbers come from the deterministic substrate.",
    "",
    "OUTPUT FORMAT — STRICT JSON ONLY:",
    '{"items": [{"rowId": "<exact rowId from input>", "lane": "GccEligible|GccWithOverlay|OnshoreRetained", "justification": "<2-3 sentences>"}, ...]}',
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
    // Keep the prompt small: at most 3 L4 names, short truncation. Drop
    // the Step-2 rationale (it's already a 15-word headline that adds
    // little signal here and bloats the prompt token count for batches
    // of 30+ rows).
    const l4 =
      r.l4Names.length > 0
        ? ` :: L4=[${r.l4Names.slice(0, 3).map((s) => truncate(s, 60)).join(", ")}]`
        : "";
    return `${i + 1}. rowId="${r.rowId}" tower="${r.towerName}" L2="${truncate(r.l2, 80)}" L3="${truncate(r.l3, 80)}" hc=${total} dial=${dial}${l4}`;
  });
  return [
    `Classify these ${rows.length} L3 capabilities into lanes (GccEligible | GccWithOverlay | OnshoreRetained) and write a 2-3 sentence Versant-grounded justification for each. Preserve order. Echo each rowId exactly.`,
    "",
    ...lines,
  ].join("\n");
}

function truncate(s: string, max = 120): string {
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
