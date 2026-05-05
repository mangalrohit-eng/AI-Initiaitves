/**
 * Server-only OpenAI helper for L4-level AI initiative curation.
 *
 * One batched call per tower scores every L4 across every queued L3 row in a
 * single request. The model returns the full Stage 2 (verdict) + Stage 3
 * (curation summary) shape — eligibility, binary feasibility, rationale,
 * vendor, agent one-liner — and the caller stamps it onto the persisted
 * `L4Item.l4Items` array so the AI Initiatives view-model can read straight
 * from the cache.
 *
 * Why feasibility (not priority): the prompt asks the model to score binary
 * ship-readiness only. Cross-tower priority is computed deterministically by
 * the program-level 2x2 in `lib/initiatives/programTier.ts` from
 * (feasibility, parent-L4 Activity Group business impact). The deterministic
 * substrate keeps its field names (`l3AiUsd`, `l3RowId`) for back-compat —
 * those fields semantically describe the L4 Activity Group prize under V5.
 * This separation prevents the model from accidentally producing tower-local
 * priorities that aren't comparable across towers.
 *
 * Design notes (post-PR1 unification):
 *  - Routes through `versantPromptKit` for identity, per-tower context,
 *    vendor allow-list, voice rules, and the Chat-vs-Responses-API call
 *    shape. Every Versant LLM module shares those constants.
 *  - Uses `gpt-5.5` via the Responses API + reasoning by default; the global
 *    `OPENAI_MODEL` env var still overrides. Per-route `OPENAI_*_MODEL`
 *    overrides are gone — every Versant call uses the same model.
 *  - Vendor allow-list + canonical `notEligibleReason` enforcement runs
 *    server-side after the LLM responds. Hallucinated vendors / paraphrased
 *    reasons are rejected and replaced with `"TBD — subject to discovery"`
 *    or undefined respectively, so the rendered card never claims a vendor
 *    that doesn't exist or invents a sixth "why not AI" reason.
 *  - Click-through fields (`initiativeId`, `briefSlug`) are NEVER set by
 *    the LLM. The pipeline matches them via `aiCurationOverlay` post-call.
 *  - Safety guard: a single tower in this codebase has at most ~70 L4s, so
 *    one batched request still fits well under the model's context window.
 *    The hard ceiling at 100 L5 Activities is paranoid headroom.
 */

import type {
  Feasibility,
  TowerProcessCriticality,
  TowerProcessFrequency,
  TowerProcessMaturity,
} from "@/data/types";
import type { AiCurationStatus } from "@/data/capabilityMap/types";
import type { NotEligibleReason, TowerId } from "@/data/assess/types";
import { TOWER_READINESS_MAX_DIGEST_CHARS } from "@/lib/assess/towerReadinessIntake";
import {
  ALLOWED_VENDORS,
  NOT_ELIGIBLE_REASONS,
  VERSANT_DEFAULT_REASONING_EFFORT,
  VersantLLMError,
  buildAllowListsBlock,
  buildInitiativeNamingBlock,
  buildLLMRequest,
  buildTowerContextBlock,
  buildVersantPreamble,
  buildVoiceRulesBlock,
  isLLMConfigured as kitIsLLMConfigured,
} from "@/lib/llm/prompts/versantPromptKit";

const DEFAULT_TIMEOUT_MS = 90_000;

/**
 * Hard ceiling per tower per call. The pipeline batches by tower already.
 * Pre-migration the LLM scored L4 Activities; post-5-layer-migration it
 * scores L5 Activities. Same per-call ceiling — the leaves themselves
 * didn't get more numerous, the layer numbering shifted.
 */
export const MAX_L5S_PER_CALL = 100;
/** @deprecated Renamed to `MAX_L5S_PER_CALL` in the 5-layer migration. */
export const MAX_L4S_PER_CALL = MAX_L5S_PER_CALL;

