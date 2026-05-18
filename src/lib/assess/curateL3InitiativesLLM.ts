/**
 * Server-only OpenAI helper for v6 L3-grain AI Solution curation.
 *
 * One LLM call per L3 Job Family — returns 1-3 specific AI Solution
 * products (e.g. "Intercompany Close Reconciliation Co-Pilot") with
 * binary feasibility, Versant-grounded rationale, primary vendor, and a
 * representative icon picked from the curated Lucide allowlist. The
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
 *   - solutionName MUST be SELF-EXPLANATORY: 5-10 words, descriptive,
 *     leading with the user-visible action / object the solution acts
 *     on. A workshop attendee should grok what it does without reading
 *     the tagline.
 *   - solutionName MUST use the L3 Job Family's own domain-native
 *     vocabulary — recruiting / sourcing / onboarding for HR;
 *     clearance / windowing / royalty for Rights; pacing / yield for
 *     Ad Sales; close / consolidation for Finance; copy-edit /
 *     fact-check for Editorial; threat / detection / response for
 *     Cybersecurity. The validator does NOT hard-code a verb whitelist
 *     — different towers use very different action words.
 *   - solutionName MAY end in pattern words ("Co-Pilot", "Workbench",
 *     "Studio", "Hub", "IQ", "Console") only when they ADD meaning, not
 *     as a brand.
 *   - solutionName MUST NOT contain "Versant" (the customer is the user)
 *     or generic AI marketing ("AI-Powered…", "Next-Gen…",
 *     "Transformative…").
 *   - solutionName MUST NOT be a brand-only codename ("Ledgerline",
 *     "Pacelane") — descriptive titles only.
 *   - tagline MUST lead with what changes for the user / process, then
 *     the concrete saving target. Plain English, no hedge phrases.
 *
 * iconKey discipline:
 *   - Picked from `solutionIconAllowlist.ts` (curated ~80 Lucide names).
 *   - Validator silently drops off-allowlist values; the renderer falls
 *     back deterministically based on feasibility (Rocket / Compass).
 *
 * Server-side post-LLM validators sanitize names that fail structural
 * rules and fall back to a deterministic "<l3> Co-Pilot" stub so the
 * card never goes blank — but the post-validator's existence pushes the
 * model to comply on first attempt for the vast majority of calls.
 *
 * Routes through `versantPromptKit` for identity / per-tower context /
 * vendor allow-list / voice rules / Chat-vs-Responses-API call shape so
 * every Versant LLM module speaks the same Versant.
 */

import type { Feasibility } from "@/data/types";
import type {
  IntakeStatusEntry,
  IntakeStatusEvidenceField,
  L3WorkforceRowV6,
  TowerAiReadinessIntake,
  TowerId,
} from "@/data/assess/types";
import {
  TOWER_READINESS_MAX_DIGEST_CHARS,
  normalizeForEvidenceMatch,
} from "@/lib/assess/towerReadinessIntake";
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
import {
  buildIconAllowlistKeyCsv,
  buildIconAllowlistPromptBlock,
  isAllowedIconKey,
} from "@/lib/initiatives/solutionIconAllowlist";

const DEFAULT_TIMEOUT_MS = 90_000;
const MIN_INITIATIVES_PER_L3 = 1;
const MAX_INITIATIVES_PER_L3 = 3;
const VENDOR_TBD = "TBD — subject to discovery";

/**
 * Prompt version. Bump when the prompt or validator contract changes
 * (e.g. naming rules, iconKey introduction). Cached initiatives carry
 * this in `L3Initiative.promptVersion` so the UI can detect legacy
 * cache and surface a one-click "refresh to apply" affordance without
 * erasing the existing entry.
 *
 * `2026-05-descriptive` = descriptive 5-10 word naming + iconKey.
 * `2026-05-intake-status` = adds the per-initiative Done / In Progress /
 * Not Done classification with an intake-field-anchored evidence quote
 * (server-side verbatim-substring verifier prevents fabrication).
 */
export const CURATE_L3_PROMPT_VERSION = "2026-05-intake-status";

/**
 * Subset of the readiness intake threaded into the per-row LLM call so
 * the post-validator can do a verbatim-substring check on the evidence
 * quote AND apply the negative `noGoAreas` gate. The curator already
 * receives the bounded digest as plain text in the system prompt; this
 * structured payload is only used by `parseAndValidate` server-side.
 */
