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
 * Design notes:
 *  - Mirrors the structure of `inferDefaultsLLM.ts`: Chat Completions JSON
 *    mode (`response_format: { type: "json_object" }`), Versant-grounded
 *    system prompt, AbortController-based timeout, deterministic-fallback
 *    contract owned by the caller.
 *  - Vendor allow-list + canonical `notEligibleReason` enforcement runs
 *    server-side after the LLM responds. Hallucinated vendors / paraphrased
 *    reasons are rejected and replaced with `"TBD — subject to discovery"`
 *    or undefined respectively, so the rendered card never claims a vendor
 *    that doesn't exist or invents a sixth "why not AI" reason.
 *  - Click-through fields (`initiativeId`, `briefSlug`) are NEVER set by
 *    the LLM. The pipeline matches them via `aiCurationOverlay` post-call.
 *  - Safety guard: a single tower in this codebase has at most ~70 L4s, so
 *    one batched request fits well under `gpt-4o-mini`'s context window
 *    (~128k tokens). The hard ceiling at 100 L4s is paranoid headroom.
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

const DEFAULT_MODEL = "gpt-4o-mini";
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
};

/** One scored L5 Activity — server-validated shape returned to the caller. */
export type CurateLLMItem = {
  name: string;
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
  /** Override env (`OPENAI_CURATE_INITIATIVES_MODEL` then `OPENAI_MODEL`; default `gpt-4o-mini`). */
  model?: string;
  timeoutMs?: number;
  /** Tower AI readiness questionnaire digest — same cap as `towerReadinessIntake`. */
  towerIntakeDigest?: string;
};

/**
 * Vendor allow-list. Mirrors the named-vendor discipline from
 * `docs/context.md` and `data/capabilityMap/aiCurationOverlay.ts`. The
 * model is shown this exact list and told to either pick from it or
 * return the canonical fallback string `"TBD — subject to discovery"`.
 *
 * Lower-cased for case-insensitive matching server-side. Compound names
 * separated by `+` (e.g., `"BlackLine + Workiva"`) pass through as-is.
 */
export const VENDOR_ALLOW_LIST: readonly string[] = [
  "BlackLine",
  "Workiva",
  "Coupa",
  "Kyriba",
  "Cursor",
  "GitHub Copilot",
  "GitHub Actions",
  "Buildkite",
  "PagerDuty",
  "Datadog",
  "CrowdStrike",
  "Abnormal Security",
  "ConductorOne",
  "Okta",
  "LangSmith",
  "LiteLLM",
  "ServiceNow",
  "Workday",
  "Eightfold",
  "Amagi",
  "Telestream",
  "FreeWheel",
  "Operative",
  "Piano",
  "Zendesk",
  "Cresta",
  "Optimove",
  "Reuters Connect",
  "AP API",
  "Pinecone",
  "Descript",
  "Cision",
  "Brandwatch",
  "Deepgram",
  "LiveRamp",
  "Salesforce",
  "Anaplan",
  "OneTrust",
  "DocuSign CLM",
  "Iron Mountain",
  // LLM platform options — page already runs on the OpenAI API. Naming them
  // explicitly in the Cross-Tower Tech View is more honest than "TBD".
  "OpenAI",
  "Azure OpenAI",
];

const VENDOR_TBD = "TBD — subject to discovery";

const NOT_ELIGIBLE_REASONS: readonly NotEligibleReason[] = [
  "Requires human editorial judgment",
  "Fundamentally relationship-driven",
  "Already automated via existing tools",
  "Low volume — ROI doesn't justify AI investment",
  "Strategic exercise requiring executive judgment",
];

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

