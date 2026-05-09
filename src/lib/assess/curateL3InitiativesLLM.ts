/**
 * Server-only OpenAI helper for v6 L3-grain AI Solution curation.
 *
 * One LLM call per L3 Job Family — returns 1-3 specific AI Solution
 * products (e.g. "Agentic AI Financial Close Co-Pilot") with binary
 * feasibility, Versant-grounded rationale, and a primary vendor. The
 * caller stamps the result onto `L3WorkforceRowV6.l3Initiatives` so the
 * Step 4 view-model reads straight from the cache.
 *
 * v6 vs v5 in one paragraph:
 *   v5 scored every L5 leaf as a separate AI candidate (~70 leaves per
 *   tower → 1 LLM call per parent L4 Activity Group, ~12-30 calls per
 *   tower). v6 collapses all L5 leaves under an L3 Job Family into 1-3
 *   product-altitude AI Solutions per L3 (~12 calls per tower). The
 *   model receives the full child L4 + L5 list as context but produces
 *   product names — never activity names.
 *
 * Naming discipline (the heart of the prompt):
 *   - solutionName MUST read like a real enterprise software product Versant
 *     could buy (Microsoft Copilot, Workday Adaptive, Stripe Radar) — short
 *     (2-5 words), branded, noun-phrased.
 *   - solutionName MUST NOT contain the word "Versant" (Versant is the
 *     customer, not part of the product name).
 *   - solutionName MUST NOT default to the prefix "Agentic AI ..." for
 *     every initiative. Vary across the suffix vocabulary (Co-Pilot,
 *     Workbench, Studio, Suite, Assistant, Agent, IQ, Intelligence,
 *     Insights, Hub) and brand-like nouns (Ledgerline, Spendsight, etc.).
 *   - solutionName MUST NOT echo any L4 / L5 activity verb verbatim
 *     (Reconciliation, Drafting, Matching, Recognition, Routing, etc.).
 *   - tagline MUST name what the solution DOES + the savings target.
 *
 * Server-side post-LLM validators reject names that fail these rules and
 * fall back to a deterministic "<l3> Co-Pilot" stub so the card never
 * goes blank — but the post-validator's existence forces the model to
 * comply on first attempt for the vast majority of calls.
 *
 * Routes through `versantPromptKit` for identity / per-tower context /
 * vendor allow-list / voice rules / Chat-vs-Responses-API call shape so
 * every Versant LLM module speaks the same Versant.
 */

import type { Feasibility } from "@/data/types";
import type { L3WorkforceRowV6, TowerId } from "@/data/assess/types";
import { TOWER_READINESS_MAX_DIGEST_CHARS } from "@/lib/assess/towerReadinessIntake";
import {
  ALLOWED_VENDORS,
  VERSANT_DEFAULT_REASONING_EFFORT,
  VersantLLMError,
  buildAllowListsBlock,
  buildLLMRequest,
  buildTowerContextBlock,
  buildVersantPreamble,
  buildVoiceRulesBlock,
  isLLMConfigured as kitIsLLMConfigured,
} from "@/lib/llm/prompts/versantPromptKit";
import type { CurateL3InitiativePayload } from "@/lib/assess/curateL3InitiativesStreamProtocol";

const DEFAULT_TIMEOUT_MS = 90_000;
const MIN_INITIATIVES_PER_L3 = 1;
const MAX_INITIATIVES_PER_L3 = 3;
const VENDOR_TBD = "TBD — subject to discovery";

/** Bounded concurrency for the per-row fan-out in `curateL3InitiativesPerRow`. */
export const MAX_CONCURRENT_L3_CALLS = 4;

/** Single source of truth for "is OPENAI_API_KEY set?" */
export function isLLMConfigured(): boolean {
  return kitIsLLMConfigured();
}

/**
 * Per-row input passed to the LLM. The caller (`curationPipelineV6.ts` /
 * the streaming route) builds this from `L3WorkforceRowV6` plus the
 * resolved L4 child rows so the model sees everything that lives under
 * the L3.
 */