export type CurateLLMRowInput = {
  /** Round-tripped so the caller can match results back without name fuzzing. */
  rowId: string;
  /**
   * V5 L2 Job Grouping label — the topmost bucket inside the tower (e.g.
   * "Finance & Accounting"). Field stays named `l2` to keep the wire-format
   * stable across the 5-layer cutover.
   */
  l2: string;
  /**
   * V5 L3 Job Family label — the mid-tier bucket (e.g. "Source-to-Pay").
   * Field name retained for wire-format stability.
   */
  l3: string;
  /**
   * V5 L4 Activity Group label — the dial-bearing row that the L5 Activities
   * sit under (e.g. "Invoice Processing"). REQUIRED for accurate scoring:
   * without it the model collapses two layers of context and produces
   * lower-quality verdicts (often defaulting to not-eligible because it
   * can't distinguish a generic activity from a Versant-specific one).
   *
   * Optional only for legacy callers mid-cutover; server falls back to
   * using `l3` as the Activity Group when absent and emits a warning so the
   * miscall is visible.
   */
  l4?: string;
  /**
   * The L5 Activity names under the L4 Activity Group (was L4 Activities
   * under an L3 Capability). The model scores each leaf for AI eligibility.
   */
  l5Activities: string[];
  /**
   * Optional qualitative feedback from the user to steer the curation for this
   * row. Used by the per-row "Refine + regenerate" affordance on Step 4. The
   * system prompt instructs the model that feedback can shift priority /
   * rationale / vendor selections, but CANNOT bypass the canonical
   * not-eligible reasons or the vendor allow-list. Sanitized server-side to
   * ≤600 chars before this struct is built.
   */
  feedback?: string;
  /**
   * Optional L2 / L3 / L4 narrative context. Server route looks these
   * up from the canonical map (`resolveRowDescriptions`) before invoking;
   * when present, the user prompt renders a "ROW NARRATIVE CONTEXT" block
   * so each per-row LLM call has explicit grounding. Outranks the
   * tower-context paragraph for THIS row's specifics. Omitted on towers
   * that haven't been description-authored yet.
   */
  l2Description?: string;
  l3Description?: string;
  l4Description?: string;
};

/** One scored L5 Activity — server-validated shape returned to the caller. */
export type CurateLLMItem = {
  /** The L5 Activity inventory label, echoed verbatim from input. */
  name: string;
  /**
   * AI-initiative-style display title — what the AI does, not the
   * underlying activity. Set only when `aiEligible === true`. Server-side
   * sanitization rejects forbidden openers (Automate / Improve / Enhance /
   * Accelerate / Transform / Modernize) and titles that echo `name`
   * verbatim, falling back to `undefined` so callers can synthesize a
   * deterministic title.
   */
  initiativeName?: string;
  aiCurationStatus: AiCurationStatus;
  aiEligible: boolean;
  /**
   * Binary ship-readiness — feeds the cross-tower 2x2 deterministically.
   * The LLM scores ONLY this dimension; program priority is computed
   * downstream from (feasibility, parent-L4 Activity Group business impact).
   */
  feasibility?: Feasibility;
  aiRationale: string;
  notEligibleReason?: NotEligibleReason;
  frequency?: TowerProcessFrequency;
  criticality?: TowerProcessCriticality;
  currentMaturity?: TowerProcessMaturity;
  primaryVendor?: string;
  agentOneLine?: string;
};

export type CurateLLMRow = {
  rowId: string;
  /**
   * Scored L5 Activities for this row. Pre-migration this was named
   * `l4Items` because the leaves were L4. Renamed in the 5-layer migration.
   */
  l5Items: CurateLLMItem[];
};

export type CurateLLMOptions = {
  /**
   * Test-only model override. Production callers should let the kit resolve
   * the model from `OPENAI_MODEL` (or the default `gpt-5.5`).
   */
  model?: string;
  timeoutMs?: number;
  /** Tower AI readiness questionnaire digest — same cap as `towerReadinessIntake`. */
  towerIntakeDigest?: string;
};

/**
 * Vendor allow-list. Re-exported from `versantPromptKit.ALLOWED_VENDORS`
 * so legacy importers (`crossTowerAiPlan.v1`, `crossTowerAiPlan.v3`,
 * `curateBriefProcessLLM`, `scripts/curateInitiativesContract`) keep
 * working without touching their import paths. Use the kit directly in
 * any new code.
 *
 * @deprecated Import `ALLOWED_VENDORS` from `@/lib/llm/prompts/versantPromptKit` instead.
 */
export const VENDOR_ALLOW_LIST: readonly string[] = ALLOWED_VENDORS;

const VENDOR_TBD = "TBD — subject to discovery";

const FREQUENCIES: readonly TowerProcessFrequency[] = [
  "Continuous",
  "Daily",
  "Weekly",
  "Monthly",
  "Quarterly",
  "Annual",
  "Event-driven",
  "Seasonal",
  "Per hire",
  "Per episode",
  "Per event",
  "Per departure",
  "Per production",
  "Per listen",
  "Bi-weekly",
  "Semi-annual",
];

const CRITICALITIES: readonly TowerProcessCriticality[] = [
  "Mission-critical",
  "High",
  "Medium",
  "Low",
];

