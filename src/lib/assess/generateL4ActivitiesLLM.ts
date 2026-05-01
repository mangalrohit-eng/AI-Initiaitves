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
 * Design notes:
 *  - Single batched call per tower. The model returns 4-8 short activity
 *    names per Activity Group — enough to be useful in the map, not so
 *    many that the UI drowns.
 *  - Versant-grounded system prompt (TSA expiration, MS NOW progressive
 *    positioning, multi-entity JV close, BB- credit) so the activities
 *    reflect Versant's wrinkles instead of generic media-company placeholders.
 *  - On any failure (no key, network error, timeout, malformed JSON, length
 *    mismatch), the route falls back to a canonical-capability-map-derived
 *    list. This file is pure "try LLM"; the route owns the fallback.
 */

import type { TowerId } from "@/data/assess/types";

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
  /** Override env (`OPENAI_GENERATE_L4_MODEL` then `OPENAI_MODEL`; default `gpt-4o-mini`). */
  model?: string;
  timeoutMs?: number;
  /** Min activities per L3 (default 4). */
  minPerL3?: number;
  /** Max activities per L3 (default 8). */
  maxPerL3?: number;
};

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MIN = 4;
const DEFAULT_MAX = 8;

const TOWER_CONTEXT: Record<TowerId, string> = {
  finance: "Finance & treasury for newly-public BB-rated Versant Media Group. Multi-entity JV close, NBCU TSA carve-out, SEC reporting build-out, treasury covenant monitoring, BlackLine-style reconciliation across 7+ Versant entities.",
  hr: "HR for ~9K employees across union (writers, IATSE, NABET) and non-union talent at Versant. Eightfold-style talent matching, on-air talent management, payroll carve-out from NBCU TSA.",
  "research-analytics": "Audience measurement and ad analytics for MS NOW, CNBC, Golf, USA Network, E!, Syfy across linear, FAST, streaming, digital. MRC / JIC measurement currency work, LiveRamp identity, Piano subscription analytics.",
  legal: "Legal & regulatory for Versant. Sports rights, news brand counsel (CNBC, MS NOW), split-rights deals (Kardashians on-air retained, streaming to Hulu), SEC disclosure, M&A.",
  "corp-services": "Real estate, facilities, EHS, indirect procurement, travel, office services across Versant studio + corporate sites.",
  "tech-engineering": "Product + platform engineering for streaming, GolfNow / GolfPass, Fandango, Rotten Tomatoes, ad-tech.",
  "operations-technology": "Broadcast operations, media supply chain, playout, studio ops, on-air technology — Amagi cloud playout, MAM, transmission.",
  sales: "National + local ad sales (greenfield post-TSA — Versant is standing up its own ad-sales org), affiliate carriage, sponsorship, branded content.",
  "marketing-comms": "Brand marketing, PR, comms, social, growth marketing across MS NOW, CNBC, Golf, Free TV, USA, E!, Fandango.",
  service: "Customer service / subscriber support for direct-to-consumer products (GolfNow, GolfPass, Fandango, SportsEngine).",
  "editorial-news": "Newsroom for CNBC, MS NOW, Golf Channel, USA Network sports, NBC News-adjacent. Brian Carovillano-led editorial standards, MS NOW progressive positioning.",
  production: "Live and studio production — sets, control rooms, talent, on-air operations. Per-episode and per-event work.",
  "programming-dev": "Programming strategy, scheduling, content development, content acquisition, sports rights operations.",
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

function buildSystemPrompt(
  towerId: TowerId,
  minPerL3: number,
  maxPerL3: number,
): string {
  const towerContext = TOWER_CONTEXT[towerId] ?? "Versant tower (context not authored).";
  return [
    "You generate L5 Activity lists for Versant Media Group capability-map rows.",
    "",
    "The capability map is 5-layer:",
    "  L1 Function (e.g. Finance) > L2 Job Grouping > L3 Job Family > L4 Activity Group > L5 Activity",
    "Tower leads upload at the L4 Activity Group grain; you generate the L5 Activities (the leaf work) under each Activity Group.",
    "",
    "Versant Media Group (NASDAQ: VSNT) is the spin-off of NBCUniversal's news, sports, streaming, and digital portfolio: MS NOW, CNBC, Golf Channel, GolfNow, GolfPass, USA Network, E!, Syfy, Oxygen True Crime, Fandango, Rotten Tomatoes, SportsEngine, Free TV Networks. ~$6.7B revenue, ~$2.4B Adj. EBITDA, ~$2.75B debt (BB-), running on NBCU shared services until the TSA expires.",
    "",
    "For every (L2 Job Grouping / L3 Job Family / L4 Activity Group) row I send, return a list of CONCRETE WORK ACTIVITIES (the L5 Activities) that an analyst, manager, or operator inside that Activity Group actually performs. Each activity is 2-6 words, action-oriented (verb-noun), specific enough that a Versant tower lead can recognise it as real work.",
    "",
    "Versant-specific guidance:",
    "  - Name real systems where they fit (BlackLine for reconciliation, Eightfold for talent, Amagi for playout, Descript for editing, LiveRamp for identity, Piano for paywalls, Deepgram for transcription).",
    "  - Reflect the multi-entity JV / TSA carve-out / split-rights / political brand sensitivity / new-public-company SEC obligations where relevant.",
    "  - Avoid generic verbs ('manage', 'support', 'coordinate') unless followed by a specific Versant artefact.",
    "",
    `Tower currently being scored: ${towerId} — ${towerContext}`,
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
  });
  return [
    `Generate L5 Activities for these ${rows.length} Activity Group rows. Preserve order.`,
    "",
    ...lines,
  ].join("\n");
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
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new LLMError("OPENAI_API_KEY not set");
  }
  if (!rows.length) return [];

  const model =
    options.model ??
    process.env.OPENAI_GENERATE_L4_MODEL?.trim() ??
    process.env.OPENAI_MODEL?.trim() ??
    DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const minPerL3 = Math.max(1, Math.floor(options.minPerL3 ?? DEFAULT_MIN));
  const maxPerL3 = Math.max(minPerL3, Math.floor(options.maxPerL3 ?? DEFAULT_MAX));

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
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemPrompt(towerId, minPerL3, maxPerL3) },
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
    throw new LLMError(`OpenAI ${res.status}: ${text.slice(0, 400) || res.statusText}`);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch (e) {
    throw new LLMError("OpenAI returned non-JSON body", e);
  }
  const content =
    (body as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new LLMError("OpenAI returned empty content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new LLMError("OpenAI content was not valid JSON", e);
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