/** Tower priors — same context block reused from `inferDefaultsLLM.ts`. */
const TOWER_CONTEXT: Record<TowerId, string> = {
  finance:
    "Finance & treasury for a newly public BB-rated company. Heavy AP/AR/reconciliation routine + TSA-driven SEC reporting build-out + treasury covenant monitoring.",
  hr:
    "HR for ~9K employees across union (writers, IATSE, NABET) and non-union talent in US studio + corporate. New SEC issuer, new payroll stack post-TSA.",
  "research-analytics":
    "Audience, ad measurement, viewership analytics across linear, FAST, streaming, and digital. Heavy data work; some currency/methodology negotiation with MRC and JIC.",
  legal:
    "GC + commercial + IP + regulatory + litigation for a US-listed media company with sports rights, news brands (CNBC, MS NOW), and split-rights entertainment IP (e.g., Kardashians on-air vs streaming).",
  "corp-services":
    "Real estate, facilities, EHS, indirect procurement, travel, office services for ~9K headcount across studio + corporate sites.",
  "tech-engineering":
    "Product + platform engineering for streaming, GolfNow / GolfPass, Fandango, Rotten Tomatoes, ad-tech.",
  "operations-technology":
    "Broadcast operations, media supply chain, playout, studio ops, on-air technology — physical, on-prem, low-latency, US-required.",
  sales:
    "National + local ad sales (greenfield post-TSA), affiliate carriage, sponsorship, branded content. Relationship-driven.",
  "marketing-comms":
    "Brand marketing, PR, comms, social, growth marketing across MS NOW / CNBC / Golf / Free TV / Fandango.",
  service:
    "Customer service / subscriber support for direct-to-consumer products (GolfNow, GolfPass, Fandango). High volume, AI-friendly.",
  "editorial-news":
    "Newsroom for CNBC, MS NOW, Golf Channel, USA Network sports. EDITORIAL JUDGMENT IS NOT OFFSHORABLE — anchors, reporters, fact-checking, news judgment, political coverage stay onshore + human.",
  production:
    "Live and studio production — sets, control rooms, talent, on-air operations. Physical, US-located, talent-relationship-driven.",
  "programming-dev":
    "Programming strategy, scheduling, content acquisition / dev — strategic, deal-making, executive judgment.",
};

export function isLLMConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

class LLMError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "LLMError";
  }
}