const MATURITIES: readonly TowerProcessMaturity[] = [
  "Manual",
  "Semi-automated",
  "Automated",
  "Not yet established",
];

export function isLLMConfigured(): boolean {
  return kitIsLLMConfigured();
}

class LLMError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "LLMError";
  }
}

function buildSystemPrompt(towerId: TowerId, towerIntakeDigest?: string): string {
  const digestBlock =
    towerIntakeDigest && towerIntakeDigest.trim().length > 0
      ? [
          "",
          "===========================================================================",
          "TOWER LEAD QUESTIONNAIRE (Forge Tower AI Readiness Intake)",
          "===========================================================================",
          "When the following conflicts with the tower context paragraph above, the questionnaire WINS for this tower's systems, tools, experiments, data, constraints, instincts, quick wins, and explicit no-go zones.",
          "Authority order: questionnaire facts > per-row user feedback > tower context paragraph. Per-row feedback still CANNOT override the vendor allow-list or the five canonical not-eligible reasons.",
          "",
          towerIntakeDigest.trim(),
        ].join("\n")
      : "";
  const sections: string[] = [
    "You curate Versant Media Group L5 Activities (the leaf rung under each L4 Activity Group on the 5-layer capability map) for an AI initiatives agenda. Every output must be Versant-specific and declarative — never generic.",
    "",
    "Capability map shape (top-down, 5 layers):",
    "  L1 Function (e.g. Finance) > L2 Job Grouping > L3 Job Family > L4 Activity Group > L5 Activity",
    "Each input row gives you the parent context (Job Grouping → Job Family → Activity Group) and the L5 Activities sitting directly under that Activity Group. You score the L5 Activities — never the parents.",
    "",
    buildVersantPreamble({ grain: "row" }),
    "",
    buildTowerContextBlock(towerId),
    "",
    "For each L5 Activity, return a verdict (Stage 2) plus a short curation summary (Stage 3). Eligible items get an `initiativeName` (the AI initiative title) + a binary feasibility + frequency + criticality + maturity + primaryVendor + agentOneLine. Not-eligible items skip the curation fields and instead return one of the FIVE canonical reasons.",
    "",
    buildInitiativeNamingBlock(),
    "",
    "ELIGIBILITY rule (the binary field `aiEligible`):",
    "  Default `aiEligible = true` for any L5 Activity that is processing, matching, reconciling, drafting, tagging, transcribing, summarising, monitoring, anomaly-detection, classification, extraction, routing, scheduling, dispatching, forecasting, validation, compliance-check, ingestion, normalisation, or any rules-based / pattern-driven operation — even when it sits inside a parent bucket whose NAME contains a not-eligible keyword (e.g. an `Account Reconciliation` L5 inside a `Treasury & Capital` L3 is still eligible — the activity itself is rules-based).",
    "",
    "  Mark `aiEligible = false` ONLY when the SPECIFIC L5 Activity itself is one of the four patterns below. Do NOT exclude an L5 just because its parent L4/L3 name brushes past one of these words.",
    "",
    "FEASIBILITY rule (the binary field `feasibility`, only set when aiEligible = true):",
    "  feasibility = 'High' when ALL three signals hold:",
    "    (1) The activity is rules-based or pattern-driven (not requiring net-new editorial / negotiation / executive judgment on EACH instance),",
    "    (2) A named vendor on the allow-list ALREADY supports this work or directly applies,",
    "    (3) Cadence is recurring at meaningful volume (Continuous / Daily / Weekly / Bi-weekly / Event-driven) so automation pays back inside the plan window.",
    "  feasibility = 'Low' when the activity is genuinely AI-eligible but needs longer runway: net-new platform stand-up, heavy change-management, multi-system integrations, or new vendor onboarding before the agent fleet can ship.",
    "  Feasibility is BINARY by design — there is NO 'Medium'. Cross-tower priority (P1/P2/P3) is computed downstream by the deterministic 2x2; do NOT attempt to score priority.",
    "",
    "NOT-ELIGIBLE patterns (apply to the L5 Activity itself, not its parent):",
    "  - The L5 IS editorial judgment / on-air talent decision / fact-checking / political-coverage editorial call → 'Requires human editorial judgment'. NOT: editorial production support, transcript drafting, broadcast monitoring, news ingest — those are eligible.",
    "  - The L5 IS deal-making / counterparty negotiation / agency-relationship / key-account selling / carriage negotiation / talent-rights negotiation → 'Fundamentally relationship-driven'. NOT: contract abstraction, deal-pipeline tracking, renewal forecasting — those are eligible.",
    "  - The L5 IS a strategic decision call (capital-allocation policy, M&A go/no-go, board-level strategy, executive-judgment 10-K narrative authoring, political-brand positioning decision, multi-year covenant-strategy decision) → 'Strategic exercise requiring executive judgment'. NOT: covenant DATA monitoring, 10-K data assembly, treasury cash-position reporting, MD&A first-draft generation — those are eligible.",
    "  - The L5 IS in-the-moment live broadcast / master-control switching / studio-floor production direction → 'Requires human editorial judgment'. NOT: playout scheduling, transmission monitoring, ad-trafficking automation — those are eligible.",
    "  - The L5 is already fully automated by an entrenched system with no further AI lift available → 'Already automated via existing tools'.",
    "  - The L5 is genuinely tiny-volume one-off work (e.g. annual / per-departure / per-production with <10 instances/year) where no payback exists → 'Low volume — ROI doesn't justify AI investment'.",
    "",
    "Worked examples (apply the same logic across all towers):",
    "  ELIGIBLE — Bank Reconciliations / Intercompany Eliminations / Invoice Match-Pay-Extract / 10-K Data Assembly / MD&A First-Draft Drafting / Cash Flow Forecasting / Multi-Entity Close Orchestration / Vendor Onboarding Diligence / KPI Scorecard Refresh / Anomaly-Detection on Transmission Logs / Closed-Captioning / News-Clip Tagging / Subscriber-Churn Scoring / Talent-Match Sourcing.",
    "  NOT ELIGIBLE — On-Air Anchor Selection / Sports-Rights Deal Negotiation / Capital-Allocation Strategy Calls / Live Newsroom Editorial Direction / Master-Control Switching During Live Telecast / Board-Level M&A Go/No-Go.",
    "",
    buildVoiceRulesBlock(),
    "",
    "RATIONALE GUIDANCE — keep `aiRationale` ≤25 words, declarative, Versant-specific. Name a real Versant brand or structural constraint when relevant. NEVER write rationales that could apply to any media company.",
    "",
    "ALLOWED `notEligibleReason` STRINGS (exact match; LLM paraphrase is rejected):",
    NOT_ELIGIBLE_REASONS.map((r) => `  - ${r}`).join("\n"),
    "",
    buildAllowListsBlock({ includePeople: false, includeVendors: true }),
    "",
    `primaryVendor MUST be chosen from the ALLOWED VENDORS list above (case-sensitive). For compound stacks, separate with " + ". If no allow-list vendor fits, RETURN THE EXACT STRING "${VENDOR_TBD}" (em dash) — never invent a vendor.`,
    "",
    "agentOneLine MUST describe what the agent does + the concrete saving in ≤30 words. Example: 'Reconciliation Agent matches intercompany transactions across 7+ Versant entities, auto-resolves timing diffs, flags exceptions for human review.' Never write 'leverages AI' or 'transforms the workflow'.",
    "",
    "When per-row user feedback is provided, you MAY use it to shift feasibility / rationale / vendor selections — but feedback CANNOT bypass the canonical not-eligible reasons (the five strings above), the vendor allow-list, or the rule that editorial / negotiation / strategic-judgment activities stay reviewed-not-eligible. When a tower questionnaire block appears below, it ranks above per-row feedback for tower-specific facts; if feedback contradicts those constraints, ignore the contradicting part of the feedback and stay grounded.",
    "",
    "Return STRICT JSON ONLY in this exact shape, with one outer item per input row, in INPUT ORDER, and one inner item per L5 Activity in EACH ROW'S INPUT ORDER:",
    '{"rows": [{"rowId": "<echo input rowId>", "l5Items": [',
    '  {',
    '    "name": "<echo L5 Activity name verbatim>",',
    '    "initiativeName": "<AI initiative title, 3-7 words, distinct from `name`>" | null,',
    '    "aiEligible": <true|false>,',
    '    "feasibility": "High" | "Low" | null,',
    '    "aiRationale": "<≤25 words, Versant-specific>",',
    '    "notEligibleReason": "<one of the five canonical strings>" | null,',
    '    "frequency": "Continuous" | "Daily" | "Weekly" | "Monthly" | "Quarterly" | "Annual" | "Event-driven" | "Seasonal" | "Per hire" | "Per episode" | "Per event" | "Per departure" | "Per production" | "Per listen" | "Bi-weekly" | "Semi-annual" | null,',
    '    "criticality": "Mission-critical" | "High" | "Medium" | "Low" | null,',
    '    "currentMaturity": "Manual" | "Semi-automated" | "Automated" | "Not yet established" | null,',
    '    "primaryVendor": "<allow-list value or TBD — subject to discovery>" | null,',
    '    "agentOneLine": "<≤30 words, name the agent + concrete saving>" | null',
    '  }',
    "]}, ...]}",
    "",
    "Use null for any field that doesn't apply (e.g., feasibility on a not-eligible item, initiativeName on a not-eligible item). Eligible items MUST set initiativeName + feasibility + aiRationale + frequency + criticality + currentMaturity + primaryVendor + agentOneLine. Not-eligible items MUST set notEligibleReason and aiRationale, leave the rest null.",
    "",
    "Do NOT skip rows. Do NOT add extra rows or extra L5 items. Echo `name` and `rowId` verbatim. Do NOT add prose outside the JSON object.",
  ];
  return sections.join("\n") + digestBlock;
}