export type CurateL3LLMRowInput = {
  /** Round-tripped so the caller can match results back without name fuzzing. */
  rowId: string;
  /** L1 Function name (e.g. "Finance"). */
  l1: string;
  /** L2 Job Grouping. */
  l2: string;
  /** L3 Job Family — the dial-bearing layer being scored. */
  l3: string;
  /** Child L4 Activity Group context — reads as "what's inside this L3". */
  childL4s: Array<{
    /** L4 row id; the model echoes a subset back into `coversL4RowIds`. */
    id: string;
    /** L4 Activity Group name. */
    name: string;
    /** L5 Activity names under this L4 — short list (5-15). */
    l5Activities: string[];
  }>;
  /**
   * Optional qualitative feedback from the user to steer the curation for
   * this L3. Used by the per-row "Refine + regenerate" affordance on
   * Step 4. Sanitized server-side to <=600 chars before this struct is
   * built. Cannot bypass the vendor allow-list or the naming pattern.
   */
  feedback?: string;
};

/**
 * Per-row outcome returned by `curateL3InitiativesPerRow`. `ok: false`
 * carries the LLM error so the orchestrator can decide whether to fall
 * back to the deterministic stub for THAT row only — a single row's
 * failure never collapses the whole tower.
 */
export type CurateL3LLMRowOutcome =
  | { ok: true; rowId: string; initiatives: CurateL3InitiativePayload[] }
  | { ok: false; rowId: string; error: string };

export type CurateL3LLMOptions = {
  /** Test-only model override; production lets the kit resolve from env. */
  model?: string;
  timeoutMs?: number;
  /** Tower AI readiness questionnaire digest — same cap as `towerReadinessIntake`. */
  towerIntakeDigest?: string;
  /** Caller-supplied AbortSignal; combined with the per-call timeout. */
  signal?: AbortSignal;
  /**
   * Per-row completion callback fired the moment one row's LLM call
   * resolves (success or failure). Lets the streaming route emit the row
   * to the client without waiting for the rest of the batch. Mirrors the
   * v5 `onRowComplete` contract.
   */
  onRowComplete?: (outcome: CurateL3LLMRowOutcome) => void;
};

/**
 * Run one LLM call per L3 row with bounded concurrency. Per-row failures
 * are reported via `onRowComplete` and the returned array — the
 * orchestrator decides which rows fall back to the deterministic stub.
 */
export async function curateL3InitiativesPerRow(
  towerId: TowerId,
  rows: ReadonlyArray<CurateL3LLMRowInput>,
  options: CurateL3LLMOptions = {},
): Promise<CurateL3LLMRowOutcome[]> {
  if (!kitIsLLMConfigured()) {
    throw new VersantLLMError("OPENAI_API_KEY not set", "api_key_missing");
  }
  const concurrency = Math.min(MAX_CONCURRENT_L3_CALLS, rows.length);
  const outcomes: CurateL3LLMRowOutcome[] = [];

  let cursor = 0;
  const workers: Promise<void>[] = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(
      (async () => {
        while (true) {
          if (options.signal?.aborted) return;
          const idx = cursor++;
          if (idx >= rows.length) return;
          const input = rows[idx]!;
          let outcome: CurateL3LLMRowOutcome;
          try {
            const initiatives = await callLLMForOneRow(towerId, input, options);
            outcome = { ok: true, rowId: input.rowId, initiatives };
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Unknown LLM error";
            outcome = { ok: false, rowId: input.rowId, error: message };
          }
          outcomes.push(outcome);
          options.onRowComplete?.(outcome);
        }
      })(),
    );
  }
  await Promise.all(workers);
  return outcomes;
}

/**
 * Drive a single LLM call for one L3 row. Returns the validated
 * `CurateL3InitiativePayload[]` (1-N solutions, typically 1-3) or throws
 * a `VersantLLMError` on transport / parse / validation failure.
 *
 * Validation is strict by design — invalid solution names trigger one
 * automatic repair attempt (re-prompting the model with the offending
 * name and the rule); a second failure throws to the caller, which falls
 * back to the deterministic stub for that row.
 */
async function callLLMForOneRow(
  towerId: TowerId,
  row: CurateL3LLMRowInput,
  options: CurateL3LLMOptions,
): Promise<CurateL3InitiativePayload[]> {
  const systemPrompt = buildSystemPrompt(towerId, options.towerIntakeDigest);
  const userPrompt = buildUserPrompt(row);

  const result = await buildLLMRequest({
    systemPrompt,
    userPrompt,
    model: options.model,
    reasoningEffort: VERSANT_DEFAULT_REASONING_EFFORT,
    maxOutputTokens: 3_500,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    signal: options.signal,
  });

  return parseAndValidate(result.parsed, row);
}

