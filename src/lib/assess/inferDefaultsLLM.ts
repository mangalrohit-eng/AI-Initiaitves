/**
 * Server-only OpenAI helper for inferring per-L4 offshore% / AI% on Versant
 * capability map rows. Used when a tower lead uploads a brand-new L1-L4
 * hierarchy whose labels won't match the deterministic keyword rules in
 * `seedAssessmentDefaults.ts`.
 *
 * Design notes:
 *  - Single batched call per tower (one request, N row scores back). We do NOT
 *    call OpenAI per row — too slow, too expensive, and unnecessary since the
 *    model can score the whole list in one shot with consistent reasoning.
 *  - Uses Chat Completions JSON mode (`response_format: { type: "json_object" }`)
 *    so we can `JSON.parse` the response without retries.
 *  - The system prompt is grounded in Versant-specific context (TSA expiration,
 *    political brand sensitivity for MS NOW, on-air talent, multi-entity JV,
 *    BB- credit rating) so the model doesn't generate generic media-company
 *    averages.
 *  - On any failure (no key, network error, timeout, malformed JSON, length
 *    mismatch) the caller should fall back to the deterministic heuristic.
 *    This file does not contain the fallback itself — it's pure "try LLM."
 */

import type { TowerId } from "@/data/assess/types";

export type LLMRowInput = {
  l2: string;
  l3: string;
  l4: string;
};

export type LLMRowResult = {
  offshorePct: number;
  aiPct: number;
  rationale?: string;
};

export type InferLLMOptions = {
  /** Override `OPENAI_MODEL` env (default `gpt-4o-mini`). */
  model?: string;
  /** Abort timeout in ms (default 60_000). */
  timeoutMs?: number;
};

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 60_000;

const OFFSHORE_MIN = 5;
const OFFSHORE_MAX = 85;
const AI_MIN = 10;
const AI_MAX = 75;

/** Tower-level priors are still useful as anchor context for the LLM. */
const TOWER_CONTEXT: Record<TowerId, string> = {
  finance: "Finance & treasury for a newly public BB-rated company. Heavy AP/AR/reconciliation routine + TSA-driven SEC reporting build-out + treasury covenant monitoring (high consequence).",
  hr: "HR for ~9K employees across union (writers, IATSE, NABET) and non-union talent in US studio + corporate. New SEC issuer, new payroll stack post-TSA.",
  "research-analytics": "Audience, ad measurement, viewership analytics across linear, FAST, streaming, and digital. Heavy data work; some currency/methodology negotiation with MRC and JIC.",
  legal: "GC + commercial + IP + regulatory + litigation for a US-listed media company with sports rights, news brands (CNBC, MS NOW), and split-rights entertainment IP (e.g., Kardashians on-air vs streaming).",
  "corp-services": "Real estate, facilities, EHS, indirect procurement, travel, office services for ~9K headcount across studio + corporate sites. Mostly US-physical work.",
  "tech-engineering": "Product + platform engineering for streaming (Peacock-adjacent), GolfNow / GolfPass apps, Fandango, Rotten Tomatoes, ad-tech. Already partially offshored / contractor-heavy.",
  "operations-technology": "Broadcast operations, media supply chain, playout, studio ops, on-air technology — physical, on-prem, low-latency, US-required.",
  sales: "National + local ad sales (greenfield post-TSA — Versant is standing up its own ad-sales org for the first time), affiliate carriage, sponsorship, branded content. Relationship-driven.",
  "marketing-comms": "Brand marketing, PR, comms, social, growth marketing across all consumer brands. Mix of high-touch creative (US) + executable analytics (offshorable).",
  service: "Customer service / subscriber support for direct-to-consumer products (GolfNow, GolfPass, Fandango, etc.). High volume, AI-friendly, classically offshorable.",
  "editorial-news": "Newsroom for CNBC, MS NOW, Golf Channel, USA Network sports, NBC News-adjacent. EDITORIAL JUDGMENT IS NOT OFFSHORABLE — anchors, reporters, fact-checking, news judgment, political coverage are all US-required and AI-restricted.",
  production: "Live and studio production — sets, control rooms, talent, on-air operations. Physical, US-located, talent-relationship-driven.",
  "programming-dev": "Programming strategy, scheduling, content acquisition / dev — strategic, deal-making, executive judgment.",
};

