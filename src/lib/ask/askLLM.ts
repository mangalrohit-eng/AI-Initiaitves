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
import {
  VersantLLMError,
  buildLLMRequest,
  isLLMConfigured as kitIsLLMConfigured,
  resolveModelId as kitResolveModelId,
  type ReasoningEffort,
} from "@/lib/llm/prompts/versantPromptKit";

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_TOKENS = 12_000;
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
  return kitIsLLMConfigured();
}

export function resolveAskModel(): string {
  return kitResolveModelId();
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
  if (!kitIsLLMConfigured()) {
    throw new AskLLMError("OPENAI_API_KEY not set", "api_key_missing");
  }

  const systemPrompt = buildAskSystemPrompt();
  const userPrompt = buildAskUserPrompt(args.messages, args.programDigest);

  let parsed: unknown;
  let modelId: string;
  let latencyMs: number;
  let usage: { prompt?: number; completion?: number; total?: number } | undefined;

  try {
    const result = await buildLLMRequest({
      systemPrompt,
      userPrompt,
      reasoningEffort: DEFAULT_REASONING_EFFORT,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      maxOutputTokens: DEFAULT_MAX_TOKENS,
      verbosity: "medium",
      signal: args.signal,
    });
    parsed = result.parsed;
    modelId = result.model;
    latencyMs = result.latencyMs;
    usage = result.tokenUsage;
  } catch (e) {
    if (e instanceof VersantLLMError) {
      const code: AskLLMError["code"] =
        e.code === "rate_limit"
          ? "rate_limit"
          : e.code === "api_key_missing"
            ? "api_key_missing"
            : e.code === "prompt_too_large"
              ? "prompt_too_large"
              : e.code === "timeout"
                ? "timeout"
                : e.code === "non_json_response" || e.code === "empty_content"
                  ? "validation_failed"
                  : e.code === "network" || e.code === "responses_failed"
                    ? "network"
                    : "unknown";
      throw new AskLLMError(e.message, code, e.retriable, e);
    }
    throw new AskLLMError(
      e instanceof Error ? e.message : "OpenAI call failed",
      "unknown",
      true,
      e,
    );
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