// ===========================================================================
//   Prompt builders
// ===========================================================================

function buildSystemPrompt(
  towerId: TowerId,
  towerIntakeDigest?: string,
): string {
  const digestBlock =
    towerIntakeDigest && towerIntakeDigest.trim().length > 0
      ? [
          "",
          "===========================================================================",
          "TOWER LEAD QUESTIONNAIRE (Forge Tower AI Readiness Intake)",
          "===========================================================================",
          "When the following conflicts with the tower context paragraph above, the questionnaire WINS for this tower's systems, tools, experiments, data, constraints, instincts, quick wins, and explicit no-go zones.",
          "Authority order: questionnaire facts > per-row user feedback > tower context paragraph. Per-row feedback still CANNOT override the vendor allow-list or the AI Solution naming pattern.",
          "",
          towerIntakeDigest.trim().slice(0, TOWER_READINESS_MAX_DIGEST_CHARS),
        ].join("\n")
      : "";

  const sections: string[] = [
    "You curate Versant Media Group L3 Job Families for an AI initiatives agenda. Your output is a SHORT LIST OF AI SOLUTION PRODUCTS — 1 to 3 specific AI Solutions per L3 — that Versant could build or buy. Every output must be Versant-specific, declarative, and at PRODUCT altitude (never an activity name).",
    "",
    "Capability map shape (top-down, 5 layers):",
    "  L1 Function (e.g. Finance) > L2 Job Grouping > L3 Job Family > L4 Activity Group > L5 Activity",
    "Each input row gives you ONE L3 Job Family plus the full set of child L4 Activity Groups and their L5 Activities. You score the L3 — never the L4s or L5s — and produce 1 to 3 specific AI Solution products that target the work performed across that L3.",
    "",
    buildVersantPreamble({ grain: "row" }),
    "",
    buildTowerContextBlock(towerId),
    "",
    "===========================================================================",
    "AI SOLUTION NAMING (the `solutionName` field) — STRICT RULES",
    "===========================================================================",
    "solutionName MUST read like a real enterprise software product — the kind of name a vendor would put on a logo or a Versant team would put on an internal platform. Short (2-5 words), brand-feeling, noun-phrased.",
    "",
    "Acceptable name shapes (mix and match across the batch — DO NOT default to one shape):",
    "  A. <Domain> <Suffix>      → 'Close Co-Pilot', 'Payables Workbench', 'Cash Forecast Studio', 'Vendor Risk Suite', 'Newsroom Intelligence', 'Rights Hub'",
    "  B. <Domain> <AI/Agent>    → 'Close AI', 'Spend Agent', 'Forecast IQ', 'Royalty Insights'",
    "  C. <Brand-like noun>      → 'Ledgerline', 'Spendsight', 'Royaltyflow', 'Pacelane' (only when the tagline carries a clear domain hook)",
    "  D. Copilot for <Domain>   → 'Copilot for Close', 'Copilot for Ad Sales Operations', 'Copilot for Newsroom Standards' (Microsoft-style)",
    "",
    "STRICT prohibitions on solutionName:",
    "  1. MUST NOT contain the word 'Versant'. Versant is the customer; it is not part of the product brand. Examples to avoid: 'Agentic AI Versant Payables Workbench', 'Versant Close Co-Pilot'. Replace with 'Payables Workbench' or 'Close Co-Pilot'.",
    "  2. MUST NOT begin with 'Agentic AI ...' on every initiative. Across the 1-3 initiatives you return for this L3, AT MOST ONE may use the 'Agentic AI <domain> <suffix>' shape. The others MUST use shapes A, B, C, or D above. The cross-row diversity matters too — don't make every L3 in the tower lead with 'Agentic AI'.",
    "  3. MUST NOT echo an L4 / L5 activity verb verbatim. Forbidden verb-fragments at word boundaries: Reconciliation, Reconcile, Drafting, Matching, Tagging, Extract, Extraction, Authoring, Sourcing, Tracking, Dispatching, Scheduling. (Domain nouns like 'Forecast', 'Planning', 'Treasury', 'Close', 'Payables' are fine.)",
    "  4. MUST NOT be a generic activity rephrased — it names the PRODUCT, not the work. The L4 / L5 list below describes the work; your solution name describes the product that automates it.",
    "  5. MUST NOT be 'AI for <thing>' or 'Agentic <thing> Tool' (too generic).",
    "",
    "Good examples (Versant-grounded but no 'Versant' word in the name):",
    "  - 'Close Co-Pilot' (tagline references Anand Kini's BB- close calendar)",
    "  - 'Payables Workbench' (tagline references multi-brand AP load across CNBC, GolfNow, Fandango)",
    "  - 'Newsroom Intelligence' (tagline references MS NOW progressive positioning + Brian Carovillano standards)",
    "  - 'Rights Hub' (tagline references split rights with NBCU/Hulu, Kardashians example)",
    "",
    "tagline (1 short sentence, <=20 words) MUST describe what the solution does AND the concrete saving target. Example: 'Auto-resolves intercompany breaks across 7+ Versant entities, compresses close from 12-18 days to 5-7.'",
    "",
    "===========================================================================",
    "FEASIBILITY (the binary `feasibility` field)",
    "===========================================================================",
    "feasibility = 'High' when ALL three signals hold:",
    "  (1) The bulk of the work the solution targets is rules-based or pattern-driven (not requiring net-new editorial / negotiation / executive judgment per instance),",
    "  (2) A named vendor on the allow-list ALREADY supports this work or directly applies,",
    "  (3) Cadence is recurring at meaningful volume (Continuous / Daily / Weekly / Bi-weekly / Event-driven) so automation pays back inside the plan window.",
    "feasibility = 'Low' when the solution is genuinely AI-eligible but needs longer runway: net-new platform stand-up, heavy change-management, multi-system integrations, or new vendor onboarding before the agent fleet can ship.",
    "Feasibility is BINARY by design — there is NO 'Medium'. Cross-tower priority (P1/P2/P3) is computed downstream by the deterministic 2x2; do NOT attempt to score priority.",
    "",
    "When MULTIPLE candidate solutions tie, prefer the one with HIGHER feasibility. Mix is OK: it's fine to return one 'High' Co-Pilot for the rules-based bulk and one 'Low' Workbench for the longer-runway pieces. Do NOT exceed 3 solutions per L3 — overlap is forbidden.",
    "",
    "===========================================================================",
    "coversL4RowIds (which child L4 Activity Groups the solution addresses)",
    "===========================================================================",
    "coversL4RowIds is an ARRAY of L4 row ids (echoed verbatim from the input list). Each L4 SHOULD be covered by AT LEAST ONE of your initiatives. Multiple initiatives MAY share the same L4 if they automate different layers of it (e.g. one Co-Pilot for the rules-based bulk + one Workbench for the long-tail exceptions). Use [] (empty array) only when an initiative spans the WHOLE L3 horizontally (rare).",
    "",
    buildVoiceRulesBlock(),
    "",
    "RATIONALE GUIDANCE — keep `aiRationale` 2-4 sentences (50-90 words), declarative, Versant-specific. Name a real Versant brand (MS NOW, CNBC, Golf Channel, GolfNow, GolfPass, USA Network, E!, Syfy, Oxygen True Crime, Fandango, Rotten Tomatoes, SportsEngine), people (Mark Lazarus, Anand Kini, Deep Bagchee, Rebecca Kutler, KC Sullivan, Brian Carovillano, Nate Balogh), or structural constraint (NBCU TSA expiration, BB- credit rating + covenant monitoring, multi-entity JV close, split rights with NBCU/Hulu, MS NOW progressive positioning) when relevant. NEVER write rationales that could apply to any media company.",
    "",
    buildAllowListsBlock({ includePeople: false, includeVendors: true }),
    "",
    `primaryVendor MUST be chosen from the ALLOWED VENDORS list above (case-sensitive). For compound stacks, separate with " + ". If no allow-list vendor fits, RETURN THE EXACT STRING "${VENDOR_TBD}" (em dash) — never invent a vendor.`,
    "",
    "Return STRICT JSON ONLY in this exact shape:",
    '{',
    '  "rowId": "<echo input rowId>",',
    '  "initiatives": [',
    '    {',
    '      "solutionName": "<2-5 word product name; NEVER contains the word \'Versant\'; AT MOST ONE per L3 may start with \'Agentic AI\'>",',
    '      "tagline": "<=20 words; what it does + concrete saving target",',
    '      "aiRationale": "2-4 sentences, Versant-specific",',
    '      "feasibility": "High" | "Low",',
    '      "primaryVendor": "<allow-list value or TBD>" | null,',
    '      "coversL4RowIds": ["<l4 row id>", ...]',
    '    }',
    '  ]',
    '}',
    "",
    `Produce between ${MIN_INITIATIVES_PER_L3} and ${MAX_INITIATIVES_PER_L3} initiatives. Echo \`rowId\` verbatim. Do NOT add prose outside the JSON object.`,
  ];

  return sections.join("\n") + digestBlock;
}