function buildSystemPrompt(towerId: TowerId, towerIntakeDigest?: string): string {
  const towerContext =
    TOWER_CONTEXT[towerId] ?? "Versant tower (context not authored).";
  const digestBlock =
    towerIntakeDigest && towerIntakeDigest.trim().length > 0
      ? [
          "",
          "===========================================================================",
          "TOWER LEAD QUESTIONNAIRE (Forge Tower AI Readiness Intake)",
          "===========================================================================",
          "When the following conflicts with the generic tower paragraph above, the questionnaire WINS for this tower's systems, tools, experiments, data, constraints, instincts, quick wins, and explicit no-go zones.",
          "Authority order: questionnaire facts > per-row user feedback > generic tower paragraph. Per-row feedback still CANNOT override the vendor allow-list or the five canonical not-eligible reasons.",
          "",
          towerIntakeDigest.trim(),
        ].join("\n")
      : "";
  return [
    "You curate Versant Media Group L5 Activities (the leaf rung under each L4 Activity Group on the 5-layer capability map) for an AI initiatives agenda. Every output must be Versant-specific and declarative — never generic.",
    "",
    "Capability map shape (top-down, 5 layers):",
    "  L1 Function (e.g. Finance) > L2 Job Grouping > L3 Job Family > L4 Activity Group > L5 Activity",
    "Each input row gives you the parent context (Job Grouping → Job Family → Activity Group) and the L5 Activities sitting directly under that Activity Group. You score the L5 Activities — never the parents.",
    "",
    "Versant Media Group (NASDAQ: VSNT) is the spin-off of NBCUniversal's news, sports, streaming, digital portfolio: MS NOW, CNBC, Golf Channel, GolfNow, GolfPass, USA Network, E!, Syfy, Oxygen True Crime, Fandango, Rotten Tomatoes, SportsEngine, Free TV Networks. ~$6.7B revenue, ~$2.4B Adj. EBITDA, ~$2.75B debt (BB-), running on NBCU shared services until the TSA expires.",
    "",
    "For each L5 Activity, return a verdict (Stage 2) plus a short curation summary (Stage 3). Eligible items get a binary feasibility + frequency + criticality + maturity + primaryVendor + agentOneLine. Not-eligible items skip the curation fields and instead return one of the FIVE canonical reasons.",
    "",
    `Tower currently being scored: ${towerId} — ${towerContext}`,
    "",
    "ELIGIBILITY rule (the binary field `aiEligible`):",
    "  Default `aiEligible = true` for any L5 Activity that is processing, matching, reconciling, drafting, tagging, transcribing, summarising, monitoring, anomaly-detection, classification, extraction, routing, scheduling, dispatching, forecasting, validation, compliance-check, ingestion, normalisation, or any rules-based / pattern-driven operation — even when it sits inside a parent bucket whose NAME contains a not-eligible keyword (e.g. an `Account Reconciliation` L5 inside a `Treasury & Capital` L3 is still eligible — the activity itself is rules-based).",
    "",
    "  Mark `aiEligible = false` ONLY when the SPECIFIC L5 Activity itself is one of the four patterns below. Do NOT exclude an L5 just because its parent L4/L3 name brushes past one of these words.",
    "",
    "  Calibration check before you finalise: across a tower's ~30-80 L5 Activities you should typically land 50%-80% eligible. If your draft has <30% eligible, re-read — you're treating parent-bucket names as exclusion signals, which is wrong. Score each L5 Activity on its OWN merits.",
    "",
    "FEASIBILITY rule (the binary field `feasibility`, only set when aiEligible = true):",
    "  feasibility = 'High' when ALL three signals hold:",
    "    (1) The activity is rules-based or pattern-driven (not requiring net-new editorial / negotiation / executive judgment on EACH instance),",
    "    (2) A named vendor on the allow-list (BlackLine, Eightfold, Workday, ServiceNow, Amagi, Piano, LiveRamp, Deepgram, Descript, etc.) ALREADY supports this work or directly applies,",
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
    "Versant rationale guidance — be Versant-specific, concrete, declarative. NAME REAL BRANDS (MS NOW / CNBC / Golf Channel / GolfNow / GolfPass / USA Network / E! / Syfy / Fandango / Rotten Tomatoes / SportsEngine), the TSA carve-out, BB- credit, multi-entity JV, split rights, MS NOW progressive positioning. NEVER use hedge phrases ('potentially', 'could possibly', 'may help to', 'leverage AI'). NEVER write rationales that could apply to any media company.",
    "",
    "primaryVendor MUST be chosen from this allow-list (case-sensitive). For compound stacks, separate with ' + '. If no allow-list vendor fits, RETURN THE EXACT STRING 'TBD — subject to discovery' (em dash) — never invent a vendor.",
    "Allow-list:",
    VENDOR_ALLOW_LIST.map((v) => `  - ${v}`).join("\n"),
    "",
    "agentOneLine MUST describe what the agent does + the concrete saving. Example: 'Reconciliation Agent matches intercompany transactions across 7+ Versant entities, auto-resolves timing diffs, flags exceptions for human review.' Never write 'leverages AI' or 'transforms the workflow'.",
    "",
    "When per-row user feedback is provided, you MAY use it to shift feasibility / rationale / vendor selections — but feedback CANNOT bypass the canonical not-eligible reasons (the five strings above), the vendor allow-list, or the rule that editorial / negotiation / strategic-judgment activities stay reviewed-not-eligible. When a tower questionnaire block appears above, it ranks above per-row feedback for tower-specific facts; if feedback contradicts those constraints, ignore the contradicting part of the feedback and stay grounded.",
    "",
    "Return STRICT JSON ONLY in this exact shape, with one outer item per input row, in INPUT ORDER, and one inner item per L5 Activity in EACH ROW'S INPUT ORDER:",
    '{"rows": [{"rowId": "<echo input rowId>", "l5Items": [',
    '  {',
    '    "name": "<echo L5 Activity name verbatim>",',
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
    "Use null for any field that doesn't apply (e.g., feasibility on a not-eligible item). Eligible items MUST set feasibility + aiRationale + frequency + criticality + currentMaturity + primaryVendor + agentOneLine. Not-eligible items MUST set notEligibleReason and aiRationale, leave the rest null.",
    "",
    "Do NOT skip rows. Do NOT add extra rows or extra L5 items. Echo `name` and `rowId` verbatim. Do NOT add prose outside the JSON object.",
  ].join("\n") + digestBlock;
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
    r.l5Activities.forEach((name, ai) => {
      lines.push(`  L5 Activity ${ai + 1}. ${truncate(name, 200)}`);
    });
    lines.push("");
  });
  return [
    `Curate every L5 Activity below in the context of its parent L4 Activity Group. Echo \`rowId\` and \`name\` verbatim. Preserve order.`,
    "",
    ...lines,
  ].join("\n");
}

