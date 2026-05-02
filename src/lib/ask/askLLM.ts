/**
 * Ask Forge — server-side OpenAI call + strict output validation.
 *
 * Mirrors `crossTowerPlanLLM.ts`:
 *   - Chat Completions JSON mode by default; Responses API for GPT-5 family.
 *   - AbortController-based timeout.
 *   - All env reads server-only.
 *   - Reuses `resolveOpenAiBaseUrl()` for OpenAI-compatible endpoints.
 *
 * Validation enforces the `AskAssistantResponse` schema and rejects
 * fabricated tower / brief ids and (when ClientMode is on) any modeled-$
 * figures emitted into ranking / metric / breakdown blocks.
 */

import "server-only";

import { towers } from "@/data/towers";
import { processBriefs } from "@/data/processBriefs";
import { resolveOpenAiBaseUrl } from "@/lib/llm/openaiBase";
import { ASK_PROMPT_VERSION, buildAskSystemPrompt, buildAskUserPrompt } from "./askPrompt";
import type {
  AskAssistantResponse,
  AskBlock,
  AskCitation,
  AskCitationKind,
  AskMetricBlock,
  AskRankingBlock,
  AskBreakdownBlock,
  AskCompareBlock,
  AskTowerSnapshotBlock,
  AskInitiativeBlock,
  AskBrandLensBlock,
  AskProseBlock,
  AskNoteBlock,
  AskRequestMessage,
  ProgramDigest,
} from "./types";

const DEFAULT_MODEL = "gpt-5.5";
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_TOKENS = 12_000;

type ReasoningEffort = "minimal" | "low" | "medium" | "high";
const DEFAULT_REASONING_EFFORT: ReasoningEffort = "low";

export class AskLLMError extends Error {
  code: "rate_limit" | "api_key_missing" | "prompt_too_large" | "network" | "validation_failed" | "timeout" | "unknown";
  retriable: boolean;
  constructor(
    message: string,
    code: AskLLMError["code"] = "unknown",
    retriable = false,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "AskLLMError";
    this.code = code;
    this.retriable = retriable;
  }
}

export function isAskLLMConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function resolveAskModel(): string {
  return (
    process.env.OPENAI_ASK_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    DEFAULT_MODEL
  );
}

function shouldUseResponsesApi(model: string): boolean {
  if (process.env.OPENAI_ASK_USE_CHAT_COMPLETIONS === "1") return false;
  const m = model.toLowerCase();
  return m.startsWith("gpt-5") || m.startsWith("o1") || m.startsWith("o3") || m.startsWith("o4");
}

function resolveReasoningEffort(): ReasoningEffort {
  const raw = process.env.OPENAI_ASK_REASONING_EFFORT?.trim().toLowerCase();
  if (raw === "minimal" || raw === "low" || raw === "medium" || raw === "high") return raw;
  return DEFAULT_REASONING_EFFORT;
}

function extractResponsesOutputText(body: unknown): string | null {
  const b = body as {
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };
  if (typeof b.output_text === "string" && b.output_text.trim()) {
    return b.output_text;
  }
  for (const item of b.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && typeof part.text === "string" && part.text.trim()) {
        return part.text;
      }
    }
  }
  return null;
}

export type AskLLMResult = {
  response: AskAssistantResponse;
  modelId: string;
  promptVersion: string;
  latencyMs: number;
  tokenUsage?: { prompt?: number; completion?: number; total?: number };
};

/**
 * Call OpenAI for an Ask Forge turn. Returns a validated `AskAssistantResponse`
 * or throws `AskLLMError`.
 */