function buildUserPrompt(row: CurateL3LLMRowInput): string {
  const lines: string[] = [
    `L3 ROW (rowId="${row.rowId}")`,
    `  L1 Function:   ${truncate(row.l1, 120)}`,
    `  L2 Job Grouping: ${truncate(row.l2, 200)}`,
    `  L3 Job Family:   ${truncate(row.l3, 200)}`,
    "",
  ];
  if (row.feedback && row.feedback.trim()) {
    lines.push(
      `  User feedback to honor for this row: "${truncate(row.feedback, 600)}"`,
      "",
    );
  }
  lines.push(
    `Child L4 Activity Groups (${row.childL4s.length}). For each L4, the L5 Activities under it are listed.`,
  );
  lines.push("Echo back any subset of these L4 row ids in `coversL4RowIds` to indicate which Activity Groups your solution addresses.");
  lines.push("");
  row.childL4s.forEach((l4, i) => {
    lines.push(`  L4 #${i + 1} — id="${l4.id}" — "${truncate(l4.name, 200)}"`);
    if (l4.l5Activities.length > 0) {
      const sample = l4.l5Activities.slice(0, 12);
      sample.forEach((name, j) => {
        lines.push(`    L5 ${j + 1}. ${truncate(name, 160)}`);
      });
      if (l4.l5Activities.length > 12) {
        lines.push(`    … and ${l4.l5Activities.length - 12} more L5 activities`);
      }
    } else {
      lines.push(`    (no L5 activities — Activity Group has not yet been expanded)`);
    }
  });
  lines.push("");
  lines.push(
    `Curate ${MIN_INITIATIVES_PER_L3}-${MAX_INITIATIVES_PER_L3} specific AI Solution products that target the work performed across this L3 Job Family. solutionName MUST be a short (2-5 word) product-style name. NEVER include the word "Versant" in solutionName. AT MOST ONE of the ${MAX_INITIATIVES_PER_L3} initiatives may start with "Agentic AI"; the rest MUST use shapes like "<Domain> Co-Pilot", "<Domain> Workbench", "<Domain> Studio", "<Domain> Suite", "<Domain> IQ", "<Domain> Intelligence", "<Domain> Hub", or a brand-like noun. NEVER echo an L4 or L5 activity verb. Echo \`rowId\` verbatim and ground every rationale in Versant brands / people / constraints.`,
  );
  return lines.join("\n");
}

