/**
 * Server-only OpenAI helper for inferring offshore% / AI% dial defaults on
 * Versant capability-map rows. Used when a tower lead uploads a brand-new
 * L1–L4 hierarchy whose labels won't match the deterministic keyword rules
 * in `seedAssessmentDefaults.ts`.
 *
 * After the 5-layer migration the dial grain is **L4 Activity Group**
 * (formerly L3 Capability). Each input row carries the full path
 * `{ l2 Job Grouping, l3 Job Family, l4 Activity Group }`. L5 Activities are
 * display-only and generated separately by `generateL4ActivitiesLLM.ts`.
 *
 * Back-compat: legacy v4 callers may still send `{ l2, l3 }` and omit `l4`;
 * in that case we score on the L3 label as before so existing programs
 * continue to function during cutover.
 *
 * Design notes (post-PR1 unification):
 *  - Single batched call per tower (one request, N row scores back). We do NOT
 *    call OpenAI per row — too slow, too expensive, and unnecessary since the
 *    model can score the whole list in one shot with consistent reasoning.
 *  - Routes through `versantPromptKit` for identity, per-tower context, and
 *    voice rules so Step 1 dial scoring shares grounding with Steps 2/4/5.
 *  - Uses `gpt-5.5` via the Responses API + reasoning by default; the global
 *    `OPENAI_MODEL` env var still overrides. Per-route `OPENAI_*_MODEL`
 *    overrides are gone.
 *  - On any failure (no key, network error, timeout, malformed JSON, length
 *    mismatch) the caller should fall back to the deterministic heuristic.
 *    This file does not contain the fallback itself — it's pure "try LLM."
 */

import type { TowerId } from "@/data/assess/types";
import {
  VERSANT_DEFAULT_REASONING_EFFORT,
  VersantLLMError,
  buildAllowListsBlock,
  buildLLMRequest,
  buildTowerContextBlock,
  buildVersantPreamble,
  buildVoiceRulesBlock,
  isLLMConfigured as kitIsLLMConfigured,
} from "@/lib/llm/prompts/versantPromptKit";

export type LLMRowInput = {
  /** L2 Job Grouping (prompt context). */
  l2: string;
  /** L3 Job Family (prompt context). */
  l3: string;
  /**
   * L4 Activity Group — the row whose dial pair is being scored. Optional
   * for back-compat with legacy v4 callers; when absent, the model scores
   * the row using the L3 label as the dial-row name.
   */
  l4?: string;
  /**
   * Optional L2 / L3 / L4 narrative context. Server route looks these
   * up from the canonical map (`resolveRowDescriptions`) before invoking;
   * when present, the user prompt renders a per-row "ROW NARRATIVE
   * CONTEXT" block so the model has explicit grounding instead of
   * inferring from the row label alone. Omitted on towers that
   * haven't been description-authored — prompt skips the block, model
   * falls back to the tower context paragraph.
   */
  l2Description?: string;
  l3Description?: string;
  l4Description?: string;
};

export type LLMRowResult = {
  offshorePct: number;
  aiPct: number;
  /** ≤15-word Versant-grounded explanation for the offshore dial. */
  offshoreRationale?: string;
  /** ≤15-word Versant-grounded explanation for the AI-impact dial. */
  aiRationale?: string;
};

export type InferLLMOptions = {
  /**
   * Test-only model override. Production callers should let the kit resolve
   * the model from `OPENAI_MODEL` (or the default `gpt-5.5`).
   */
  model?: string;
  /** Abort timeout in ms (default 60_000). */
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 60_000;

const OFFSHORE_MIN = 5;
const OFFSHORE_MAX = 85;
const AI_MIN = 10;
const AI_MAX = 75;

/** Returns true iff `OPENAI_API_KEY` is configured. Cheap, no network call. */
export function isLLMConfigured(): boolean {
  return kitIsLLMConfigured();
}

class LLMError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "LLMError";
  }
}