export async function generateAskAnswer(args: {
  messages: AskRequestMessage[];
  programDigest: ProgramDigest;
  clientMode: boolean;
  signal?: AbortSignal;
}): Promise<AskLLMResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new AskLLMError("OPENAI_API_KEY not set", "api_key_missing");
  }

  const modelId = resolveAskModel();
  const useResponses = shouldUseResponsesApi(modelId);
  const systemPrompt = buildAskSystemPrompt();
  const userPrompt = buildAskUserPrompt(args.messages, args.programDigest);

  const controller = new AbortController();
  const timeoutMs = Number(process.env.OPENAI_ASK_TIMEOUT_MS?.trim() || "") || DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (args.signal) {
    args.signal.addEventListener("abort", () => controller.abort());
  }
  const startedAt = Date.now();

  let res: Response;
  try {
    if (useResponses) {
      res = await fetch(`${resolveOpenAiBaseUrl()}/v1/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          instructions: systemPrompt,
          input: `Return a single JSON object exactly per the OUTPUT CONTRACT.\n\n${userPrompt}`,
          reasoning: { effort: resolveReasoningEffort() },
          max_output_tokens: DEFAULT_MAX_TOKENS,
          text: {
            format: { type: "json_object" },
            verbosity: "medium",
          },
        }),
        signal: controller.signal,
      });
    } else {
      res = await fetch(`${resolveOpenAiBaseUrl()}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          temperature: DEFAULT_TEMPERATURE,
          max_completion_tokens: DEFAULT_MAX_TOKENS,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
        signal: controller.signal,
      });
    }
  } catch (e) {
    clearTimeout(timer);
    if ((e as { name?: string })?.name === "AbortError") {
      throw new AskLLMError(`OpenAI call timed out after ${timeoutMs}ms`, "timeout", true, e);
    }
    throw new AskLLMError("OpenAI network error", "network", true, e);
  }
  clearTimeout(timer);
  const latencyMs = Date.now() - startedAt;

  const rawText = await res.text().catch(() => "");

  if (!res.ok) {
    const code: AskLLMError["code"] =
      res.status === 429
        ? "rate_limit"
        : res.status === 413
          ? "prompt_too_large"
          : res.status >= 500
            ? "network"
            : "unknown";
    throw new AskLLMError(
      `OpenAI ${res.status}: ${rawText.slice(0, 400) || res.statusText}`,
      code,
      code === "rate_limit" || code === "network",
    );
  }

  let body: unknown;
  try {
    body = rawText ? JSON.parse(rawText) : {};
  } catch (e) {
    throw new AskLLMError("OpenAI returned non-JSON body", "unknown", false, e);
  }

  let content: string | null;
  let usage: { prompt?: number; completion?: number; total?: number } | undefined;

  if (useResponses) {
    const status = (body as { status?: string }).status;
    if (status === "failed" || status === "cancelled") {
      const err = (body as { error?: { message?: string } }).error?.message;
      throw new AskLLMError(`OpenAI Responses status ${status}${err ? `: ${err}` : ""}`);
    }
    content = extractResponsesOutputText(body);
    const u = (body as {
      usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
    }).usage;
    if (u) {
      usage = { prompt: u.input_tokens, completion: u.output_tokens, total: u.total_tokens };
    }
  } else {
    content = (body as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content ?? null;
    const u = (body as {
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    }).usage;
    if (u) {
      usage = { prompt: u.prompt_tokens, completion: u.completion_tokens, total: u.total_tokens };
    }
  }

  if (typeof content !== "string" || !content.trim()) {
    throw new AskLLMError("OpenAI returned empty content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new AskLLMError("OpenAI content was not valid JSON", "validation_failed", false, e);
  }

  const validated = validateAskResponse(parsed, args.clientMode);

  return {
    response: validated,
    modelId,
    promptVersion: ASK_PROMPT_VERSION,
    latencyMs,
    tokenUsage: usage,
  };
}

/* ===========================================================================
 *   Validation — schema + grounding boundary
 * ========================================================================= */

const VALID_TOWER_IDS = new Set(towers.map((t) => t.id));
const VALID_BRIEF_IDS = new Set(processBriefs.map((b) => b.id));

const VALID_CITATION_KINDS: AskCitationKind[] = [
  "tower",
  "process",
  "brief",
  "workshopRow",
  "capNode",
  "versantContext",
];

export function validateAskResponse(raw: unknown, clientMode: boolean): AskAssistantResponse {
  if (!raw || typeof raw !== "object") {
    throw new AskLLMError("LLM response is not an object", "validation_failed");
  }
  const r = raw as Record<string, unknown>;

  const blocksRaw = Array.isArray(r.blocks) ? r.blocks : [];
  const citationsRaw = Array.isArray(r.citations) ? r.citations : [];
  const followUpsRaw = Array.isArray(r.followUps) ? r.followUps : [];

  const blocks: AskBlock[] = [];
  for (const b of blocksRaw) {
    const block = validateBlock(b, clientMode);
    if (block) blocks.push(block);
  }
  if (blocks.length === 0) {
    throw new AskLLMError("LLM produced no valid blocks", "validation_failed");
  }

  const citations: AskCitation[] = [];
  for (const c of citationsRaw) {
    const cit = validateCitation(c);
    if (cit) citations.push(cit);
  }

  const followUps: string[] = followUpsRaw
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 5);

  return { blocks, citations, followUps };
}