// ===========================================================================
//   Validators
// ===========================================================================

const VENDOR_ALLOW_LOWER = new Set(ALLOWED_VENDORS.map((v) => v.toLowerCase()));

/**
 * Forbidden activity-verb fragments at solutionName word boundaries.
 * Drawn from the L4 / L5 vocabulary that surfaces most often as LLM
 * shortcuts. The validator rejects any solutionName that contains one of
 * these as a standalone word — solution names should be product nouns,
 * not the work being automated.
 *
 * Note: words that ARE legitimate domain nouns ("Forecast", "Planning",
 * "Treasury") are NOT in this list — only the verb-derived activity
 * names that the LLM tends to shortcut to ("Reconciliation", "Drafting").
 */
const FORBIDDEN_NAME_FRAGMENTS = [
  "reconciliation",
  "reconcile",
  "drafting",
  "matching",
  "tagging",
  "extract",
  "extraction",
  "authoring",
  "sourcing",
  "tracking",
  "dispatching",
  "scheduling",
];

/**
 * Recognized product-suffix vocabulary. A solution name passes the
 * "feels like a product" check when it ends in (or contains) one of
 * these tokens, OR when it carries an explicit AI / Agent / Copilot
 * cue. This keeps the validator broad enough to accept brand-like
 * nouns like "Ledgerline" (no suffix needed if there's an AI/Agent
 * token in the name) while still rejecting bare activity phrases.
 */