function buildUserPrompt(rows: CurateLLMRowInput[]): string {
  const lines: string[] = [];
  rows.forEach((r, ri) => {
    // V5 hierarchy: r.l2 = Job Grouping, r.l3 = Job Family, r.l4 =
    // Activity Group (the dial-bearing parent of the L5 leaves). Pre-V5
    // callers may omit l4 — fall back to using l3 as the Activity Group
    // and signal the missing layer in the label so the model knows.
    const jobGrouping = truncate(r.l2);
    const jobFamily = truncate(r.l3);
    const activityGroup = r.l4 ? truncate(r.l4) : truncate(r.l3);
    const ambiguous = !r.l4;
    lines.push(
      `Row ${ri + 1} (rowId="${r.rowId}") — L2 Job Grouping="${jobGrouping}" / L3 Job Family="${jobFamily}" / L4 Activity Group="${activityGroup}"${ambiguous ? " (Activity Group inferred from Job Family — legacy v4 input)" : ""}:`,
    );
    if (r.feedback && r.feedback.trim()) {
      lines.push(`  User feedback to honor for this row: "${truncate(r.feedback, 600)}"`);
    }
    const ctxBlock = renderRowDescriptionBlock(r);
    if (ctxBlock) lines.push(ctxBlock);
    r.l5Activities.forEach((name, ai) => {
      lines.push(`  L5 Activity ${ai + 1}. ${truncate(name, 200)}`);
    });
    lines.push("");
  });
  return [
    `Curate every L5 Activity below in the context of its parent L4 Activity Group. Echo \`rowId\` and \`name\` verbatim. Preserve order.`,
    "When a row carries a NARRATIVE CONTEXT block, ground every verdict (eligibility / feasibility / rationale / vendor / agent one-liner) in those specifics — they're authored by Versant tower leads and outrank generic inferences from the row label. The tower context paragraph in the system prompt remains the floor; per-row narrative is the ceiling.",
    "",
    ...lines,
  ].join("\n");
}

