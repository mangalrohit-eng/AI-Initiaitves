/**
 * Server-only OpenAI helper for lazy AIProcessBrief generation.
 *
 * Fired only when a tower lead clicks into an LLM-curated L4 that has no
 * hand-curated brief overlay match. The result is cached on the parent
 * `L4Item.generatedBrief` so subsequent visits skip the LLM call entirely.
 *
 * Design notes:
 *  - One L4 per call. The payload is small (single name + parent context +
 *    L4 verdict summary) so we don't batch — keeps the lazy path snappy and
 *    the prompt focused.
 *  - Versant-grounded prompt mirrors `curateInitiativesLLM.ts` so the brief
 *    stays consistent with the L4 card summary the user just clicked on.
 *  - Vendor allow-list enforcement: `toolsRequired` items must come from the
 *    same allow-list used by `curateInitiativesLLM.ts` (re-imported below).
 *    Hallucinated entries are stripped or replaced with the canonical
 *    `"TBD — subject to discovery"` string.
 *  - On any failure (no key, network, timeout, malformed JSON) the helper
 *    throws an `LLMError`; the route owns the deterministic fallback.
 */

import type { TowerId } from "@/data/assess/types";
import { VENDOR_ALLOW_LIST } from "./curateInitiativesLLM";

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 60_000;
const VENDOR_TBD = "TBD — subject to discovery";

const VENDOR_ALLOW_LOWER = new Set(
  VENDOR_ALLOW_LIST.map((v) => v.toLowerCase()),
);

const TOWER_BRAND_HINT: Record<TowerId, string> = {
  finance: "Multi-entity JV close, BlackLine GL, BB- credit covenant context.",
  hr: "~9K employees across union (writers, IATSE, NABET) + non-union talent.",
  "research-analytics": "Audience measurement across linear, FAST, streaming, digital.",
  legal: "GC + commercial + IP for sports rights, news brands (CNBC, MS NOW), split-rights IP.",
  "corp-services": "Real estate, facilities, EHS, indirect procurement across studio + corporate.",
  "tech-engineering": "Streaming, GolfNow / GolfPass, Fandango, Rotten Tomatoes, ad-tech.",
  "operations-technology": "Broadcast operations, playout, on-air technology — physical, US-required.",
  sales: "National + local ad sales (greenfield post-TSA), affiliate carriage, sponsorship.",
  "marketing-comms": "Brand marketing across MS NOW / CNBC / Golf / Free TV / Fandango.",
  service: "Customer service for GolfNow, GolfPass, Fandango.",
  "editorial-news": "Newsroom for CNBC, MS NOW, Golf Channel, USA Network sports — editorial judgment stays human.",
  production: "Live and studio production — sets, control rooms, talent, on-air ops.",
  "programming-dev": "Programming strategy, scheduling, content acquisition / dev — strategic.",
};

export type CurateBriefLLMInput = {
  towerId: TowerId;
  l2: string;
  l3: string;
  l4Name: string;
  /** Round-tripped from the persisted L4Item — keeps the brief consistent with the card. */
  aiRationale: string;
  agentOneLine?: string;
  primaryVendor?: string;
};

export type CurateBriefLLMResult = {
  preState: string;
  postState: string;
  agentsInvolved: { name: string; role: string }[];
  toolsRequired: string[];
  keyMetric: string;
};