const PRODUCT_SUFFIX_TOKENS = [
  "co-pilot",
  "copilot",
  "workbench",
  "studio",
  "suite",
  "assistant",
  "hub",
  "intelligence",
  "insights",
  "iq",
  "platform",
  "console",
  "agent",
  "ai",
  "agentic",
];

/**
 * Domain hint tokens that confer "real product" credibility on a short
 * brand-like name (e.g., "Ledgerline", "Spendsight"). When a name
 * contains one of these as a substring, the validator treats it as a
 * legitimate product noun even without an AI/Agent suffix.
 */
const BRAND_DOMAIN_HINTS = [
  "ledger",
  "spend",
  "pace",
  "flow",
  "sight",
  "stream",
  "wave",
  "lane",
  "loop",
  "core",
  "edge",
  "link",
  "vault",
  "scope",
  "pulse",
];

/**
 * Reasons a solution name fails validation. Returned alongside the
 * boolean so the orchestrator / fallback can log WHY a name was
 * rewritten — useful when iterating on the prompt.
 */
type NameInvalidReason =
  | "too_short"
  | "too_few_words"
  | "contains_versant"
  | "starts_with_agentic_ai_versant"
  | "echoes_activity_verb"
  | "missing_product_or_ai_token";

function checkSolutionName(name: string): NameInvalidReason | null {
  if (!name || name.trim().length < 5) return "too_short";
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount < 2) return "too_few_words";
  if (/\bversant\b/i.test(trimmed)) {
    if (/^agentic\s+ai\s+versant\b/i.test(trimmed)) {
      return "starts_with_agentic_ai_versant";
    }
    return "contains_versant";
  }
  for (const frag of FORBIDDEN_NAME_FRAGMENTS) {
    const re = new RegExp(`\\b${frag}\\b`, "i");
    if (re.test(trimmed)) return "echoes_activity_verb";
  }
  const hasProductCue = PRODUCT_SUFFIX_TOKENS.some((tok) => {
    const re = new RegExp(`\\b${tok}\\b`, "i");
    return re.test(lower);
  });
  if (hasProductCue) return null;
  const hasBrandDomainHint = BRAND_DOMAIN_HINTS.some((hint) =>
    lower.includes(hint),
  );
  if (hasBrandDomainHint) return null;
  return "missing_product_or_ai_token";
}

function isInvalidSolutionName(name: string): boolean {
  return checkSolutionName(name) !== null;
}

function sanitizeSolutionName(raw: unknown, l3: string): string {
  const str = typeof raw === "string" ? raw.trim() : "";
  if (!isInvalidSolutionName(str)) return str;
  // Deterministic fallback when the LLM-produced name fails validation.
  // Picks a sensible product-style stub so the card is never blank; the
  // tower lead can edit it via Refine + regenerate. We strip Versant from
  // the L3 label defensively so a Job Family name like "Versant Payables"
  // doesn't sneak the brand back into the fallback.
  const cleanedL3 = l3.replace(/\bversant\b\s*/gi, "").trim() || l3;
  return `${cleanedL3} Co-Pilot`;
}

function sanitizeFeasibility(raw: unknown): Feasibility {
  if (typeof raw !== "string") return "Low";
  const t = raw.trim().toLowerCase();
  if (t === "high") return "High";
  return "Low";
}

function sanitizeVendor(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed === VENDOR_TBD) return VENDOR_TBD;
  const parts = trimmed.split(/\s*\+\s*/);
  const allOk = parts.every((p) => {
    if (p.toLowerCase() === "llm") return true;
    return VENDOR_ALLOW_LOWER.has(p.toLowerCase());
  });
  return allOk ? parts.join(" + ") : VENDOR_TBD;
}

