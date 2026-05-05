/**
 * Server-only OpenAI helper for generating **L5 Activity** names under each
 * L4 Activity Group after a tower lead uploads their (L2 / L3 / L4) workforce
 * template.
 *
 * 5-layer migration note: the file/type names still carry the historic
 * `L4` suffix (the contract was authored before the new L2 Job Grouping
 * layer was inserted). After the migration the semantics are:
 *
 *   - Input row: { l2 = Job Grouping, l3 = Job Family, l4 = Activity Group }
 *   - Output:    activities[] = L5 Activity names under that Activity Group
 *
 * Uploads no longer carry L5 Activities — they are display-only and exist
 * only to give the capability map something concrete underneath each
 * Activity Group. Tower leads who want to see real Versant-flavoured
 * activities trigger this generator from the Capability Map page; the
 * result is persisted on `L4WorkforceRow.l5Activities`.
 *
 * Design notes (post-PR1 unification):
 *  - Single batched call per tower. The model returns 4-8 short activity
 *    names per Activity Group — enough to be useful in the map, not so
 *    many that the UI drowns.
 *  - Routes through `versantPromptKit` for identity, per-tower context, and
 *    voice rules so Step 2 outputs align with Step 4 / Step 5 in vocabulary.
 *  - Uses `gpt-5.5` via the Responses API + reasoning by default; the global
 *    `OPENAI_MODEL` env var still overrides. Per-route `OPENAI_*_MODEL`
 *    overrides are gone.
 *  - On any failure (no key, network error, timeout, malformed JSON, length
 *    mismatch), the route falls back to a canonical-capability-map-derived
 *    list. This file is pure "try LLM"; the route owns the fallback.
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

export type LLMGenerateL4Row = {
  /** L2 Job Grouping — for prompt context. */
  l2: string;
  /** L3 Job Family — for prompt context. */
  l3: string;
  /**
   * L4 Activity Group — the row whose L5 Activities the LLM should
   * generate. Optional only for back-compat: if absent we fall back to
   * `l3` (legacy V4 callers that haven't been swept yet).
   */
  l4?: string;
  /**
   * Optional free-form qualitative feedback from the user to steer the
   * activity list for this row. Used by the per-row "Refine + regenerate"
   * affordance on Step 4. The system prompt instructs the model to honor
   * the user's intent (e.g. split an activity by sub-segment, add a named
   * activity) WITHOUT bypassing the Versant-grounded constraints (real
   * brands, named vendors, no hedge language). Sanitized server-side to
   * ≤600 chars before this struct is built.
   */
  feedback?: string;
  /**
   * Optional L2 / L3 / L4 narrative context. Server route looks these
   * up from the canonical map (`resolveRowDescriptions`) before invoking;
   * when present, the user prompt renders a per-row "ROW NARRATIVE
   * CONTEXT" block so the model has explicit grounding instead of
   * inferring from the row label alone. Omitted on towers that
   * haven't been description-authored.
   */
  l2Description?: string;
  l3Description?: string;
  l4Description?: string;
};

export type LLMGenerateL4Result = {
  l2: string;
  l3: string;
  /** Echoes the input `l4` (Activity Group). Empty string for legacy callers. */
  l4: string;
  /** Generated L5 Activity names under the Activity Group. */
  activities: string[];
};

export type GenerateL4Options = {
  /**
   * Test-only model override. Production callers should let the kit resolve
   * the model from `OPENAI_MODEL` (or the default `gpt-5.5`).
   */
  model?: string;
  timeoutMs?: number;
  /** Min activities per L3 (default 4). */
  minPerL3?: number;
  /** Max activities per L3 (default 8). */
  maxPerL3?: number;
};

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MIN = 4;
const DEFAULT_MAX = 8;

export function isLLMConfigured(): boolean {
  return kitIsLLMConfigured();
}

class LLMError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "LLMError";
  }
}