/** Returns true iff `OPENAI_API_KEY` is configured. Cheap, no network call. */
export function isLLMConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

class LLMError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "LLMError";
  }
}

function buildSystemPrompt(towerId: TowerId): string {
  const towerContext = TOWER_CONTEXT[towerId] ?? "Versant tower (context not authored).";
  return [
    "You score Versant Media Group capability-map rows for a workshop.",
    "",
    "Versant Media Group (NASDAQ: VSNT) is the spin-off of NBCUniversal's news, sports, streaming, and digital portfolio: MS NOW, CNBC, Golf Channel, GolfNow, GolfPass, USA Network, E!, Syfy, Oxygen True Crime, Fandango, Rotten Tomatoes, SportsEngine, Free TV Networks. ~$6.7B revenue, ~$2.4B Adj. EBITDA, ~$2.75B debt (BB-), running on NBCU shared services until the TSA expires.",
    "",
    "For every L2 / L3 / L4 row I send you, return TWO scores:",
    "  - offshorePct (5-85, integer, multiple of 5): share of the WORK that can plausibly move to a global delivery centre (India/Philippines/etc.). LOWER for editorial judgment, on-air talent, US-physical work, deal-making, regulator-facing work, high-trust client relationships, brand strategy. HIGHER for routine processing (AP, AR, reconciliation, payroll), helpdesk, data prep, analytics support, software test, document review.",
    "  - aiPct (10-75, integer, multiple of 5): share of the WORK that AI (LLMs, agents, classifiers, copilots) can realistically displace or 10x today. HIGHER for summarization, transcription, captioning, translation, document review, anomaly detection, monitoring, lead scoring, structured extraction. LOWER for executive judgment, in-person relationships, on-camera work, crisis decisions.",
    "",
    "Versant-specific constraints you MUST respect:",
    "  - Editorial / news judgment / on-air talent / fact-checking / political coverage → very low offshore + low AI (AP-style summarization OK; final judgment must stay onshore + human).",
    "  - MS NOW progressive positioning → political brand sensitivity, low AI for any user-facing crisis-detection or content output.",
    "  - Sales is GREENFIELD post-TSA — relationship-driven, mostly US-onshore for now; AI-augmentation OK (lead scoring, outreach drafting).",
    "  - BB- credit rating → Treasury / covenant / debt management is high-consequence; humans stay in the loop.",
    "  - Multi-entity JV, split-rights deals (e.g., Kardashians on-air retained, streaming to Hulu) → rights & legal complexity = lower offshore, AI-augmentable for first-pass.",
    "  - Operations-technology / production / studio ops are PHYSICAL — low offshore (work happens at the venue/studio), low-medium AI.",
    "",
    `Tower currently being scored: ${towerId} — ${towerContext}`,
    "",
    "Return STRICT JSON ONLY in this exact shape, with one item per input row, in INPUT ORDER:",
    '{"items": [{"offshorePct": <int>, "aiPct": <int>, "rationale": "<≤15 words why>"}, ...]}',
    "",
    "Do not return any prose outside the JSON. Do not skip rows. Do not add extra rows. Always return integers (not floats) and round to the nearest 5.",
  ].join("\n");
}

function buildUserPrompt(rows: LLMRowInput[]): string {
  const lines = rows.map(
    (r, i) => `${i + 1}. L2="${truncate(r.l2)}" / L3="${truncate(r.l3)}" / L4="${truncate(r.l4)}"`,
  );
  return [
    `Score these ${rows.length} rows. Preserve order.`,
    "",
    ...lines,
  ].join("\n");
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
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new LLMError("OPENAI_API_KEY not set");
  }
  if (!rows.length) return [];

  const model = options.model ?? process.env.OPENAI_MODEL?.trim() ?? DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

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
          { role: "system", content: buildSystemPrompt(towerId) },
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

  return items.map((raw) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    return {
      offshorePct: clampRound5(item.offshorePct, OFFSHORE_MIN, OFFSHORE_MAX),
      aiPct: clampRound5(item.aiPct, AI_MIN, AI_MAX),
      rationale:
        typeof item.rationale === "string" && item.rationale.trim()
          ? item.rationale.trim()
          : undefined,
    };
  });
}