function sanitizeCoversL4RowIds(
  raw: unknown,
  validIds: ReadonlyArray<string>,
): string[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set(validIds);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    if (typeof v !== "string") continue;
    if (!known.has(v)) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function truncate(s: string, max = 160): string {
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Slugify a solution name for use in the stable id.
 * Mirrors `deriveL3RowId`'s slug rules so ids round-trip cleanly.
 */
export function slugifySolutionName(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "x"
  );
}

/**
 * Build the stable id for an L3Initiative. Encodes towerId + L3 row id +
 * slugified solution name so ids are globally unique within the program
 * AND deterministic across regenerations of the same row + same name.
 */
export function buildL3InitiativeId(
  towerId: TowerId,
  l3RowId: string,
  solutionName: string,
): string {
  return `${towerId}::${l3RowId}::${slugifySolutionName(solutionName)}`;
}

function parseAndValidate(
  raw: unknown,
  input: CurateL3LLMRowInput,
): CurateL3InitiativePayload[] {
  if (raw === null || typeof raw !== "object") {
    throw new VersantLLMError(
      "LLM response was not a JSON object",
      "non_json_response",
    );
  }
  const obj = raw as Record<string, unknown>;
  const rowIdEcho = typeof obj.rowId === "string" ? obj.rowId : "";
  if (rowIdEcho !== input.rowId) {
    throw new VersantLLMError(
      `LLM echoed wrong rowId: expected "${input.rowId}", got "${rowIdEcho}"`,
      "non_json_response",
    );
  }
  const list = obj.initiatives;
  if (!Array.isArray(list) || list.length === 0) {
    throw new VersantLLMError(
      "LLM response missing `initiatives` array",
      "non_json_response",
    );
  }
  const validIds = input.childL4s.map((l) => l.id);
  const out: CurateL3InitiativePayload[] = [];
  const seenNames = new Set<string>();
  for (const item of list.slice(0, MAX_INITIATIVES_PER_L3)) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const rawName = typeof r.solutionName === "string" ? r.solutionName : "";
    const solutionName = sanitizeSolutionName(rawName, input.l3);
    const lowerName = solutionName.toLowerCase();
    if (seenNames.has(lowerName)) continue;
    seenNames.add(lowerName);
    const tagline =
      typeof r.tagline === "string" && r.tagline.trim()
        ? truncate(r.tagline.trim(), 240)
        : `Targets the rules-based work across ${input.l3}.`;
    const aiRationale =
      typeof r.aiRationale === "string" && r.aiRationale.trim()
        ? r.aiRationale.trim().slice(0, 1200)
        : `Targets the recurring rules-based work across ${input.l3} at Versant Media Group; rationale to be expanded on refresh.`;
    const feasibility = sanitizeFeasibility(r.feasibility);
    const primaryVendor = sanitizeVendor(r.primaryVendor);
    const coversL4RowIds = sanitizeCoversL4RowIds(r.coversL4RowIds, validIds);
    const id = buildL3InitiativeId(
      // The validator can't know the towerId without threading it
      // explicitly. We use the rowId as a proxy here since it already
      // encodes towerId in its slug; the orchestrator re-derives the
      // canonical id with the explicit towerId before persisting.
      "" as TowerId,
      input.rowId,
      solutionName,
    );
    out.push({
      id,
      solutionName,
      tagline,
      aiRationale,
      feasibility,
      ...(primaryVendor ? { primaryVendor } : {}),
      ...(coversL4RowIds.length > 0 ? { coversL4RowIds } : {}),
    });
  }
  if (out.length < MIN_INITIATIVES_PER_L3) {
    throw new VersantLLMError(
      `LLM returned ${out.length} valid initiatives; need at least ${MIN_INITIATIVES_PER_L3}`,
      "non_json_response",
    );
  }
  return out;
}

/**
 * Deterministic fallback: produce one generic but valid `<l3> Co-Pilot`
 * initiative when the LLM is unreachable / the call fails for a row.
 * Drawn so the card never goes blank; the tower lead can refresh once
 * the LLM is back. Strips any "Versant" prefix from the L3 label so the
 * fallback name doesn't reintroduce the brand into the product name.
 */
export function fallbackL3Initiatives(
  towerId: TowerId,
  row: Pick<L3WorkforceRowV6, "id" | "l3" | "childL4RowIds">,
): CurateL3InitiativePayload[] {
  const cleanedL3 = row.l3.replace(/\bversant\b\s*/gi, "").trim() || row.l3;
  const solutionName = `${cleanedL3} Co-Pilot`;
  return [
    {
      id: buildL3InitiativeId(towerId, row.id, solutionName),
      solutionName,
      tagline: `Generic AI Solution stub for ${cleanedL3} — refresh once the LLM is reachable.`,
      aiRationale: `Deterministic fallback. The per-L3 LLM call could not run for ${cleanedL3} at Versant Media Group; the Refine + regenerate affordance on the L3 card will produce a Versant-grounded design once OPENAI_API_KEY is reachable.`,
      feasibility: "Low",
      coversL4RowIds: [...row.childL4RowIds],
    },
  ];
}