export type IntakeContextForValidator = {
  fields: Pick<
    TowerAiReadinessIntake,
    | "currentAiTools"
    | "experimentsLearnings"
    | "readyNow"
    | "noGoAreas"
  >;
  importedAt: string;
};

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
  /**
   * Structured intake fields for the post-LLM `intakeStatus` validator.
   * When present, the validator runs the verbatim-substring evidence
   * check + the negative `noGoAreas` gate and stamps `intakeImportedAt`
   * on every accepted classification. When absent, the LLM is told (via
   * the digest's absence) to omit the `intakeStatus` block; the
   * validator drops anything the model emits anyway.
   */
  intake?: IntakeContextForValidator;
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

  return parseAndValidate(result.parsed, row, options.intake);
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
    "solutionName MUST be SELF-EXPLANATORY: a workshop attendee should grok what the solution does WITHOUT reading the tagline.",
    "",
    "Mandatory shape:",
    "  - 5 to 10 words.",
    "  - Leads with the user-visible action / object the solution acts on.",
    "  - Plain English, declarative, no hedge phrases, no marketing voice.",
    "  - Uses the L3 Job Family's OWN domain-native vocabulary — the verbs and nouns the practitioners in THAT L3 use day-to-day. Different towers use very different action words; do NOT bias toward any one tower's flavor:",
    "      • HR / Talent      → recruiting, sourcing, onboarding, retention, talent",
    "      • Rights / Legal   → clearance, windowing, royalty, contract, compliance",
    "      • Ad Sales         → pacing, yield, inventory, audience, campaign",
    "      • Content Ops      → tagging, clipping, metadata, captioning, packaging",
    "      • Cybersecurity    → threat, detection, response, anomaly, monitoring",
    "      • Finance          → close, consolidation, forecasting, payables, treasury",
    "      • Editorial / News → copy-edit, fact-check, standards, brand-voice, drafting",
    "      • Production       → playout, scheduling, asset, rundown, broadcast",
    "      • Service          → triage, routing, intent, NPS, response",
    "      • Tech / Eng       → orchestration, observability, deployment, SRE",
    "    The validator does NOT hard-code a verb whitelist — pick the words that match THIS row's L3 Job Family.",
    "  - May end in pattern words (`Co-Pilot`, `Workbench`, `Studio`, `Hub`, `IQ`, `Console`, `Operator`, `Suite`, `Monitor`, `Forecaster`, `Routing`) ONLY when they ADD meaning, not as a brand wrapper. The pattern word is optional — the descriptive action+object pairing is what makes the title self-explanatory.",
    "",
    "STRICT prohibitions on solutionName:",
    "  1. MUST NOT contain the word 'Versant'. Versant is the customer.",
    "  2. MUST NOT be a brand-only codename (e.g. 'Ledgerline', 'Spendsight', 'Pacelane', 'Royaltyflow'). These read as marketing names; we want descriptive titles.",
    "  3. MUST NOT use generic AI marketing language: 'AI-Powered…', 'Next-Gen…', 'Transformative…', 'Smart…', 'Intelligent…', 'Revolutionary…'.",
    "  4. MUST NOT begin with 'Agentic AI ...'. Lead with the action / object.",
    "  5. MUST NOT be a single-word or 2-word codename — the title must carry enough words (5-10) to convey what it does.",
    "",
    "Good examples — note the verb / noun set shifts with the tower:",
    "  Finance        → 'Intercompany Close Reconciliation Co-Pilot'",
    "  Finance        → 'Multi-Brand Payables Auto-Triage Workbench'",
    "  Editorial/News → 'MS NOW Newsroom Brand-Voice Guardrail Monitor'",
    "  Rights         → 'Split-Rights Windowing & Royalty Routing Hub'",
    "  Treasury       → 'Covenant & Liquidity Early-Warning Forecaster'",
    "  HR             → 'Producer & Anchor Talent Sourcing Co-Pilot'",
    "  Ad Sales       → 'Cross-Brand Linear+CTV Pacing & Yield Console'",
    "  Content Ops    → 'Episode Metadata, Clipping & Compliance Workbench'",
    "  Cybersecurity  → 'Insider-Threat Detection & Response Operator'",
    "  Service        → 'Multi-Brand Customer Triage & Routing Suite'",
    "",
    "tagline (1 short sentence, <=25 words) MUST lead with what changes for the user / process, then the concrete saving target. Plain English; no hedge phrases. Example: 'Auto-resolves intercompany breaks across 7+ Versant entities and compresses month-end close from 12-18 days to 5-7.'",
    "",
    "===========================================================================",
    "AI SOLUTION ICON (the `iconKey` field) — pick from the curated allowlist",
    "===========================================================================",
    "Pick ONE icon key from the allowlist below that visually represents what THIS solution does. The keys are PascalCase Lucide names; echo one verbatim. The model output is treated as an enum.",
    "",
    "ALLOWED ICON KEYS (one per line — `Key — usage hint`):",
    buildIconAllowlistPromptBlock(),
    "",
    `Echo exactly ONE key from the list. If no icon clearly fits (rare), choose the closest match — the validator will silently fall back to a feasibility default if you return anything outside the list. Comma-separated key set: ${buildIconAllowlistKeyCsv()}`,
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
    "RATIONALE GUIDANCE — keep `aiRationale` 2-4 sentences (50-90 words), declarative, Versant-specific. Name a real Versant brand (MS NOW, CNBC, Golf Channel, GolfNow, GolfPass, USA Network, E!, Syfy, Oxygen True Crime, Fandango, Rotten Tomatoes, SportsEngine), an executive role from the EXECUTIVE_ROLES catalog ('the CFO', 'the SVP Standards and Editorial', 'the President MS NOW', 'the CIO' — NEVER a name), or a structural constraint (NBCU TSA expiration, BB- credit rating + covenant monitoring, multi-entity JV close, split rights with NBCU/Hulu, MS NOW progressive positioning) when relevant. NEVER write rationales that could apply to any media company.",
    "",
    buildAllowListsBlock({ includePeople: false, includeVendors: true }),
    "",
    `primaryVendor MUST be chosen from the ALLOWED VENDORS list above (case-sensitive). For compound stacks, separate with " + ". If no allow-list vendor fits, RETURN THE EXACT STRING "${VENDOR_TBD}" (em dash) — never invent a vendor.`,
    "",
    "===========================================================================",
    "INTAKE STATUS (the optional `intakeStatus` block on each initiative)",
    "===========================================================================",
    intakeStatusPromptSection(Boolean(towerIntakeDigest && towerIntakeDigest.trim().length > 0)),
    "",
    "Return STRICT JSON ONLY in this exact shape:",
    '{',
    '  "rowId": "<echo input rowId>",',
    '  "initiatives": [',
    '    {',
    '      "solutionName": "<5-10 word descriptive title leading with action+object; NEVER contains \'Versant\'>",',
    '      "tagline": "<=25 words; lead with user-visible change, then the concrete saving target",',
    '      "aiRationale": "2-4 sentences, Versant-specific",',
    '      "feasibility": "High" | "Low",',
    '      "iconKey": "<one PascalCase key from the allowlist>",',
    '      "primaryVendor": "<allow-list value or TBD>" | null,',
    '      "coversL4RowIds": ["<l4 row id>", ...],',
    '      "intakeStatus": {',
    '        "status": "done" | "in-progress" | "not-done",',
    '        "evidence": "<verbatim 15-60 word slice of the named evidenceField; empty string when status is not-done>",',
    '        "evidenceField": "currentAiTools" | "experimentsLearnings" | "readyNow"',
    '      }',
    '    }',
    '  ]',
    '}',
    "",
    `Produce between ${MIN_INITIATIVES_PER_L3} and ${MAX_INITIATIVES_PER_L3} initiatives. Echo \`rowId\` verbatim. Do NOT add prose outside the JSON object.`,
  ];

  return sections.join("\n") + digestBlock;
}