export type CurateBriefLLMOptions = {
  model?: string;
  timeoutMs?: number;
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

function buildSystemPrompt(towerId: TowerId): string {
  const towerHint =
    TOWER_BRAND_HINT[towerId] ?? "Versant tower (context not authored).";
  return [
    "You author Versant Media Group AI Process Briefs — short, declarative narratives an executive can read in under a minute. Every line must be Versant-specific.",
    "",
    "Versant Media Group (NASDAQ: VSNT) is the spin-off of NBCUniversal's news, sports, streaming, and digital portfolio: MS NOW, CNBC, Golf Channel, GolfNow, GolfPass, USA Network, E!, Syfy, Oxygen True Crime, Fandango, Rotten Tomatoes, SportsEngine, Free TV Networks. ~$6.7B revenue, ~$2.4B Adj. EBITDA, ~$2.75B debt (BB-), running on NBCU shared services until the TSA expires.",
    "",
    `Tower currently being briefed: ${towerId} — ${towerHint}`,
    "",
    "Brief shape (return ALL fields, every value Versant-specific, declarative voice):",
    "  - preState: 2-3 sentences describing the CURRENT manual workflow + concrete pain (cycle time, error rate, headcount cost, named system gap, named brand context).",
    "  - postState: 2-3 sentences describing the FUTURE agent-led workflow + the concrete improvement (e.g., 'Close days reduced from 12-18 to 5-7').",
    "  - agentsInvolved: 1-3 named agents. Each has a `name` (Title Case noun phrase, e.g., 'Reconciliation Agent') and a `role` (≤20 words, what it does in this workflow).",
    "  - toolsRequired: 1-4 named vendor strings from the allow-list, OR 'TBD — subject to discovery' (em dash, exact). Never invent a vendor.",
    "  - keyMetric: ONE quantified success measure ('Close days from 12-18 → 5-7', '85%+ straight-through invoice processing', '40% lift in subscriber retention'). Never qualitative.",
    "",
    "Style rules:",
    "  - Name brands (MS NOW / CNBC / Golf Channel / GolfNow / GolfPass / USA Network / E! / Syfy / Fandango / Rotten Tomatoes / SportsEngine), the TSA carve-out, BB- credit, multi-entity JV, MS NOW progressive positioning, on-air talent, split rights, where they fit.",
    "  - Never use hedge phrases ('potentially', 'could possibly', 'may help to', 'leverage AI', 'transformative', 'best-in-class').",
    "  - Never write copy that could apply to any media company.",
    "  - Never invent financials, headcount counts, or specific dollar figures not implied by the input. When unknown use 'TBD — subject to discovery'.",
    "",
    "Vendor allow-list (case-insensitive match, compound stacks separated by ' + '):",
    VENDOR_ALLOW_LIST.map((v) => `  - ${v}`).join("\n"),
    `  - ${VENDOR_TBD} (use this when no allow-list vendor fits)`,
    "",
    "Return STRICT JSON ONLY in this exact shape:",
    '{"preState": "<...>", "postState": "<...>", "agentsInvolved": [{"name": "...", "role": "..."}], "toolsRequired": ["..."], "keyMetric": "..."}',
    "",
    "No prose outside the JSON. No additional fields.",
  ].join("\n");
}

function buildUserPrompt(input: CurateBriefLLMInput): string {
  const lines = [
    `L2: ${truncate(input.l2)}`,
    `L3: ${truncate(input.l3)}`,
    `L4: ${truncate(input.l4Name, 200)}`,
    `Card rationale: ${truncate(input.aiRationale, 320)}`,
  ];
  if (input.agentOneLine) {
    lines.push(`Agent summary: ${truncate(input.agentOneLine, 280)}`);
  }
  if (input.primaryVendor) {
    lines.push(`Primary vendor on the card: ${input.primaryVendor}`);
  }
  return [
    "Author the brief for this single L4. Stay consistent with the card rationale and agent summary so the user reads one continuous story.",
    "",
    ...lines,
  ].join("\n");
}

function truncate(s: string, max = 160): string {
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function sanitizeText(raw: unknown, maxLen: number): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen - 1)}…` : trimmed;
}

function sanitizeVendor(raw: unknown): string {
  if (typeof raw !== "string") return VENDOR_TBD;
  const trimmed = raw.trim();
  if (!trimmed) return VENDOR_TBD;
  if (trimmed === VENDOR_TBD) return VENDOR_TBD;
  const parts = trimmed.split(/\s*\+\s*/);
  const allOk = parts.every((p) => {
    if (p.toLowerCase() === "llm") return true;
    return VENDOR_ALLOW_LOWER.has(p.toLowerCase());
  });
  return allOk ? parts.join(" + ") : VENDOR_TBD;
}

function sanitizeAgents(
  raw: unknown,
): { name: string; role: string }[] {
  if (!Array.isArray(raw)) return [];
  const agents: { name: string; role: string }[] = [];
  for (const a of raw) {
    if (!a || typeof a !== "object") continue;
    const o = a as Record<string, unknown>;
    const name = sanitizeText(o.name, 120);
    const role = sanitizeText(o.role, 220);
    if (name && role) agents.push({ name, role });
    if (agents.length >= 4) break;
  }
  return agents;
}

function sanitizeTools(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const tools: string[] = [];
  for (const t of raw) {
    const v = sanitizeVendor(t);
    if (!tools.includes(v)) tools.push(v);
    if (tools.length >= 6) break;
  }
  return tools;
}

/**
 * Calls OpenAI for a single L4 brief. Throws `LLMError` on any failure —
 * caller owns the deterministic fallback path (same contract as
 * `curateInitiativesLLM.ts`).
 */
export async function curateBriefWithLLM(
  input: CurateBriefLLMInput,
  options: CurateBriefLLMOptions = {},
): Promise<CurateBriefLLMResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new LLMError("OPENAI_API_KEY not set");
  }

  const model =
    options.model ?? process.env.OPENAI_MODEL?.trim() ?? DEFAULT_MODEL;
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
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemPrompt(input.towerId) },
          { role: "user", content: buildUserPrompt(input) },
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
  const o = parsed as Record<string, unknown>;
  const preState = sanitizeText(o.preState, 800);
  const postState = sanitizeText(o.postState, 800);
  const keyMetric = sanitizeText(o.keyMetric, 240);
  if (!preState || !postState || !keyMetric) {
    throw new LLMError(
      "OpenAI brief missing required fields (preState / postState / keyMetric)",
    );
  }
  const agentsInvolved = sanitizeAgents(o.agentsInvolved);
  if (agentsInvolved.length === 0) {
    throw new LLMError("OpenAI brief returned zero valid agents");
  }
  const toolsRequired = sanitizeTools(o.toolsRequired);
  if (toolsRequired.length === 0) {
    throw new LLMError("OpenAI brief returned zero valid tools");
  }

  return { preState, postState, agentsInvolved, toolsRequired, keyMetric };
}