/**
 * Render the per-row narrative context sub-block. Returns the empty
 * string when no description fields are populated, so the user prompt
 * stays compact for towers that haven't been authored yet. Indentation
 * is two spaces deeper than the surrounding row block to read as a
 * sub-section in the rendered prompt.
 */
function renderRowDescriptionBlock(row: CurateLLMRowInput): string {
  const parts: string[] = [];
  if (row.l2Description?.trim()) {
    parts.push(`    L2 — ${truncate(row.l2Description, 480)}`);
  }
  if (row.l3Description?.trim()) {
    parts.push(`    L3 — ${truncate(row.l3Description, 480)}`);
  }
  if (row.l4Description?.trim()) {
    parts.push(`    L4 — ${truncate(row.l4Description, 480)}`);
  }
  if (parts.length === 0) return "";
  return ["  NARRATIVE CONTEXT:", ...parts].join("\n");
}

function truncate(s: string, max = 160): string {
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

const VENDOR_ALLOW_LOWER = new Set(ALLOWED_VENDORS.map((v) => v.toLowerCase()));

/**
 * Validate an LLM-returned vendor string against the allow-list. Compound
 * names separated by " + " are validated piece-wise — each token must be on
 * the allow-list. Unknown vendors fall back to `"TBD — subject to discovery"`.
 */
function sanitizeVendor(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed === VENDOR_TBD) return VENDOR_TBD;
  // Allow compound stacks like "BlackLine + Workiva" or "BlackLine + LLM".
  // The "LLM" suffix is a deliberate special case the overlay uses.
  const parts = trimmed.split(/\s*\+\s*/);
  const allOk = parts.every((p) => {
    if (p.toLowerCase() === "llm") return true;
    return VENDOR_ALLOW_LOWER.has(p.toLowerCase());
  });
  if (allOk) {
    // Re-normalise by joining on " + " in original case.
    return parts.join(" + ");
  }
  return VENDOR_TBD;
}