/**
 * Builds the "INTAKE STATUS" block of the system prompt. Two paths:
 *
 *   - **digest present** — the LLM has the questionnaire above, so we
 *     give it the precedence-ordered classification rules and the
 *     anti-fabrication backstop description.
 *   - **digest absent** — instruct the model to OMIT the `intakeStatus`
 *     block entirely. The validator double-checks by dropping any
 *     `intakeStatus` it sees when the caller didn't supply intake
 *     fields, so the model's compliance is not load-bearing.
 */
function intakeStatusPromptSection(hasIntakeDigest: boolean): string {
  if (!hasIntakeDigest) {
    return [
      "No intake questionnaire was provided for this tower. OMIT the `intakeStatus` block entirely from every initiative — do not invent a status without source evidence.",
    ].join("\n");
  }
  return [
    "Use ONLY the questionnaire above. Classify each initiative against what the tower lead has said is currently running, piloted, or queued — never against your own priors. The post-LLM validator checks every quote against the questionnaire text and downgrades to `not-done` with empty evidence on any mismatch.",
    "",
    "PRECEDENCE-ORDERED RULES (apply top-down):",
    "  1. NEGATIVE GATE — `noGoAreas`. If the L3 Job Family or this candidate solution falls inside the questionnaire's `Do not go` text, status MUST be `not-done`. `noGoAreas` is NEVER a valid `evidenceField`. Do not use `noGoAreas` text as evidence.",
    "  2. `done` — only when `Current AI or automation tools` describes the EXACT capability already running in production (e.g. the intake says 'we use {a specific close-orchestration vendor} for Finance close' → a Finance reconciliation initiative anchored on that vendor is `done`). The validator will require the quote to appear verbatim in `currentAiTools`.",
    "  3. `in-progress` — only when ONE of:",
    "       (a) `AI experiments and learnings` describes a real pilot / POC / lab work targeting this capability, OR",
    "       (b) `Ready now / low risk` explicitly names this capability AND the wording indicates ACTIVE WORK HAS STARTED (e.g. 'we have started piloting X', 'kickoff this quarter'). Mere willingness ('we'd be open to trying X', 'low risk for us') does NOT qualify — that is `not-done`.",
    "  4. `not-done` — the default. Mandatory whenever rules (1)–(3) do not clearly hold. NEVER fabricate evidence to upgrade.",
    "",
    "QUOTE SHAPE (when status is `done` or `in-progress`):",
    "  - 15-60 words, drawn VERBATIM as a contiguous slice of the named `evidenceField` text.",
    "  - Do NOT paraphrase, ellide, or join non-contiguous fragments. Preserve the lead's exact wording — the validator's substring check is normalized for whitespace and curly-vs-ASCII punctuation only.",
    "",
    "FORWARD-LOOKING EXCLUSION:",
    "  - `Biggest impact instincts` describes what the lead THINKS would matter; it is NOT evidence of current state and is NEVER a valid `evidenceField`. The schema does not even include it as a value.",
    "",
    "When status is `not-done`, set `evidence` to the empty string and `evidenceField` to `\"currentAiTools\"` (placeholder; ignored).",
  ].join("\n");
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
    `Curate ${MIN_INITIATIVES_PER_L3}-${MAX_INITIATIVES_PER_L3} specific AI Solution products that target the work performed across this L3 Job Family. solutionName MUST be a 5-10 word DESCRIPTIVE title that leads with the action and object the solution acts on, drawn from this L3's own domain-native vocabulary (a workshop attendee should grok what it does without reading the tagline). NEVER include the word "Versant" in solutionName. NEVER use brand-only codenames (Ledgerline, Pacelane). NEVER use generic AI marketing language (AI-Powered, Next-Gen, Smart, Intelligent, Transformative). NEVER lead with "Agentic AI". Pick exactly ONE iconKey from the allowlist that represents what this solution does. Echo \`rowId\` verbatim and ground every rationale in Versant brands / people / constraints.`,
  );
  return lines.join("\n");
}

