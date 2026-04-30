/**
 * Server-only OpenAI helper for L4-level AI initiative curation.
 *
 * One batched call per tower scores every L4 across every queued L3 row in a
 * single request. The model returns the full Stage 2 (verdict) + Stage 3
 * (curation summary) shape — eligibility, priority, rationale, vendor, agent
 * one-liner — and the caller stamps it onto the persisted `L4Item.l4Items`
 * array so the AI Initiatives view-model can read straight from the cache.
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
  AiPriority,
  TowerProcessCriticality,
  TowerProcessFrequency,
  TowerProcessMaturity,
} from "@/data/types";
import type { AiCurationStatus } from "@/data/capabilityMap/types";
import type { NotEligibleReason, TowerId } from "@/data/assess/types";

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 90_000;

/** Hard ceiling per tower per call. The pipeline batches by tower already. */
export const MAX_L4S_PER_CALL = 100;

export type CurateLLMRowInput = {
  /** Round-tripped so the caller can match results back without name fuzzing. */
  rowId: string;
  l2: string;
  l3: string;
  l4Activities: string[];
};

/** One scored L4 — server-validated shape returned to the caller. */
export type CurateLLMItem = {
  name: string;
  aiCurationStatus: AiCurationStatus;
  aiEligible: boolean;
  aiPriority?: AiPriority;
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
  l4Items: CurateLLMItem[];
};