function sanitizeNotEligibleReason(raw: unknown): NotEligibleReason | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  for (const reason of NOT_ELIGIBLE_REASONS) {
    if (trimmed === reason) return reason;
  }
  return undefined;
}

/**
 * Normalize the LLM's binary feasibility response into the canonical
 * `Feasibility` literal. Tolerates common case / whitespace variations and
 * the legacy "P1"/"P2"/"P3" fallbacks (P1 → High; P2/P3 → Low) so a model
 * that accidentally echoes the old schema still produces a usable answer.
 */
function sanitizeFeasibility(raw: unknown): Feasibility | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === "high") return "High";
  if (trimmed === "low") return "Low";
  // Back-compat — accept "P1"/"P2"/"P3" if the model regresses to the old prompt.
  if (trimmed.startsWith("p1")) return "High";
  if (trimmed.startsWith("p2") || trimmed.startsWith("p3")) return "Low";
  return undefined;
}

function sanitizeFrequency(raw: unknown): TowerProcessFrequency | undefined {
  if (typeof raw !== "string") return undefined;
  return (FREQUENCIES as readonly string[]).includes(raw)
    ? (raw as TowerProcessFrequency)
    : undefined;
}

function sanitizeCriticality(
  raw: unknown,
): TowerProcessCriticality | undefined {
  if (typeof raw !== "string") return undefined;
  return (CRITICALITIES as readonly string[]).includes(raw)
    ? (raw as TowerProcessCriticality)
    : undefined;
}

function sanitizeMaturity(raw: unknown): TowerProcessMaturity | undefined {
  if (typeof raw !== "string") return undefined;
  return (MATURITIES as readonly string[]).includes(raw)
    ? (raw as TowerProcessMaturity)
    : undefined;
}