// ===========================================================================
//   Validators
// ===========================================================================

const VENDOR_ALLOW_LOWER = new Set(ALLOWED_VENDORS.map((v) => v.toLowerCase()));

/**
 * Generic AI-marketing fluff fragments — the post-validator strips
 * names that lead with these because they convey nothing about what
 * the solution does. Independent of the L3 domain, so safe to lock
 * across all towers (HR / Rights / Finance / Editorial / Cyber / etc.
 * all benefit from rejecting "AI-Powered…" / "Smart…" / "Next-Gen…").
 *
 * Notable absence: NO domain verb whitelist or blacklist. The
 * descriptive-naming contract instructs the LLM to draw verbs / nouns
 * from the L3's own domain vocabulary, which differs sharply across
 * towers — hard-coding a verb list here would force every tower into
 * one tower's flavor.
 */
const FLUFF_PREFIXES = [
  "ai-powered",
  "ai powered",
  "next-gen",
  "next gen",
  "transformative",
  "revolutionary",
  "smart",
  "intelligent",
  "agentic ai",
];

/**
 * Reasons a solution name fails validation. The validator now enforces
 * structural rules only — descriptiveness, length, no Versant, no
 * marketing fluff, no codename — and never blacklists domain verbs.
 */
type NameInvalidReason =
  | "too_short"
  | "too_few_words"
  | "too_many_words"
  | "contains_versant"
  | "starts_with_fluff"
  | "single_word_codename";