function validateBlock(raw: unknown, clientMode: boolean): AskBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const kind = r.kind;
  switch (kind) {
    case "metric":
      return validateMetric(r, clientMode);
    case "ranking":
      return validateRanking(r, clientMode);
    case "breakdown":
      return validateBreakdown(r, clientMode);
    case "compare":
      return validateCompare(r);
    case "towerSnapshot":
      return validateTowerSnapshot(r);
    case "initiative":
      return validateInitiative(r);
    case "brandLens":
      return validateBrandLens(r);
    case "prose":
      return validateProse(r);
    case "note":
      return validateNote(r);
    default:
      return null;
  }
}

function asString(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function asNumber(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

function attachCitations(r: Record<string, unknown>): AskCitation[] | undefined {
  if (!Array.isArray(r.citations)) return undefined;
  const out: AskCitation[] = [];
  for (const c of r.citations) {
    const cit = validateCitation(c);
    if (cit) out.push(cit);
  }
  return out.length > 0 ? out : undefined;
}

function validateMetric(r: Record<string, unknown>, clientMode: boolean): AskMetricBlock | null {
  const label = asString(r.label, 120);
  const value = asString(r.value, 80);
  if (!label || !value) return null;
  const numericValue = asNumber(r.numericValue) ?? undefined;
  const unitRaw = r.unit;
  const unit =
    unitRaw === "FTE" || unitRaw === "$" || unitRaw === "%" || unitRaw === "rows" || unitRaw === "towers" || unitRaw === "initiatives"
      ? (unitRaw as AskMetricBlock["unit"])
      : undefined;
  // ClientMode: redact $-unit numeric values to a placeholder string.
  if (clientMode && unit === "$") {
    return {
      kind: "metric",
      label,
      value: "—",
      unit,
      subtext: asString(r.subtext, 200) ?? undefined,
      trend: validateTrend(r.trend),
      citations: attachCitations(r),
    };
  }
  return {
    kind: "metric",
    label,
    value,
    numericValue,
    unit,
    subtext: asString(r.subtext, 200) ?? undefined,
    trend: validateTrend(r.trend),
    citations: attachCitations(r),
  };
}

function validateTrend(v: unknown): "up" | "down" | "flat" | undefined {
  return v === "up" || v === "down" || v === "flat" ? v : undefined;
}

function validateRanking(r: Record<string, unknown>, clientMode: boolean): AskRankingBlock | null {
  const title = asString(r.title, 200);
  if (!title) return null;
  const unitRaw = r.unit;
  const unit =
    unitRaw === "FTE" || unitRaw === "$" || unitRaw === "%" || unitRaw === "count" || unitRaw === "rows"
      ? (unitRaw as AskRankingBlock["unit"])
      : "count";
  const itemsRaw = Array.isArray(r.items) ? r.items : [];
  const items: AskRankingBlock["items"] = [];
  for (const it of itemsRaw) {
    if (!it || typeof it !== "object") continue;
    const i = it as Record<string, unknown>;
    const itLabel = asString(i.label, 200);
    const itValue = asNumber(i.value);
    if (!itLabel || itValue == null) continue;
    items.push({
      label: itLabel,
      value: clientMode && unit === "$" ? 0 : itValue,
      sublabel: asString(i.sublabel, 200) ?? undefined,
    });
  }
  if (items.length === 0) return null;
  return {
    kind: "ranking",
    title,
    unit,
    items,
    citations: attachCitations(r),
  };
}

function validateBreakdown(r: Record<string, unknown>, clientMode: boolean): AskBreakdownBlock | null {
  const title = asString(r.title, 200);
  if (!title) return null;
  const unitRaw = r.unit;
  const unit = unitRaw === "FTE" || unitRaw === "$" || unitRaw === "%" ? (unitRaw as AskBreakdownBlock["unit"]) : "FTE";
  const rowsRaw = Array.isArray(r.rows) ? r.rows : [];
  const rows: AskBreakdownBlock["rows"] = [];
  for (const row of rowsRaw) {
    if (!row || typeof row !== "object") continue;
    const ro = row as Record<string, unknown>;
    const rLabel = asString(ro.label, 200);
    const segs = Array.isArray(ro.segments) ? ro.segments : [];
    const segments: AskBreakdownBlock["rows"][number]["segments"] = [];
    for (const s of segs) {
      if (!s || typeof s !== "object") continue;
      const ss = s as Record<string, unknown>;
      const name = asString(ss.name, 80);
      const value = asNumber(ss.value);
      if (!name || value == null) continue;
      segments.push({ name, value: clientMode && unit === "$" ? 0 : value });
    }
    if (rLabel && segments.length > 0) {
      rows.push({ label: rLabel, segments });
    }
  }
  if (rows.length === 0) return null;
  return { kind: "breakdown", title, unit, rows, citations: attachCitations(r) };
}

function validateCompare(r: Record<string, unknown>): AskCompareBlock | null {
  const left = validateCompareSide(r.left);
  const right = validateCompareSide(r.right);
  if (!left || !right) return null;
  return { kind: "compare", left, right, citations: attachCitations(r) };
}

function validateCompareSide(raw: unknown): { title: string; lines: string[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = asString(r.title, 200);
  const linesRaw = Array.isArray(r.lines) ? r.lines : [];
  const lines: string[] = [];
  for (const l of linesRaw) {
    const s = asString(l, 240);
    if (s) lines.push(s);
  }
  if (!title || lines.length === 0) return null;
  return { title, lines };
}

function validateTowerSnapshot(r: Record<string, unknown>): AskTowerSnapshotBlock | null {
  const towerId = asString(r.towerId, 80);
  if (!towerId || !VALID_TOWER_IDS.has(towerId)) return null;
  const tower = towers.find((t) => t.id === towerId);
  if (!tower) return null;
  const name = asString(r.name, 200) ?? tower.name;
  const topOpportunity = asString(r.topOpportunity, 240) ?? tower.topOpportunityHeadline;
  const impactTierRaw = r.impactTier;
  const impactTier =
    impactTierRaw === "High" || impactTierRaw === "Medium" || impactTierRaw === "Low"
      ? impactTierRaw
      : tower.impactTier;
  const versantLeads = stringArray(r.versantLeads, 6) ?? tower.versantLeads;
  const accentureLeads = stringArray(r.accentureLeads, 6) ?? tower.accentureLeads;
  const kpisRaw = Array.isArray(r.kpis) ? r.kpis : [];
  const kpis: { label: string; value: string }[] = [];
  for (const k of kpisRaw) {
    if (!k || typeof k !== "object") continue;
    const kk = k as Record<string, unknown>;
    const lbl = asString(kk.label, 80);
    const val = asString(kk.value, 80);
    if (lbl && val) kpis.push({ label: lbl, value: val });
  }
  return {
    kind: "towerSnapshot",
    towerId,
    name,
    versantLeads,
    accentureLeads,
    impactTier,
    topOpportunity,
    kpis,
    citations: attachCitations(r),
  };
}

function stringArray(v: unknown, max: number): string[] | null {
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const s of v) {
    const sx = asString(s, 200);
    if (sx) out.push(sx);
    if (out.length >= max) break;
  }
  return out.length > 0 ? out : null;
}

function validateInitiative(r: Record<string, unknown>): AskInitiativeBlock | null {
  const briefId = asString(r.briefId, 120);
  if (!briefId || !VALID_BRIEF_IDS.has(briefId)) return null;
  const brief = processBriefs.find((b) => b.id === briefId);
  if (!brief) return null;
  const tierRaw = r.tier;
  const tier = tierRaw === "P1" || tierRaw === "P2" ? tierRaw : brief.briefRoutingTier;
  const impactTierRaw = r.impactTier;
  const impactTier =
    impactTierRaw === "High" || impactTierRaw === "Medium" || impactTierRaw === "Low"
      ? impactTierRaw
      : brief.impactTier;
  const towerId = asString(r.towerId, 80) ?? brief.towerSlug;
  const name = asString(r.name, 200) ?? brief.name;
  const agents = stringArray(r.agents, 8) ?? brief.agentsInvolved.map((a) => a.agentName);
  const tools = stringArray(r.tools, 8) ?? brief.toolsRequired.map((t) => t.tool);
  const keyMetric = asString(r.keyMetric, 240) ?? brief.keyMetric;
  return {
    kind: "initiative",
    briefId,
    name,
    tier,
    impactTier,
    towerId,
    agents,
    tools,
    keyMetric,
    citations: attachCitations(r),
  };
}

function validateBrandLens(r: Record<string, unknown>): AskBrandLensBlock | null {
  const brand = asString(r.brand, 80);
  if (!brand) return null;
  const mentionsRaw = Array.isArray(r.mentions) ? r.mentions : [];
  const mentions: AskBrandLensBlock["mentions"] = [];
  for (const m of mentionsRaw) {
    if (!m || typeof m !== "object") continue;
    const mm = m as Record<string, unknown>;
    const k = mm.kind;
    const id = asString(mm.id, 200);
    const label = asString(mm.label, 200);
    if ((k === "tower" || k === "brief" || k === "capNode" || k === "process") && id && label) {
      mentions.push({ kind: k, id, label });
    }
  }
  return { kind: "brandLens", brand, mentions, citations: attachCitations(r) };
}

function validateProse(r: Record<string, unknown>): AskProseBlock | null {
  const text = asString(r.text, 1200);
  if (!text) return null;
  return { kind: "prose", text, citations: attachCitations(r) };
}

function validateNote(r: Record<string, unknown>): AskNoteBlock | null {
  const text = asString(r.text, 600);
  if (!text) return null;
  const sev = r.severity === "warn" ? "warn" : "info";
  return { kind: "note", severity: sev, text, citations: attachCitations(r) };
}

function validateCitation(raw: unknown): AskCitation | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const kind = r.kind;
  if (typeof kind !== "string" || !VALID_CITATION_KINDS.includes(kind as AskCitationKind)) {
    return null;
  }
  const id = asString(r.id, 240);
  const label = asString(r.label, 240);
  if (!id || !label) return null;
  // For tower/brief citations, validate the id against the canonical list.
  if (kind === "tower" && !VALID_TOWER_IDS.has(id)) return null;
  if (kind === "brief" && !VALID_BRIEF_IDS.has(id)) return null;
  const href = asString(r.href, 400) ?? undefined;
  return { kind: kind as AskCitationKind, id, label, href };
}