function sanitizeText(raw: unknown, maxLen = 240): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen - 1)}…` : trimmed;
}

/**
 * Forbidden openers for `initiativeName`. The LLM is told this in the
 * prompt; we re-validate server-side as a belt-and-suspenders check. When
 * a name violates the rule (or echoes the underlying activity verbatim),
 * we drop it so the deterministic composer or UI fallback can synthesize
 * a clean title.
 */
const INITIATIVE_NAME_FORBIDDEN_OPENERS = [
  "automate ",
  "automating ",
  "improve ",
  "improving ",
  "enhance ",
  "enhancing ",
  "accelerate ",
  "accelerating ",
  "transform ",
  "transforming ",
  "modernize ",
  "modernizing ",
];

/**
 * Validates the LLM-returned `initiativeName` against the AI-forward
 * naming rules in the prompt:
 *   - 3-7 words
 *   - not starts with a forbidden opener
 *   - not equal (case-insensitive) to the underlying L5 Activity label,
 *     so the headline title actually communicates "what AI does"
 * Returns `undefined` on any violation so the UI / fallback can supply a
 * safer title.
 */
function sanitizeInitiativeName(
  raw: unknown,
  l5ActivityName: string,
): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  for (const opener of INITIATIVE_NAME_FORBIDDEN_OPENERS) {
    if (lower.startsWith(opener)) return undefined;
  }
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount < 2 || wordCount > 9) return undefined;
  // Reject titles that just echo the L5 Activity label — the entire point
  // of `initiativeName` is to differentiate from the inventory name.
  if (lower === l5ActivityName.trim().toLowerCase()) return undefined;
  // Cap at 100 chars for layout safety.
  return trimmed.length > 100 ? `${trimmed.slice(0, 99)}…` : trimmed;
}

/**
 * Validate and normalise the model's per-row payload into the strict
 * `CurateLLMItem[]` shape. Throws `LLMError` on shape mismatch — caller
 * owns the per-row fallback decision.
 *
 * Accepts both the new `l5Items` payload key and the legacy `l4Items`
 * alias so a model that hasn't fully transitioned to the new prompt
 * vocabulary still parses cleanly. Prefers the new key.
 */
function parseLLMRowItems(
  input: CurateLLMRowInput,
  llmRow: Record<string, unknown>,
): CurateLLMItem[] {
  const llmItems = Array.isArray(llmRow.l5Items)
    ? (llmRow.l5Items as unknown[])
    : Array.isArray(llmRow.l4Items)
      ? (llmRow.l4Items as unknown[])
      : [];
  if (llmItems.length !== input.l5Activities.length) {
    throw new LLMError(
      `Row ${input.rowId}: model returned ${llmItems.length} items for ${input.l5Activities.length} L5 Activities`,
    );
  }
  return input.l5Activities.map((expectedName, ai) => {
    const item = (llmItems[ai] ?? {}) as Record<string, unknown>;
    const aiEligible = item.aiEligible === true;
    const status: AiCurationStatus = aiEligible
      ? "curated"
      : "reviewed-not-eligible";
    const aiRationale =
      sanitizeText(item.aiRationale, 240) ??
      (aiEligible
        ? "Versant-specific rationale TBD — subject to discovery."
        : "Reviewed and parked — subject to discovery.");

    if (!aiEligible) {
      return {
        name: expectedName,
        aiCurationStatus: status,
        aiEligible: false,
        aiRationale,
        notEligibleReason:
          sanitizeNotEligibleReason(item.notEligibleReason) ??
          // Fall through to a safe default if the model paraphrased; the
          // caller can choose to re-route through the deterministic
          // composer instead of trusting this fallback.
          "Strategic exercise requiring executive judgment",
      };
    }

    return {
      name: expectedName,
      initiativeName: sanitizeInitiativeName(item.initiativeName, expectedName),
      aiCurationStatus: status,
      aiEligible: true,
      aiRationale,
      feasibility: sanitizeFeasibility(item.feasibility),
      frequency: sanitizeFrequency(item.frequency),
      criticality: sanitizeCriticality(item.criticality),
      currentMaturity: sanitizeMaturity(item.currentMaturity),
      primaryVendor: sanitizeVendor(item.primaryVendor),
      agentOneLine: sanitizeText(item.agentOneLine, 280),
    };
  });
}

/**
 * Tiny inline concurrency limiter. Pulls the next pending task off the
 * queue whenever a slot opens up, keeping at most `concurrency` tasks
 * in flight. Avoids adding a `p-limit` dependency for the one place we
 * need bounded fan-out.
 */
async function runWithLimit<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const cap = Math.max(1, Math.floor(concurrency));
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (true) {
      const i = cursor;
      if (i >= items.length) return;
      cursor += 1;
      results[i] = await fn(items[i], i);
    }
  }
  const workers: Promise<void>[] = [];
  for (let w = 0; w < Math.min(cap, items.length); w += 1) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

/**
 * Per-row LLM call. Builds a single-row prompt and returns the parsed
 * `l5Items` array for that row. Throws `LLMError` on transport, JSON,
 * or shape failure — caller decides whether to fall back per-row.
 */
async function callLLMForSingleRow(
  towerId: TowerId,
  row: CurateLLMRowInput,
  options: { model?: string; timeoutMs: number; towerIntakeDigest?: string; signal?: AbortSignal },
): Promise<CurateLLMItem[]> {
  let parsed: unknown;
  try {
    const result = await buildLLMRequest({
      systemPrompt: buildSystemPrompt(towerId, options.towerIntakeDigest),
      userPrompt: buildUserPrompt([row]),
      model: options.model,
      reasoningEffort: VERSANT_DEFAULT_REASONING_EFFORT,
      timeoutMs: options.timeoutMs,
      signal: options.signal,
    });
    parsed = result.parsed;
  } catch (e) {
    if (e instanceof VersantLLMError) {
      throw new LLMError(e.message, e);
    }
    throw new LLMError(
      e instanceof Error ? e.message : "OpenAI call failed",
      e,
    );
  }
  const llmRows = (parsed as { rows?: unknown[] })?.rows;
  if (!Array.isArray(llmRows) || llmRows.length === 0) {
    throw new LLMError(`Row ${row.rowId}: OpenAI JSON missing or empty 'rows'`);
  }
  // Single-row prompt should return exactly one row. Some models may wrap
  // a single row in an array of length 1 — accept that. Reject anything
  // else so a malformed batch doesn't silently get truncated.
  if (llmRows.length !== 1) {
    throw new LLMError(
      `Row ${row.rowId}: OpenAI returned ${llmRows.length} rows for a single-row request`,
    );
  }
  const llmRow = (llmRows[0] ?? {}) as Record<string, unknown>;
  return parseLLMRowItems(row, llmRow);
}

/**
 * Per-row outcome from the fan-out path. `ok: true` carries the parsed
 * `l5Items`; `ok: false` carries the error string and lets the caller
 * choose between deterministic fallback or rolling the row up to the
 * UI as failed.
 */
export type CurateLLMRowOutcome =
  | { rowId: string; ok: true; l5Items: CurateLLMItem[] }
  | { rowId: string; ok: false; error: string };

/**
 * L4-level fan-out: makes ONE LLM call per input row, bounded by
 * `concurrency` (default 6). Per-row failures DO NOT fail the batch —
 * the failed rows surface as `{ ok: false, error }` outcomes so the
 * caller can fall back deterministically per row, and the UI can show
 * partial progress instead of a blank tower on a single row's failure.
 *
 * `onRowComplete` fires as each row finishes (in completion order, not
 * input order) so an SSE endpoint can stream results to the client as
 * soon as they're ready. The returned array is in INPUT ORDER.
 *
 * Empty L5 lists short-circuit to a successful empty result without an
 * LLM call — saves tokens and round-trips for placeholder rows.
 */
export async function curateInitiativesPerRowWithLLM(
  towerId: TowerId,
  rows: CurateLLMRowInput[],
  options: CurateLLMOptions & {
    onRowComplete?: (outcome: CurateLLMRowOutcome) => void;
    concurrency?: number;
    signal?: AbortSignal;
  } = {},
): Promise<CurateLLMRowOutcome[]> {
  if (!kitIsLLMConfigured()) {
    throw new LLMError("OPENAI_API_KEY not set");
  }
  if (!rows.length) return [];
  const totalL5s = rows.reduce((s, r) => s + r.l5Activities.length, 0);
  if (totalL5s > MAX_L5S_PER_CALL) {
    throw new LLMError(
      `Tower has ${totalL5s} L5 Activities; max ${MAX_L5S_PER_CALL} per call.`,
    );
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const towerIntakeDigest = options.towerIntakeDigest?.trim()
    ? options.towerIntakeDigest.trim().slice(0, TOWER_READINESS_MAX_DIGEST_CHARS)
    : undefined;
  const concurrency = options.concurrency ?? 6;
  const onRowComplete = options.onRowComplete;

  return runWithLimit(rows, concurrency, async (row) => {
    // Empty rows skip the LLM entirely. Return a successful empty outcome
    // and fire the completion callback so the SSE stream still emits a
    // progress event (caller can render "no L5s on this row" immediately).
    if (row.l5Activities.length === 0) {
      const outcome: CurateLLMRowOutcome = {
        rowId: row.rowId,
        ok: true,
        l5Items: [],
      };
      onRowComplete?.(outcome);
      return outcome;
    }
    try {
      const l5Items = await callLLMForSingleRow(towerId, row, {
        model: options.model,
        timeoutMs,
        towerIntakeDigest,
        signal: options.signal,
      });
      const outcome: CurateLLMRowOutcome = {
        rowId: row.rowId,
        ok: true,
        l5Items,
      };
      onRowComplete?.(outcome);
      return outcome;
    } catch (e) {
      const error = e instanceof Error ? e.message : "Unknown LLM row error";
      const outcome: CurateLLMRowOutcome = {
        rowId: row.rowId,
        ok: false,
        error,
      };
      onRowComplete?.(outcome);
      return outcome;
    }
  });
}

/**
 * Back-compat wrapper that runs the per-row fan-out and collapses the
 * outcomes back into the legacy `CurateLLMRow[]` shape. Throws when
 * EVERY row fails (so the route's all-or-nothing fallback path still
 * fires); succeeds with whatever rows came back when there's at least
 * one usable row.
 *
 * New callers should prefer `curateInitiativesPerRowWithLLM` directly so
 * they can apply per-row deterministic fallback (and stream).
 */
export async function curateInitiativesWithLLM(
  towerId: TowerId,
  rows: CurateLLMRowInput[],
  options: CurateLLMOptions = {},
): Promise<CurateLLMRow[]> {
  const outcomes = await curateInitiativesPerRowWithLLM(towerId, rows, options);
  if (outcomes.length === 0) return [];
  const allFailed = outcomes.every((o) => !o.ok);
  if (allFailed) {
    const firstError =
      (outcomes.find((o) => !o.ok) as { error: string } | undefined)?.error ??
      "Every per-row LLM call failed";
    throw new LLMError(firstError);
  }
  // Mixed success/failure: surface succeeded rows; failed rows are
  // returned as empty `l5Items` so the response shape stays consistent.
  // The route layer is responsible for re-running the deterministic
  // composer on rows whose `l5Items` came back empty when the input row
  // had at least one L5 Activity.
  return rows.map((input) => {
    const outcome = outcomes.find((o) => o.rowId === input.rowId);
    if (outcome && outcome.ok) {
      return { rowId: input.rowId, l5Items: outcome.l5Items };
    }
    return { rowId: input.rowId, l5Items: [] };
  });
}