export type CurateLLMOptions = {
  /** Override env (`OPENAI_CURATE_INITIATIVES_MODEL` then `OPENAI_MODEL`; default `gpt-4o-mini`). */
  model?: string;
  timeoutMs?: number;
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

function buildSystemPrompt(towerId: TowerId): string {
  const towerContext =
    TOWER_CONTEXT[towerId] ?? "Versant tower (context not authored).";
  return [
    "You curate Versant Media Group L4 activities for an AI initiatives agenda. Every output must be Versant-specific and declarative — never generic.",
    "",
    "Versant Media Group (NASDAQ: VSNT) is the spin-off of NBCUniversal's news, sports, streaming, digital portfolio: MS NOW, CNBC, Golf Channel, GolfNow, GolfPass, USA Network, E!, Syfy, Oxygen True Crime, Fandango, Rotten Tomatoes, SportsEngine, Free TV Networks. ~$6.7B revenue, ~$2.4B Adj. EBITDA, ~$2.75B debt (BB-), running on NBCU shared services until the TSA expires.",
    "",
    "For each L4 activity, return a verdict (Stage 2) plus a short curation summary (Stage 3). Eligible items get priority + frequency + criticality + maturity + primaryVendor + agentOneLine. Not-eligible items skip the curation fields and instead return one of the FIVE canonical reasons.",
    "",
    `Tower currently being scored: ${towerId} — ${towerContext}`,
    "",
    "Versant constraints you MUST respect:",
    "  - Editorial / news judgment / on-air talent / fact-checking / political coverage → reviewed-not-eligible with reason 'Requires human editorial judgment'.",
    "  - Negotiation, key-account, agency, carriage, talent / sports-rights deal-making → reviewed-not-eligible with reason 'Fundamentally relationship-driven'.",
    "  - Treasury / covenant / 10-K / disclosure / political-brand decisions → reviewed-not-eligible with reason 'Strategic exercise requiring executive judgment'.",
    "  - Live broadcast, master control, on-air ops, in-studio production → reviewed-not-eligible with reason 'Requires human editorial judgment' OR 'Strategic exercise requiring executive judgment' depending on context.",
    "",
    "Versant rationale guidance — be Versant-specific, concrete, declarative. NAME REAL BRANDS (MS NOW / CNBC / Golf Channel / GolfNow / GolfPass / USA Network / E! / Syfy / Fandango / Rotten Tomatoes / SportsEngine), the TSA carve-out, BB- credit, multi-entity JV, split rights, MS NOW progressive positioning. NEVER use hedge phrases ('potentially', 'could possibly', 'may help to', 'leverage AI'). NEVER write rationales that could apply to any media company.",
    "",
    "primaryVendor MUST be chosen from this allow-list (case-sensitive). For compound stacks, separate with ' + '. If no allow-list vendor fits, RETURN THE EXACT STRING 'TBD — subject to discovery' (em dash) — never invent a vendor.",
    "Allow-list:",
    VENDOR_ALLOW_LIST.map((v) => `  - ${v}`).join("\n"),
    "",
    "agentOneLine MUST describe what the agent does + the concrete saving. Example: 'Reconciliation Agent matches intercompany transactions across 7+ Versant entities, auto-resolves timing diffs, flags exceptions for human review.' Never write 'leverages AI' or 'transforms the workflow'.",
    "",
    "Return STRICT JSON ONLY in this exact shape, with one outer item per input row, in INPUT ORDER, and one inner item per L4 activity in EACH ROW'S INPUT ORDER:",
    '{"rows": [{"rowId": "<echo input rowId>", "l4Items": [',
    '  {',
    '    "name": "<echo L4 activity name verbatim>",',
    '    "aiEligible": <true|false>,',
    '    "aiPriority": "P1" | "P2" | "P3" | null,',
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
    "Use null for any field that doesn't apply (e.g., aiPriority on a not-eligible item). Eligible items MUST set aiPriority + aiRationale + frequency + criticality + currentMaturity + primaryVendor + agentOneLine. Not-eligible items MUST set notEligibleReason and aiRationale, leave the rest null.",
    "",
    "Do NOT skip rows. Do NOT add extra rows or extra L4 items. Echo `name` and `rowId` verbatim. Do NOT add prose outside the JSON object.",
  ].join("\n");
}

function buildUserPrompt(rows: CurateLLMRowInput[]): string {
  const lines: string[] = [];
  rows.forEach((r, ri) => {
    lines.push(`Row ${ri + 1} (rowId="${r.rowId}") — L2="${truncate(r.l2)}" / L3="${truncate(r.l3)}":`);
    r.l4Activities.forEach((name, ai) => {
      lines.push(`  ${ai + 1}. ${truncate(name, 200)}`);
    });
    lines.push("");
  });
  return [
    `Curate every L4 activity below. Echo \`rowId\` and \`name\` verbatim. Preserve order.`,
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
 * Normalize the LLM's short-form priority (the prompt asks for "P1" / "P2" /
 * "P3" because they're easier to score reliably) into the full em-dash
 * `AiPriority` string used everywhere else in the codebase. Also tolerates
 * full-string responses in case the model decides to echo the prompt.
 */
function sanitizePriority(raw: unknown): AiPriority | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (trimmed === "P1" || trimmed.startsWith("P1")) return "P1 — Immediate (0-6mo)";
  if (trimmed === "P2" || trimmed.startsWith("P2")) return "P2 — Near-term (6-12mo)";
  if (trimmed === "P3" || trimmed.startsWith("P3")) return "P3 — Medium-term (12-24mo)";
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
 * Calls OpenAI to curate every L4 across every row in a single batched
 * request. Throws an `LLMError` on any failure — caller owns the
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
  const totalL4s = rows.reduce((s, r) => s + r.l4Activities.length, 0);
  if (totalL4s === 0) return rows.map((r) => ({ rowId: r.rowId, l4Items: [] }));
  if (totalL4s > MAX_L4S_PER_CALL) {
    throw new LLMError(
      `Tower has ${totalL4s} L4 activities; max ${MAX_L4S_PER_CALL} per call.`,
    );
  }

  const model =
    options.model ??
    process.env.OPENAI_CURATE_INITIATIVES_MODEL?.trim() ??
    process.env.OPENAI_MODEL?.trim() ??
    DEFAULT_MODEL;
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
    const llmItems = Array.isArray(llmRow.l4Items)
      ? (llmRow.l4Items as unknown[])
      : [];
    if (llmItems.length !== input.l4Activities.length) {
      throw new LLMError(
        `Row ${input.rowId}: model returned ${llmItems.length} items for ${input.l4Activities.length} L4 activities`,
      );
    }
    const l4Items: CurateLLMItem[] = input.l4Activities.map((expectedName, ai) => {
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
        aiPriority: sanitizePriority(item.aiPriority),
        frequency: sanitizeFrequency(item.frequency),
        criticality: sanitizeCriticality(item.criticality),
        currentMaturity: sanitizeMaturity(item.currentMaturity),
        primaryVendor: sanitizeVendor(item.primaryVendor),
        agentOneLine: sanitizeText(item.agentOneLine, 280),
      };
    });
    return { rowId: input.rowId, l4Items };
  });
}