const MIN_NAME_WORDS = 4;
const MAX_NAME_WORDS = 12;

function checkSolutionName(name: string): NameInvalidReason | null {
  if (!name || name.trim().length < 8) return "too_short";
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  if (wordCount < MIN_NAME_WORDS) {
    if (wordCount <= 2) return "single_word_codename";
    return "too_few_words";
  }
  if (wordCount > MAX_NAME_WORDS) return "too_many_words";
  if (/\bversant\b/i.test(trimmed)) return "contains_versant";
  for (const prefix of FLUFF_PREFIXES) {
    if (lower.startsWith(prefix)) return "starts_with_fluff";
  }
  return null;
}

function isInvalidSolutionName(name: string): boolean {
  return checkSolutionName(name) !== null;
}

function sanitizeSolutionName(raw: unknown, l3: string): string {
  const str = typeof raw === "string" ? raw.trim() : "";
  if (!isInvalidSolutionName(str)) {
    // Strip a leading "Agentic AI " if it slipped past the LLM — this is
    // a soft trim to preserve the rest of an otherwise-descriptive name
    // rather than fall all the way back to the deterministic stub.
    return str.replace(/^agentic\s+ai\s+/i, "").trim();
  }
  // Deterministic fallback when the LLM-produced name fails the
  // structural rules. Builds a descriptive stub from the L3 label so
  // the card is never blank; the tower lead can refresh on demand. We
  // strip "Versant" from the L3 label defensively so a Job Family name
  // like "Versant Payables" doesn't sneak the brand back into the
  // fallback.
  const cleanedL3 = l3.replace(/\bversant\b\s*/gi, "").trim() || l3;
  return `${cleanedL3} Workflow Automation Co-Pilot`;
}

/**
 * Validate the LLM-returned iconKey against the curated allowlist.
 * Off-allowlist or missing values return `undefined` so the renderer
 * falls back deterministically based on feasibility.
 */
