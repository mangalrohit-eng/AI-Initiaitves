/**
 * Server-only OpenAI helper for the "Upload initiatives list" path on
 * Step 4. The user has uploaded a CSV/XLSX with one row per AI Solution
 * (Solution Name + Description + optional L3 + optional Tech/vendor),
 * and the LLM's job is NOT to propose new solutions — only to enrich
 * each user-supplied row into a full `L3Initiative` card payload:
 *
 *   1. Preserve `solutionName` verbatim (passthrough — bypass the strict
 *      naming validator that powers discovery).
 *   2. Write a Versant-voice `tagline` (<=25 words) from the description.
 *   3. Write a 2-4 sentence `aiRationale` grounded in the description +
 *      the chosen L3's L4/L5 context.
 *   4. Pick `feasibility` (High / Low) using the same binary signals as
 *      discovery.
 *   5. Pick `iconKey` from the curated allowlist.
 *   6. Pick `primaryVendor` — use the user's `tech` when it's on the
 *      vendor allow-list (case-folded match); otherwise pick the closest
 *      allowed vendor (or `TBD — subject to discovery`) and embed the
 *      user's literal `tech` in `aiRationale` as `"User-supplied vendor:
 *      <Tech>."` so the workshop lead can audit.
 *   7. When `preMatchedL3RowId` is empty, pick the best-fit L3 from the
 *      tower roster and explain the choice in 1 sentence
 *      (`l3MatchRationale`).
 *
 * Routes through `versantPromptKit` for Versant identity, per-tower
 * context, vendor allow-list, voice rules, icon allowlist, and the
 * Chat-vs-Responses-API call shape — same Versant voice as discovery.
 *
 * Per-row LLM failures (timeout, non-JSON, validation) downgrade to a
 * deterministic fallback that preserves the user's text verbatim — the
 * card never goes blank, and the stored `L3Initiative.source` stays
 * `"manual"` so the gallery's Uploaded badge is correct regardless of
 * LLM availability.
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
import {
  buildIconAllowlistKeyCsv,
  buildIconAllowlistPromptBlock,
  isAllowedIconKey,
} from "@/lib/initiatives/solutionIconAllowlist";
import type { CurateL3InitiativePayload } from "@/lib/assess/curateL3InitiativesStreamProtocol";
import {
  buildL3InitiativeId,
  sanitizeIntakeStatus,
  type IntakeContextForValidator,
} from "@/lib/assess/curateL3InitiativesLLM";

const DEFAULT_TIMEOUT_MS = 90_000;
const VENDOR_TBD = "TBD — subject to discovery";

/**
 * Prompt version for the upload-enrichment path. Stamped onto every
 * enriched `L3Initiative.promptVersion` so a future prompt revision can
 * be detected and refreshed without erasing the user-supplied seed.
 */
export const ENRICH_UPLOADED_INITIATIVES_PROMPT_VERSION =
  "2026-05-enrich-uploaded";

export const MAX_CONCURRENT_ENRICH_CALLS = 4;

/** Re-export for parity with the discovery module. */
export function isLLMConfigured(): boolean {
  return kitIsLLMConfigured();
}

// ===========================================================================
//   Input / output types
// ===========================================================================

/**
 * One row from the user's uploaded list, as it crosses the API
 * boundary into the LLM call. The route validates and trims these
 * before passing them through.
 */
export type EnrichUploadRowInput = {
  /** Client-stable id so streaming reconciliation works across batches. */
  uploadRowId: string;
  /** User-supplied solution name — preserved verbatim. */
  solutionName: string;
  /** User-supplied description — seed for tagline + aiRationale. */
  solutionDescription: string;
  /** Optional user-supplied vendor / tech. Empty string when blank. */
  tech: string;
  /** Set when the client already matched an L3 by name. The LLM honors it. */
  preMatchedL3RowId?: string;
  /** Raw L3 text from the upload row — surfaced to the LLM as a hint when no exact match. */
  l3Hint?: string;
};