function buildSystemPrompt(towerId: TowerId): string {
  return [
    "You score Versant Media Group capability-map rows for an illustrative impact model.",
    "",
    buildVersantPreamble({ grain: "row" }),
    "",
    buildTowerContextBlock(towerId),
    "",
    "Versant capability maps are now FIVE layers: L1 Function > L2 Job Grouping > L3 Job Family > L4 Activity Group > L5 Activity. Dial scores live on the L4 Activity Group (the row I send you). L5 Activities are display-only and not part of this scoring task.",
    "",
    "For every L2 / L3 / L4 row I send you, return TWO scores for the L4 Activity Group:",
    "  - offshorePct (5-85, integer, multiple of 5): share of the WORK that can plausibly move to a global delivery centre (India/Philippines/etc.). LOWER for editorial judgment, on-air talent, US-physical work, deal-making, regulator-facing work, high-trust client relationships, brand strategy. HIGHER for routine processing (AP, AR, reconciliation, payroll), helpdesk, data prep, analytics support, software test, document review.",
    "  - aiPct (10-75, integer, multiple of 5): share of the WORK that AI (LLMs, agents, classifiers, copilots) can realistically displace or 10x today. HIGHER for summarization, transcription, captioning, translation, document review, anomaly detection, monitoring, lead scoring, structured extraction. LOWER for executive judgment, in-person relationships, on-camera work, crisis decisions.",
    "",
    "VERSANT-SPECIFIC CONSTRAINTS YOU MUST RESPECT:",
    "  - Editorial / news judgment / on-air talent / fact-checking / political coverage → very low offshore + low AI (AP-style summarization OK; final judgment must stay onshore + human). Brian Carovillano gates editorial AI.",
    "  - MS NOW progressive positioning → political brand sensitivity, low AI for any user-facing crisis-detection or content output.",
    "  - Sales is GREENFIELD post-TSA — relationship-driven, mostly US-onshore for now; AI-augmentation OK (lead scoring, outreach drafting). Election-cycle 2026 capture matters for MS NOW.",
    "  - BB- credit rating + dividend + buyback → Treasury / covenant / debt management is high-consequence; humans stay in the loop.",
    "  - Multi-entity JV (Fandango 75/25 WBD, Nikkei CNBC), split-rights deals (Kardashians on-air retained, streaming to Hulu) → rights & legal complexity = lower offshore, AI-augmentable for first-pass.",
    "  - Operations & Technology / Production / studio ops are PHYSICAL — low offshore (work happens at the venue/studio), low-medium AI. Olympics on USA/CNBC, USGA through 2032 are high-stakes live windows where downtime is unacceptable.",
    "",
    buildVoiceRulesBlock(),
    "",
    buildAllowListsBlock({ includePeople: false, includeVendors: true }),
    "",
    "Return STRICT JSON ONLY in this exact shape, with one item per input row, in INPUT ORDER. Each item carries TWO short rationales — offshore and AI are independent levers and each deserves its own one-liner:",
    '{"items": [{"offshorePct": <int>, "aiPct": <int>, "offshoreRationale": "<≤15 words why this offshorePct>", "aiRationale": "<≤15 words why this aiPct>"}, ...]}',
    "",
    "Rationale guidance — be Versant-specific, declarative, and concrete. Name brands, structural constraints, or vendors from the allow-list. Never write rationales that could apply to any media company.",
    "",
    "Do not return any prose outside the JSON. Do not skip rows. Do not add extra rows. Always return integers (not floats) and round to the nearest 5.",
  ].join("\n");
}