function sanitizeIconKey(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return isAllowedIconKey(trimmed) ? trimmed : undefined;
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

/**
 * Cap the verbatim quote at 60 words / 600 chars after the substring
 * check passes. Keeps the persisted evidence proportional and the deep-
 * dive panel readable; the LLM is instructed to stay under 60 words but
 * we trim defensively in case it wanders.
 */
const MAX_EVIDENCE_WORDS = 60;
const MAX_EVIDENCE_CHARS = 600;

const VALID_EVIDENCE_FIELDS: ReadonlySet<IntakeStatusEvidenceField> =
  new Set<IntakeStatusEvidenceField>([
    "currentAiTools",
    "experimentsLearnings",
    "readyNow",
  ]);

function clampEvidence(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return "";
  const words = trimmed.split(/\s+/);
  let truncated =
    words.length > MAX_EVIDENCE_WORDS
      ? `${words.slice(0, MAX_EVIDENCE_WORDS).join(" ")}…`
      : trimmed;
  if (truncated.length > MAX_EVIDENCE_CHARS) {
    truncated = `${truncated.slice(0, MAX_EVIDENCE_CHARS - 1)}…`;
  }
  return truncated;
}

/**
 * Server-side validator for the LLM-emitted `intakeStatus` block. The
 * only path that produces a "done" or "in-progress" classification.
 *
 *   - Drops the block entirely when no intake context is supplied
 *     (caller had no questionnaire) — UI treats undefined as "not-done".
 *   - Coerces the status / evidenceField enums; out-of-list values
 *     (`biggestImpact`, `noGoAreas`, anything else) are rejected.
 *   - For `done` / `in-progress`: runs `normalizeForEvidenceMatch` on
 *     both sides and checks the quote is a contiguous substring of the
 *     named intake field. Mismatches are downgraded to `not-done` with
 *     empty evidence — anti-fabrication backstop.
 *   - Negative `noGoAreas` gate: any positive classification whose L3
 *     terms appear inside the normalized `noGoAreas` text is downgraded.
 *   - Stamps `classifiedAt` and `intakeImportedAt` server-side; LLM
 *     timestamps (if any) are ignored.
 */
export function sanitizeIntakeStatus(
  raw: unknown,
  l3Label: string,
  intake: IntakeContextForValidator | undefined,
): IntakeStatusEntry | undefined {
  if (!intake) return undefined;
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const r = raw as Record<string, unknown>;

  let status: IntakeStatusEntry["status"];
  if (r.status === "done") status = "done";
  else if (r.status === "in-progress") status = "in-progress";
  else status = "not-done";

  const fieldRaw = typeof r.evidenceField === "string" ? r.evidenceField : "";
  const evidenceField: IntakeStatusEvidenceField = VALID_EVIDENCE_FIELDS.has(
    fieldRaw as IntakeStatusEvidenceField,
  )
    ? (fieldRaw as IntakeStatusEvidenceField)
    : "currentAiTools";

  const evidenceRaw = typeof r.evidence === "string" ? r.evidence : "";

  const buildNotDone = (): IntakeStatusEntry => ({
    status: "not-done",
    evidence: "",
    evidenceField: "currentAiTools",
    classifiedAt: new Date().toISOString(),
    intakeImportedAt: intake.importedAt,
  });

  if (status === "not-done") {
    return buildNotDone();
  }

  if (!evidenceRaw.trim()) {
    return buildNotDone();
  }

  const intakeFieldText =
    evidenceField === "currentAiTools"
      ? intake.fields.currentAiTools
      : evidenceField === "experimentsLearnings"
        ? intake.fields.experimentsLearnings
        : intake.fields.readyNow;
  const normalizedField = normalizeForEvidenceMatch(intakeFieldText);
  const normalizedQuote = normalizeForEvidenceMatch(evidenceRaw);
  if (!normalizedField || !normalizedQuote) {
    return buildNotDone();
  }
  if (!normalizedField.includes(normalizedQuote)) {
    return buildNotDone();
  }

  const normalizedNoGo = normalizeForEvidenceMatch(intake.fields.noGoAreas);
  if (normalizedNoGo) {
    const l3Tokens = normalizeForEvidenceMatch(l3Label)
      .split(" ")
      .filter((tok) => tok.length >= 4);
    if (l3Tokens.some((tok) => normalizedNoGo.includes(tok))) {
      return buildNotDone();
    }
  }

  return {
    status,
    evidence: clampEvidence(evidenceRaw),
    evidenceField,
    classifiedAt: new Date().toISOString(),
    intakeImportedAt: intake.importedAt,
  };
}

function parseAndValidate(
  raw: unknown,
  input: CurateL3LLMRowInput,
  intake?: IntakeContextForValidator,
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
    const iconKey = sanitizeIconKey(r.iconKey);
    const coversL4RowIds = sanitizeCoversL4RowIds(r.coversL4RowIds, validIds);
    const intakeStatus = sanitizeIntakeStatus(
      r.intakeStatus,
      input.l3,
      intake,
    );
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
      ...(iconKey ? { iconKey } : {}),
      ...(primaryVendor ? { primaryVendor } : {}),
      ...(coversL4RowIds.length > 0 ? { coversL4RowIds } : {}),
      ...(intakeStatus ? { intakeStatus } : {}),
      promptVersion: CURATE_L3_PROMPT_VERSION,
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
 * Deterministic fallback: produce one generic but valid descriptive
 * initiative when the LLM is unreachable / the call fails for a row.
 * Drawn so the card never goes blank; the tower lead can refresh once
 * the LLM is back. Strips any "Versant" prefix from the L3 label so the
 * fallback name doesn't reintroduce the brand into the product name.
 *
 * The fallback intentionally carries NO `iconKey` so the renderer applies
 * its feasibility-based default (Compass for Low) — keeps the visual
 * language consistent with other New-build solutions.
 */
export function fallbackL3Initiatives(
  towerId: TowerId,
  row: Pick<L3WorkforceRowV6, "id" | "l3" | "childL4RowIds">,
): CurateL3InitiativePayload[] {
  const cleanedL3 = row.l3.replace(/\bversant\b\s*/gi, "").trim() || row.l3;
  const solutionName = `${cleanedL3} Workflow Automation Co-Pilot`;
  return [
    {
      id: buildL3InitiativeId(towerId, row.id, solutionName),
      solutionName,
      tagline: `Generic AI Solution stub for ${cleanedL3} — refresh once the LLM is reachable.`,
      aiRationale: `Deterministic fallback. The per-L3 LLM call could not run for ${cleanedL3} at Versant Media Group; the Refine + regenerate affordance on the L3 card will produce a Versant-grounded design once OPENAI_API_KEY is reachable.`,
      feasibility: "Low",
      coversL4RowIds: [...row.childL4RowIds],
      promptVersion: CURATE_L3_PROMPT_VERSION,
    },
  ];
}