function truncate(s: string, max = 160): string {
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

const VENDOR_ALLOW_LOWER = new Set(VENDOR_ALLOW_LIST.map((v) => v.toLowerCase()));

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
 * Calls OpenAI to curate every L5 Activity across every row in a single
 * batched request. Throws an `LLMError` on any failure — caller owns the
 * deterministic fallback contract.
 */
export async function curateInitiativesWithLLM(
  towerId: TowerId,
  rows: CurateLLMRowInput[],
  options: CurateLLMOptions = {},
): Promise<CurateLLMRow[]> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new LLMError("OPENAI_API_KEY not set");
  }
  if (!rows.length) return [];
  const totalL5s = rows.reduce((s, r) => s + r.l5Activities.length, 0);
  if (totalL5s === 0) return rows.map((r) => ({ rowId: r.rowId, l5Items: [] }));
  if (totalL5s > MAX_L5S_PER_CALL) {
    throw new LLMError(
      `Tower has ${totalL5s} L5 Activities; max ${MAX_L5S_PER_CALL} per call.`,
    );
  }

  const model =
    options.model ??
    process.env.OPENAI_CURATE_INITIATIVES_MODEL?.trim() ??
    process.env.OPENAI_MODEL?.trim() ??
    DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const towerIntakeDigest = options.towerIntakeDigest?.trim()
    ? options.towerIntakeDigest.trim().slice(0, TOWER_READINESS_MAX_DIGEST_CHARS)
    : undefined;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemPrompt(towerId, towerIntakeDigest) },
          { role: "user", content: buildUserPrompt(rows) },
        ],
      }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if ((e as { name?: string })?.name === "AbortError") {
      throw new LLMError(`OpenAI call timed out after ${timeoutMs}ms`, e);
    }
    throw new LLMError("OpenAI network error", e);
  }
  clearTimeout(timer);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new LLMError(
      `OpenAI ${res.status}: ${text.slice(0, 400) || res.statusText}`,
    );
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch (e) {
    throw new LLMError("OpenAI returned non-JSON body", e);
  }
  const content = (body as {
    choices?: { message?: { content?: string } }[];
  })?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new LLMError("OpenAI returned empty content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new LLMError("OpenAI content was not valid JSON", e);
  }
  const llmRows = (parsed as { rows?: unknown[] })?.rows;
  if (!Array.isArray(llmRows)) {
    throw new LLMError("OpenAI JSON missing `rows` array");
  }
  if (llmRows.length !== rows.length) {
    throw new LLMError(
      `OpenAI returned ${llmRows.length} rows for ${rows.length} input rows`,
    );
  }

  return rows.map((input, ri) => {
    const llmRow = (llmRows[ri] ?? {}) as Record<string, unknown>;
    // Accept both the new `l5Items` key and the legacy `l4Items` key so a
    // model that hasn't fully transitioned to the new prompt vocabulary
    // still parses cleanly. Prefer the new key.
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
    const l5Items: CurateLLMItem[] = input.l5Activities.map((expectedName, ai) => {
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
    return { rowId: input.rowId, l5Items };
  });
}