function buildUserPrompt(rows: LLMRowInput[]): string {
  // Two input shapes for back-compat:
  //   V5: { l2, l3, l4 }  → dial row is the L4 Activity Group
  //   V4 (legacy): { l2, l3 } → dial row is the L3 (we treat L3 as the
  //                              row label so older programs still score)
  // When ANY description field is non-empty for a row, render a per-row
  // "ROW NARRATIVE CONTEXT" sub-block immediately after the label line.
  // The block is skipped entirely for rows whose tower hasn't been
  // description-authored yet — keeps the prompt clean across the
  // mid-rollout state where some towers have descriptions and others
  // don't.
  const lines: string[] = [];
  rows.forEach((r, i) => {
    if (r.l4 && r.l4.trim()) {
      lines.push(
        `${i + 1}. L2="${truncate(r.l2)}" / L3="${truncate(r.l3)}" / L4="${truncate(r.l4)}"`,
      );
    } else {
      lines.push(`${i + 1}. L2="${truncate(r.l2)}" / L3="${truncate(r.l3)}"`);
    }
    const ctxBlock = renderRowDescriptionBlock(r);
    if (ctxBlock) lines.push(ctxBlock);
  });
  const grain = rows.some((r) => r.l4 && r.l4.trim())
    ? "L4 Activity Groups (5-layer map)"
    : "L3 capabilities (legacy 4-layer map)";
  return [
    `Score these ${rows.length} ${grain}. Preserve order.`,
    "When a row carries a NARRATIVE CONTEXT block, ground your scores in those specifics — they're authored by Versant tower leads and outrank generic inferences from the row label.",
    "",
    ...lines,
  ].join("\n");
}

/**
 * Render the per-row narrative context sub-block. Returns the empty
 * string when no description fields are populated, so the user prompt
 * stays compact for towers that haven't been authored yet.
 */
function renderRowDescriptionBlock(row: LLMRowInput): string {
  const parts: string[] = [];
  if (row.l2Description?.trim()) {
    parts.push(`     L2 — ${truncate(row.l2Description, 480)}`);
  }
  if (row.l3Description?.trim()) {
    parts.push(`     L3 — ${truncate(row.l3Description, 480)}`);
  }
  if (row.l4Description?.trim()) {
    parts.push(`     L4 — ${truncate(row.l4Description, 480)}`);
  }
  if (parts.length === 0) return "";
  return ["     NARRATIVE CONTEXT:", ...parts].join("\n");
}

function truncate(s: string, max = 160): string {
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function clampRound5(value: unknown, min: number, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : Number(value);
  if (!Number.isFinite(n)) return min;
  const clamped = Math.max(min, Math.min(max, n));
  return Math.round(clamped / 5) * 5;
}

/**
 * Calls OpenAI to score a batch of rows. Throws on any failure — caller must
 * provide its own deterministic fallback.
 *
 * Throws an `LLMError` when the API key is missing, the request times out,
 * the upstream returns a non-2xx, the body is unparseable, or the returned
 * item count doesn't match the input row count.
 */
export async function inferTowerDefaultsWithLLM(
  towerId: TowerId,
  rows: LLMRowInput[],
  options: InferLLMOptions = {},
): Promise<LLMRowResult[]> {
  if (!kitIsLLMConfigured()) {
    throw new LLMError("OPENAI_API_KEY not set");
  }
  if (!rows.length) return [];

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let parsed: unknown;
  try {
    const result = await buildLLMRequest({
      systemPrompt: buildSystemPrompt(towerId),
      userPrompt: buildUserPrompt(rows),
      model: options.model,
      reasoningEffort: VERSANT_DEFAULT_REASONING_EFFORT,
      timeoutMs,
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

  const items = (parsed as { items?: unknown[] })?.items;
  if (!Array.isArray(items)) {
    throw new LLMError("OpenAI JSON missing `items` array");
  }
  if (items.length !== rows.length) {
    throw new LLMError(
      `OpenAI returned ${items.length} items for ${rows.length} input rows`,
    );
  }

  return items.map((raw) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    // Graceful read of the legacy single-string `rationale` shape (older
    // model responses or future stub paths). When present, it splits across
    // both lever rationales so callers always have something to show.
    const legacyRationale =
      typeof item.rationale === "string" && item.rationale.trim()
        ? item.rationale.trim()
        : undefined;
    const offshoreRationale =
      typeof item.offshoreRationale === "string" && item.offshoreRationale.trim()
        ? item.offshoreRationale.trim()
        : legacyRationale;
    const aiRationale =
      typeof item.aiRationale === "string" && item.aiRationale.trim()
        ? item.aiRationale.trim()
        : legacyRationale;
    return {
      offshorePct: clampRound5(item.offshorePct, OFFSHORE_MIN, OFFSHORE_MAX),
      aiPct: clampRound5(item.aiPct, AI_MIN, AI_MAX),
      offshoreRationale,
      aiRationale,
    };
  });
}