function buildSystemPrompt(
  towerId: TowerId,
  minPerL3: number,
  maxPerL3: number,
): string {
  return [
    "You generate L5 Activity lists for Versant Media Group capability-map rows.",
    "",
    "The capability map is 5-layer:",
    "  L1 Function (e.g. Finance) > L2 Job Grouping > L3 Job Family > L4 Activity Group > L5 Activity",
    "Tower leads upload at the L4 Activity Group grain; you generate the L5 Activities (the leaf work) under each Activity Group.",
    "",
    buildVersantPreamble({ grain: "row" }),
    "",
    buildTowerContextBlock(towerId),
    "",
    "For every (L2 Job Grouping / L3 Job Family / L4 Activity Group) row I send, return a list of CONCRETE WORK ACTIVITIES (the L5 Activities) that an analyst, manager, or operator inside that Activity Group actually performs. Each activity is 2-6 words, action-oriented (verb-noun), specific enough that a Versant tower lead can recognise it as real work.",
    "",
    "VERSANT-SPECIFIC AUTHORING GUIDANCE:",
    "  - Name real systems where they fit. The tower context block above lists the vendor stack that anchors this tower; pick from there or from the broader allow-list below.",
    "  - Reflect the multi-entity JV / TSA carve-out / split-rights / political brand sensitivity / new-public-company SEC obligations where relevant.",
    "  - Avoid generic verbs ('manage', 'support', 'coordinate') unless followed by a specific Versant artefact ('coordinate Olympics talent rotation' is fine; bare 'coordinate work' is not).",
    "  - Activities must be Versant-recognisable. If the activity could appear unchanged at any media company, rewrite it to attach a Versant brand, structural constraint, or vendor.",
    "",
    buildVoiceRulesBlock(),
    "",
    buildAllowListsBlock({ includePeople: false, includeVendors: true }),
    "",
    "When per-row user feedback is provided, honor the user's intent (e.g., split an activity by linear vs digital, add a named activity like 'Schedule make-up artists') — BUT this never overrides the Versant-grounded constraints above. Real brands, real vendors, no hedge language, no generic-media-company copy.",
    "",
    `Return STRICT JSON ONLY in this exact shape, with one item per input row, IN INPUT ORDER. Each row gets ${minPerL3}-${maxPerL3} L5 Activities (closer to ${minPerL3} for narrow Activity Groups, closer to ${maxPerL3} for broad ones):`,
    '{"items": [{"activities": ["<L5 Activity 1>", "<L5 Activity 2>", ...]}, ...]}',
    "",
    "Do not return any prose outside the JSON. Do not skip rows. Do not add extra rows.",
  ].join("\n");
}

function buildUserPrompt(rows: LLMGenerateL4Row[]): string {
  const lines: string[] = [];
  rows.forEach((r, i) => {
    const l4 = r.l4 ?? "";
    if (l4) {
      lines.push(
        `${i + 1}. L2 Job Grouping="${truncate(r.l2)}" / L3 Job Family="${truncate(r.l3)}" / L4 Activity Group="${truncate(l4)}"`,
      );
    } else {
      // Legacy v4 caller (only sent l2 + l3); treat l3 as the parent.
      lines.push(`${i + 1}. L2="${truncate(r.l2)}" / L3="${truncate(r.l3)}"`);
    }
    if (r.feedback && r.feedback.trim()) {
      lines.push(`   User feedback to honor: "${truncate(r.feedback, 600)}"`);
    }
    const ctxBlock = renderRowDescriptionBlock(r);
    if (ctxBlock) lines.push(ctxBlock);
  });
  return [
    `Generate L5 Activities for these ${rows.length} Activity Group rows. Preserve order.`,
    "When a row carries a NARRATIVE CONTEXT block, use it as the source of truth for what work happens inside that Activity Group — the activities you generate must be specific to that context, not generic guesses from the row label.",
    "",
    ...lines,
  ].join("\n");
}

/**
 * Render the per-row narrative context sub-block. Returns the empty
 * string when no description fields are populated, so the user prompt
 * stays compact for towers that haven't been authored yet.
 */
function renderRowDescriptionBlock(row: LLMGenerateL4Row): string {
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

/**
 * Calls OpenAI to generate L5 Activity lists for a batch of L4 Activity
 * Group rows (V5 grain). Function name retained from V4 for back-compat.
 * Throws on any failure — caller must provide its own deterministic
 * fallback.
 */
export async function generateL4ActivitiesWithLLM(
  towerId: TowerId,
  rows: LLMGenerateL4Row[],
  options: GenerateL4Options = {},
): Promise<LLMGenerateL4Result[]> {
  if (!kitIsLLMConfigured()) {
    throw new LLMError("OPENAI_API_KEY not set");
  }
  if (!rows.length) return [];

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const minPerL3 = Math.max(1, Math.floor(options.minPerL3 ?? DEFAULT_MIN));
  const maxPerL3 = Math.max(minPerL3, Math.floor(options.maxPerL3 ?? DEFAULT_MAX));

  let parsed: unknown;
  try {
    const result = await buildLLMRequest({
      systemPrompt: buildSystemPrompt(towerId, minPerL3, maxPerL3),
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

  return items.map((raw, i) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    const inputRow = rows[i];
    const list = Array.isArray(item.activities) ? item.activities : [];
    const activities = list
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim())
      .slice(0, maxPerL3);
    return {
      l2: inputRow.l2,
      l3: inputRow.l3,
      l4: inputRow.l4 ?? "",
      activities,
    };
  });
}