/**
 * One row in the tower's L3 roster, passed as context for LLM matching.
 * The orchestrator builds this from `L3WorkforceRowV6` before the API call.
 */
export type L3RosterEntry = {
  rowId: string;
  l1: string;
  l2: string;
  l3: string;
  /** L4 child names — keeps the LLM's matching grounded in actual work. */
  childL4Names?: string[];
};

export type EnrichUploadOutcome =
  | {
      ok: true;
      uploadRowId: string;
      matchedRowId: string;
      l3MatchRationale?: string;
      payload: CurateL3InitiativePayload;
    }
  | {
      ok: false;
      uploadRowId: string;
      error: string;
    };

export type EnrichUploadLLMOptions = {
  model?: string;
  timeoutMs?: number;
  towerIntakeDigest?: string;
  intake?: IntakeContextForValidator;
  signal?: AbortSignal;
  onRowComplete?: (outcome: EnrichUploadOutcome) => void;
};

// ===========================================================================
//   Public API — bounded-concurrency fan-out across upload rows
// ===========================================================================

/**
 * Run one LLM call per uploaded row with bounded concurrency. Per-row
 * failures are reported via `onRowComplete` and the returned array; the
 * route decides which rows fall back to the deterministic passthrough.
 */
export async function enrichUploadedInitiativesPerRow(
  towerId: TowerId,
  uploads: ReadonlyArray<EnrichUploadRowInput>,
  l3Roster: ReadonlyArray<L3RosterEntry>,
  options: EnrichUploadLLMOptions = {},
): Promise<EnrichUploadOutcome[]> {
  if (!kitIsLLMConfigured()) {
    throw new VersantLLMError("OPENAI_API_KEY not set", "api_key_missing");
  }
  if (uploads.length === 0) return [];
  const concurrency = Math.min(MAX_CONCURRENT_ENRICH_CALLS, uploads.length);
  const outcomes: EnrichUploadOutcome[] = [];

  let cursor = 0;
  const workers: Promise<void>[] = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(
      (async () => {
        while (true) {
          if (options.signal?.aborted) return;
          const idx = cursor++;
          if (idx >= uploads.length) return;
          const input = uploads[idx]!;
          let outcome: EnrichUploadOutcome;
          try {
            outcome = await callLLMForOneUpload(
              towerId,
              input,
              l3Roster,
              options,
            );
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Unknown LLM error";
            outcome = { ok: false, uploadRowId: input.uploadRowId, error: message };
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

async function callLLMForOneUpload(
  towerId: TowerId,
  input: EnrichUploadRowInput,
  roster: ReadonlyArray<L3RosterEntry>,
  options: EnrichUploadLLMOptions,
): Promise<EnrichUploadOutcome> {
  const systemPrompt = buildSystemPrompt(towerId, options.towerIntakeDigest);
  const userPrompt = buildUserPrompt(input, roster);

  const result = await buildLLMRequest({
    systemPrompt,
    userPrompt,
    model: options.model,
    reasoningEffort: VERSANT_DEFAULT_REASONING_EFFORT,
    maxOutputTokens: 2_500,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    signal: options.signal,
  });

  return parseAndValidate(result.parsed, input, roster, towerId, options.intake);
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
          "Use the questionnaire below to ground the tagline + aiRationale in what the tower lead has said is currently running, piloted, queued, or off-limits. The user-supplied solutionName + description still win — never paraphrase or rename what they typed.",
          "",
          towerIntakeDigest.trim().slice(0, TOWER_READINESS_MAX_DIGEST_CHARS),
        ].join("\n")
      : "";

  const sections: string[] = [
    "You are enriching a USER-SUPPLIED AI Solution into a Versant-grounded initiative card. The user has typed the solution name, a short description, and (optionally) a chosen vendor. Your job is to write a polished tagline + rationale, pick a feasibility + icon, normalize the vendor, and (when needed) pick the best-fit L3 Job Family for this solution. You are NOT proposing a different solution and you are NOT renaming what the user typed.",
    "",
    buildVersantPreamble({ grain: "row" }),
    "",
    buildTowerContextBlock(towerId),
    "",
    "===========================================================================",
    "WHAT YOU MAY CHANGE vs PRESERVE",
    "===========================================================================",
    "PRESERVE VERBATIM (do NOT rewrite, paraphrase, or trim):",
    "  - solutionName — echo the user's exact string. The strict 5-10 word descriptive naming validator that governs DISCOVERY does NOT apply here. The user owns the name.",
    "",
    "GENERATE (Versant-voice, declarative, plain English):",
    "  - tagline — 1 short sentence (<=25 words). Lead with what changes for the user / process, then the concrete saving target if the description names one. Plain English, no hedge phrases, no marketing voice.",
    "  - aiRationale — 2-4 sentences (60-120 words). Grounded in the user's description AND the chosen L3's L4/L5 work context AND a Versant-specific anchor (real brand, structural constraint, executive role — never a name).",
    "  - feasibility — binary 'High' / 'Low'. 'High' when the bulk of the work is rules-based or pattern-driven AND a named vendor on the allow-list already supports it AND the cadence is recurring at meaningful volume. 'Low' otherwise (longer runway, new platform stand-up, heavy change management).",
    "  - iconKey — exactly one PascalCase key from the curated Lucide allowlist below. Pick the one that best represents what THIS solution does.",
    "  - primaryVendor — see VENDOR HANDLING below.",
    "  - coversL4RowIds — optional. Pick 1-3 of the chosen L3's child L4 ids that this solution most directly addresses. Leave empty when the solution spans the whole L3 horizontally.",
    "  - intakeStatus — see INTAKE STATUS below.",
    "",
    "===========================================================================",
    "L3 MATCHING (the `matchedRowId` field)",
    "===========================================================================",
    "If the user message says `preMatchedL3RowId` is set, echo it verbatim — the client already matched this row by name. Leave `l3MatchRationale` empty.",
    "Otherwise, pick the single best-fit L3 row id from the L3 ROSTER block in the user message based on the solution name + description + tech. Then write a one-sentence `l3MatchRationale` (<=200 chars) that explains the pick in domain terms (e.g., 'Reconciliation across multi-entity close lives under the Finance Close & Consolidation Job Family.').",
    "Never invent an L3 row id. If no roster entry fits even approximately, pick the closest one and call that out in the rationale.",
    "",
    "===========================================================================",
    "VENDOR HANDLING (the `primaryVendor` field)",
    "===========================================================================",
    "User-supplied `tech` is the user's preferred vendor for this solution. Three cases:",
    "  1. `tech` matches the ALLOWED VENDORS list (case-insensitive, trimmed) — set `primaryVendor` to the canonical allow-list form (preserve original casing). The aiRationale may name it normally.",
    "  2. `tech` is non-empty but NOT on the allow-list — set `primaryVendor` to the closest allow-list vendor (or `\"" + VENDOR_TBD + "\"` if none plausibly fits). REQUIRED: include the literal sentence `User-supplied vendor: <Tech>.` verbatim somewhere inside `aiRationale` so the workshop lead can audit the substitution.",
    "  3. `tech` is empty — pick the most appropriate allow-list vendor for the solution + L3, or `\"" + VENDOR_TBD + "\"` if no allow-list vendor fits.",
    "Compound stacks separate with ' + ' (e.g., 'BlackLine + FloQast').",
    "",
    "===========================================================================",
    "AI SOLUTION ICON (the `iconKey` field) — pick from the curated allowlist",
    "===========================================================================",
    "ALLOWED ICON KEYS (one per line — `Key — usage hint`):",
    buildIconAllowlistPromptBlock(),
    "",
    `Echo exactly ONE key from the list. If no icon clearly fits (rare), choose the closest match — the validator will silently fall back to a feasibility default if you return anything outside the list. Comma-separated key set: ${buildIconAllowlistKeyCsv()}`,
    "",
    "===========================================================================",
    "INTAKE STATUS (the optional `intakeStatus` block)",
    "===========================================================================",
    intakeStatusPromptSection(Boolean(towerIntakeDigest && towerIntakeDigest.trim().length > 0)),
    "",
    buildVoiceRulesBlock(),
    "",
    buildAllowListsBlock({ includePeople: false, includeVendors: true }),
    "",
    "Return STRICT JSON ONLY in this exact shape:",
    "{",
    '  "uploadRowId": "<echo input uploadRowId>",',
    '  "matchedRowId": "<one L3 row id from the roster>",',
    '  "l3MatchRationale": "<<=200 chars; empty string when preMatchedL3RowId was set>",',
    '  "initiative": {',
    '    "solutionName": "<verbatim echo of the user-supplied name>",',
    '    "tagline": "<=25 words; lead with user-visible change",',
    '    "aiRationale": "2-4 sentences, Versant-specific",',
    '    "feasibility": "High" | "Low",',
    '    "iconKey": "<one PascalCase key from the allowlist>",',
    '    "primaryVendor": "<allow-list value, compound stack, or TBD>" | null,',
    '    "coversL4RowIds": ["<l4 row id>", ...],',
    '    "intakeStatus": {',
    '      "status": "done" | "in-progress" | "not-done",',
    '      "evidence": "<verbatim 15-60 word slice of the named evidenceField; empty string when status is not-done>",',
    '      "evidenceField": "currentAiTools" | "experimentsLearnings" | "readyNow"',
    '    }',
    "  }",
    "}",
    "",
    "Echo `uploadRowId` verbatim. Do NOT add prose outside the JSON object.",
  ];

  return sections.join("\n") + digestBlock;
}

function intakeStatusPromptSection(hasIntakeDigest: boolean): string {
  if (!hasIntakeDigest) {
    return [
      "No intake questionnaire was provided for this tower. OMIT the `intakeStatus` block entirely — do not invent a status without source evidence.",
    ].join("\n");
  }
  return [
    "Classify the enriched initiative against the questionnaire using the precedence rules:",
    "  1. NEGATIVE GATE — `noGoAreas`. If the chosen L3 or this solution falls inside the lead's `Do not go` text, status MUST be `not-done`. `noGoAreas` is NEVER a valid `evidenceField`.",
    "  2. `done` — only when `Current AI or automation tools` describes the EXACT capability already running.",
    "  3. `in-progress` — only when `AI experiments and learnings` describes a real pilot/POC OR `Ready now / low risk` names active work that has started.",
    "  4. `not-done` — the default.",
    "QUOTE SHAPE: 15-60 words drawn verbatim from the named field. The validator runs a verbatim-substring check and downgrades any mismatch to `not-done` with empty evidence.",
    "When status is `not-done`, set `evidence` to the empty string and `evidenceField` to `\"currentAiTools\"` (placeholder; ignored).",
  ].join("\n");
}

function buildUserPrompt(
  input: EnrichUploadRowInput,
  roster: ReadonlyArray<L3RosterEntry>,
): string {
  const lines: string[] = [
    `UPLOAD ROW (uploadRowId="${input.uploadRowId}")`,
    `  Solution Name (verbatim): ${input.solutionName}`,
    `  Solution Description: ${input.solutionDescription}`,
    `  User-supplied Tech / Vendor: ${input.tech || "(none)"}`,
    `  preMatchedL3RowId: ${input.preMatchedL3RowId ? `"${input.preMatchedL3RowId}"` : "(none — pick from roster)"}`,
    `  l3Hint (raw L3 text from upload): ${input.l3Hint ? `"${input.l3Hint}"` : "(none)"}`,
    "",
    "L3 ROSTER — pick `matchedRowId` from this list when no preMatchedL3RowId is set:",
  ];
  roster.forEach((r, i) => {
    const sample =
      r.childL4Names && r.childL4Names.length > 0
        ? ` — child L4s: ${r.childL4Names.slice(0, 6).join(", ")}`
        : "";
    lines.push(`  ${i + 1}. rowId="${r.rowId}" — ${r.l1} > ${r.l2} > ${r.l3}${sample}`);
  });
  lines.push("");
  lines.push(
    "Enrich the upload row per the system instructions. PRESERVE solutionName verbatim. Return strict JSON only.",
  );
  return lines.join("\n");
}

// ===========================================================================
//   Validators — passthrough for solutionName; reuse discovery's helpers
//   where the rules are identical (icon allowlist, feasibility, intake status).
// ===========================================================================

const VENDOR_ALLOW_LOWER = new Map(
  ALLOWED_VENDORS.map((v) => [v.toLowerCase(), v]),
);

function passthroughSolutionName(raw: unknown, fallback: string): string {
  const str = typeof raw === "string" ? raw.trim() : "";
  if (str.length > 0 && str.length <= 240) return str;
  return fallback.trim().slice(0, 240) || "Untitled AI Solution";
}

function sanitizeFeasibility(raw: unknown): Feasibility {
  if (typeof raw !== "string") return "Low";
  return raw.trim().toLowerCase() === "high" ? "High" : "Low";
}

function sanitizeIconKey(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return isAllowedIconKey(trimmed) ? trimmed : undefined;
}

/**
 * Normalize a user-supplied vendor string against the allow-list. Returns
 * either the canonical allow-list form, a compound stack like
 * "BlackLine + FloQast" (when every part matches), or `VENDOR_TBD` when no
 * part matches. Caller decides whether to surface the user's literal in
 * `aiRationale`.
 */
function normalizeUserTech(rawTech: string): {
  resolved: string | undefined;
  matched: boolean;
} {
  const trimmed = rawTech.trim();
  if (!trimmed) return { resolved: undefined, matched: false };
  const parts = trimmed.split(/\s*\+\s*/).map((p) => p.trim()).filter(Boolean);
  const resolvedParts: string[] = [];
  for (const p of parts) {
    const canonical = VENDOR_ALLOW_LOWER.get(p.toLowerCase());
    if (canonical) {
      resolvedParts.push(canonical);
    } else {
      return { resolved: undefined, matched: false };
    }
  }
  return { resolved: resolvedParts.join(" + "), matched: true };
}

/**
 * Sanitize the LLM's vendor pick. Validates against the allow-list; on
 * miss, falls back to `VENDOR_TBD`. The "User-supplied vendor: <Tech>"
 * audit note is enforced separately on the aiRationale field.
 */
function sanitizeVendor(raw: unknown): string | undefined {
  if (raw == null || typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed === VENDOR_TBD) return VENDOR_TBD;
  const parts = trimmed.split(/\s*\+\s*/).map((p) => p.trim()).filter(Boolean);
  const resolved: string[] = [];
  for (const p of parts) {
    if (p.toLowerCase() === "llm") {
      resolved.push("LLM");
      continue;
    }
    const canonical = VENDOR_ALLOW_LOWER.get(p.toLowerCase());
    if (!canonical) return VENDOR_TBD;
    resolved.push(canonical);
  }
  return resolved.join(" + ");
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

function truncate(s: string, max = 240): string {
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function ensureAuditNoteForOffAllowlistVendor(
  rationale: string,
  userTech: string,
): string {
  if (!userTech.trim()) return rationale;
  const note = `User-supplied vendor: ${userTech.trim()}.`;
  // Idempotent: only append if not already present in the rationale.
  if (rationale.toLowerCase().includes("user-supplied vendor:")) {
    return rationale;
  }
  const joiner = rationale.trim().endsWith(".") ? " " : ". ";
  return `${rationale.trim()}${joiner}${note}`.slice(0, 1200);
}

function parseAndValidate(
  raw: unknown,
  input: EnrichUploadRowInput,
  roster: ReadonlyArray<L3RosterEntry>,
  towerId: TowerId,
  intake: IntakeContextForValidator | undefined,
): EnrichUploadOutcome {
  if (raw === null || typeof raw !== "object") {
    throw new VersantLLMError(
      "LLM response was not a JSON object",
      "non_json_response",
    );
  }
  const obj = raw as Record<string, unknown>;
  const echoUploadRowId =
    typeof obj.uploadRowId === "string" ? obj.uploadRowId : "";
  if (echoUploadRowId !== input.uploadRowId) {
    throw new VersantLLMError(
      `LLM echoed wrong uploadRowId: expected "${input.uploadRowId}", got "${echoUploadRowId}"`,
      "non_json_response",
    );
  }

  // Resolve `matchedRowId`. Honor preMatch if set; otherwise the LLM picks.
  const rosterIds = new Set(roster.map((r) => r.rowId));
  let matchedRowId = input.preMatchedL3RowId ?? "";
  if (!matchedRowId) {
    const llmMatch =
      typeof obj.matchedRowId === "string" ? obj.matchedRowId : "";
    if (rosterIds.has(llmMatch)) {
      matchedRowId = llmMatch;
    } else if (roster.length > 0) {
      matchedRowId = roster[0]!.rowId;
    } else {
      throw new VersantLLMError(
        "No L3 roster entries provided — cannot attach enriched initiative",
        "non_json_response",
      );
    }
  } else if (!rosterIds.has(matchedRowId)) {
    // Pre-matched id stale (row deleted between client check and LLM call) —
    // fall back to LLM pick or first roster entry.
    matchedRowId =
      (typeof obj.matchedRowId === "string" &&
      rosterIds.has(obj.matchedRowId)
        ? (obj.matchedRowId as string)
        : roster[0]?.rowId) ?? "";
    if (!matchedRowId) {
      throw new VersantLLMError(
        "L3 roster empty after pre-match failed",
        "non_json_response",
      );
    }
  }
  const matchedRow = roster.find((r) => r.rowId === matchedRowId)!;

  const l3MatchRationaleRaw =
    typeof obj.l3MatchRationale === "string" ? obj.l3MatchRationale.trim() : "";
  const l3MatchRationale =
    !input.preMatchedL3RowId && l3MatchRationaleRaw
      ? truncate(l3MatchRationaleRaw, 200)
      : undefined;

  const initiativeRaw = (obj.initiative ?? {}) as Record<string, unknown>;

  const solutionName = passthroughSolutionName(
    initiativeRaw.solutionName,
    input.solutionName,
  );
  const tagline =
    typeof initiativeRaw.tagline === "string" && initiativeRaw.tagline.trim()
      ? truncate(initiativeRaw.tagline.trim(), 240)
      : truncate(input.solutionDescription.trim(), 240) ||
        `User-supplied AI Solution for ${matchedRow.l3}.`;
  let aiRationale =
    typeof initiativeRaw.aiRationale === "string" &&
    initiativeRaw.aiRationale.trim()
      ? initiativeRaw.aiRationale.trim().slice(0, 1200)
      : `User-supplied initiative targeting ${matchedRow.l3} at Versant Media Group. Description: ${input.solutionDescription.trim().slice(0, 600)}`;

  const feasibility = sanitizeFeasibility(initiativeRaw.feasibility);
  const iconKey = sanitizeIconKey(initiativeRaw.iconKey);

  // Vendor: user's tech wins on the allow-list; otherwise we trust the
  // LLM's pick (also validated against the allow-list).
  const userTechResolution = normalizeUserTech(input.tech);
  let primaryVendor: string | undefined;
  if (userTechResolution.matched && userTechResolution.resolved) {
    primaryVendor = userTechResolution.resolved;
  } else {
    primaryVendor = sanitizeVendor(initiativeRaw.primaryVendor);
    if (input.tech.trim()) {
      aiRationale = ensureAuditNoteForOffAllowlistVendor(aiRationale, input.tech);
    }
  }

  // Child L4 row ids only valid against the matched L3's children. We
  // don't ship the actual children list here (kept the prompt small);
  // discard any echoed ids that aren't recognizable. The downstream
  // orchestrator can additionally re-validate against `L3WorkforceRowV6.childL4RowIds`.
  const coversL4RowIds = sanitizeCoversL4RowIds(
    initiativeRaw.coversL4RowIds,
    [], // matched row's childL4Names are NAMES, not ids — the route's L3 roster carries ids only if needed.
  );

  const intakeStatus = sanitizeIntakeStatus(
    initiativeRaw.intakeStatus,
    matchedRow.l3,
    intake,
  );

  // Stamp a placeholder id; the route's stamper rewrites it with the
  // canonical towerId-aware form. Mirrors the discovery validator pattern.
  const id = buildL3InitiativeId(
    "" as TowerId,
    matchedRowId,
    solutionName,
  );

  const payload: CurateL3InitiativePayload = {
    id,
    solutionName,
    tagline,
    aiRationale,
    feasibility,
    ...(iconKey ? { iconKey } : {}),
    ...(primaryVendor ? { primaryVendor } : {}),
    ...(coversL4RowIds.length > 0 ? { coversL4RowIds } : {}),
    ...(intakeStatus ? { intakeStatus } : {}),
    promptVersion: ENRICH_UPLOADED_INITIATIVES_PROMPT_VERSION,
  };

  // Suppress unused warning if towerId not consumed (placeholder id stamper).
  void towerId;

  return {
    ok: true,
    uploadRowId: input.uploadRowId,
    matchedRowId,
    ...(l3MatchRationale ? { l3MatchRationale } : {}),
    payload,
  };
}

// ===========================================================================
//   Deterministic fallback — when LLM is unreachable or per-row failure
// ===========================================================================

/**
 * Build a deterministic enriched initiative that preserves the user's
 * verbatim solutionName + description + tech. Used by the route when
 * `OPENAI_API_KEY` is missing or a per-row LLM call fails. The card
 * never goes blank; the workshop lead can refresh once the LLM is
 * reachable.
 *
 * The stored `L3Initiative.source` stamped by the orchestrator stays
 * `"manual"` — because the HUMAN provided the seed. The wire-format
 * `source` on the stream event is `"fallback"` so the UI can show a
 * "LLM was unavailable — text passed through verbatim" warning.
 */
export function fallbackEnrichedInitiative(
  towerId: TowerId,
  input: EnrichUploadRowInput,
  matchedRow: Pick<L3WorkforceRowV6, "id" | "l3">,
): {
  payload: CurateL3InitiativePayload;
  matchedRowId: string;
} {
  const solutionName =
    input.solutionName.trim().slice(0, 240) || "Untitled AI Solution";
  const description = input.solutionDescription.trim();
  const tagline = truncate(description || `User-supplied AI Solution for ${matchedRow.l3}.`, 120);
  let aiRationale = `User-supplied initiative — awaiting AI enrichment. ${description}`.slice(0, 1200);
  if (input.tech.trim()) {
    aiRationale = ensureAuditNoteForOffAllowlistVendor(aiRationale, input.tech);
  }
  const techResolution = normalizeUserTech(input.tech);
  const primaryVendor =
    techResolution.matched && techResolution.resolved
      ? techResolution.resolved
      : input.tech.trim()
        ? VENDOR_TBD
        : undefined;

  return {
    matchedRowId: matchedRow.id,
    payload: {
      id: buildL3InitiativeId(towerId, matchedRow.id, solutionName),
      solutionName,
      tagline,
      aiRationale,
      feasibility: "Low",
      ...(primaryVendor ? { primaryVendor } : {}),
      promptVersion: ENRICH_UPLOADED_INITIATIVES_PROMPT_VERSION,
    },
  };
}
