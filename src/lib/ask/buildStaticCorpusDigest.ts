/**
 * Static corpus digest — server-only, module-cached compact view of all
 * authored content the LLM should reason over. Computed once at module
 * load and reused for every request; invalidated on deploy.
 */

import "server-only";

import { towers } from "@/data/towers";
import { processBriefs } from "@/data/processBriefs";
import { TOWER_WORKBENCHES } from "@/data/towerWorkbenches";
import { ORCHESTRATION_LAYER } from "@/data/orchestrationLayer";
import { VERSANT_CONTEXT } from "./buildVersantContext";
import type { StaticBriefDigest, StaticCorpusDigest, StaticTowerDigest } from "./types";

let cached: StaticCorpusDigest | null = null;

export function getStaticCorpusDigest(): StaticCorpusDigest {
  if (cached) return cached;
  cached = build();
  return cached;
}

function build(): StaticCorpusDigest {
  const brands = VERSANT_CONTEXT.brands;

  const towerDigests: StaticTowerDigest[] = towers.map((t) => {
    const haystack = `${t.name}\n${t.description ?? ""}\n${t.currentState ?? ""}\n${t.narrativeSummary ?? ""}\n${t.topOpportunityHeadline ?? ""}`;
    return {
      id: t.id,
      name: t.name,
      versantLeads: t.versantLeads,
      accentureLeads: t.accentureLeads,
      impactTier: t.impactTier,
      totalProcesses: t.totalProcesses,
      aiEligibleProcesses: t.aiEligibleProcesses,
      topOpportunityHeadline: t.topOpportunityHeadline,
      narrativeSummary: t.narrativeSummary,
      brandsMentioned: detectBrands(haystack, brands),
    };
  });

  const briefDigests: StaticBriefDigest[] = processBriefs.map((b) => {
    const haystack = `${b.name}\n${b.description ?? ""}\n${b.preState.summary}\n${b.postState.summary}`;
    return {
      id: b.id,
      name: b.name,
      towerId: b.towerSlug,
      briefRoutingTier: b.briefRoutingTier,
      impactTier: b.impactTier,
      keyMetric: b.keyMetric,
      agents: b.agentsInvolved.map((a) => a.agentName),
      tools: b.toolsRequired.map((t) => t.tool),
      brandsMentioned: detectBrands(haystack, brands),
    };
  });

  return {
    towers: towerDigests,
    briefs: briefDigests,
    brands,
  };
}

/**
 * Case-insensitive substring scan against the brand list. Order-preserved,
 * deduped. Looks for word-bounded matches so "USA" doesn't match "USAGE".
 */
function detectBrands(text: string, brands: string[]): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const out: string[] = [];
  for (const brand of brands) {
    const bLower = brand.toLowerCase();
    // Word-boundary check — avoid matching "USA" inside "USAGE", but allow
    // "MS NOW" which has a space, by escaping regex specials.
    const pattern = new RegExp(
      `(^|[^a-z0-9])${escapeRegex(bLower)}([^a-z0-9]|$)`,
      "i",
    );
    if (pattern.test(lower) && !out.includes(brand)) {
      out.push(brand);
    }
  }
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Compact prompt-friendly serialization. */
export function staticCorpusForPrompt(d: StaticCorpusDigest): string {
  const lines: string[] = [];
  lines.push("# TOWERS");
  for (const t of d.towers) {
    lines.push(
      `[${t.id}] ${t.name} | impact: ${t.impactTier} | processes: ${t.totalProcesses} (AI-eligible: ${t.aiEligibleProcesses}) | leads: V=${t.versantLeads.join("/")} A=${t.accentureLeads.join("/")}`,
    );
    lines.push(`  Top opportunity: ${t.topOpportunityHeadline}`);
    if (t.narrativeSummary) {
      lines.push(`  Narrative: ${truncate(t.narrativeSummary, 220)}`);
    }
    if (t.brandsMentioned.length > 0) {
      lines.push(`  Brands mentioned: ${t.brandsMentioned.join(", ")}`);
    }
  }

  lines.push("");
  lines.push("# AI PROCESS BRIEFS (briefId | towerId | tier | impactTier | keyMetric)");
  for (const b of d.briefs) {
    lines.push(
      `[${b.id}] ${b.name} | tower=${b.towerId} | ${b.briefRoutingTier} | impact=${b.impactTier} | ${truncate(b.keyMetric, 140)}`,
    );
    if (b.agents.length > 0) {
      lines.push(`  Agents: ${b.agents.join(", ")}`);
    }
    if (b.tools.length > 0) {
      lines.push(`  Tools: ${b.tools.join(", ")}`);
    }
    if (b.brandsMentioned.length > 0) {
      lines.push(`  Brands: ${b.brandsMentioned.join(", ")}`);
    }
  }

  lines.push("");
  lines.push(
    "# TOWER WORKBENCHES (custom-built, consolidated per-tower apps — one per tower)",
  );
  for (const w of Object.values(TOWER_WORKBENCHES)) {
    lines.push(
      `[${w.id}] ${w.name} | tower=${w.towerId} | build=${w.buildEffort} | delivery=${w.estimatedDeliveryMonths}mo`,
    );
    lines.push(`  Tagline: ${truncate(w.tagline, 200)}`);
    lines.push(
      `  Surfaces (${w.surfaces.length}): ${w.surfaces.map((s) => `${s.verb}/${s.name}`).join(" · ")}`,
    );
    lines.push(`  Success metric: ${w.successMetric}`);
    lines.push(`  Why custom: ${truncate(w.whyCustomBuild, 200)}`);
    lines.push(`  Wraps (illustrative vendor anchors — not committed picks): ${w.digitalCore.integrations.join(", ")}`);
  }

  lines.push("");
  lines.push(
    "# ORCHESTRATION LAYER (canonical shared fabric beneath all workbenches)",
  );
  lines.push(`Narrative: ${truncate(ORCHESTRATION_LAYER.narrative, 280)}`);
  lines.push(`Why shared: ${truncate(ORCHESTRATION_LAYER.whyShared, 280)}`);
  lines.push(
    `Build: ${ORCHESTRATION_LAYER.buildEffort} | Delivery: ${ORCHESTRATION_LAYER.estimatedDeliveryMonths}mo`,
  );
  lines.push(
    `Data architecture (${ORCHESTRATION_LAYER.dataArchitecture.length}): ${ORCHESTRATION_LAYER.dataArchitecture
      .map((c) => `${c.name} [${c.category}]`)
      .join(" · ")}`,
  );
  lines.push(
    `Cross-cutting agents (${ORCHESTRATION_LAYER.agents.length}): ${ORCHESTRATION_LAYER.agents
      .map((a) => `${a.name} [${a.type}]`)
      .join(" · ")}`,
  );
  lines.push(
    `API integrations (${ORCHESTRATION_LAYER.apiIntegrations.length}) — illustrative vendor anchors only, never render as committed picks: ${Array.from(
      new Set(ORCHESTRATION_LAYER.apiIntegrations.map((i) => i.pointSolution)),
    ).join(", ")}`,
  );
  lines.push(
    `Governance policies (${ORCHESTRATION_LAYER.governance.length}): ${ORCHESTRATION_LAYER.governance
      .map((g) => g.name)
      .join(" · ")}`,
  );

  return lines.join("\n");
}

function truncate(s: string, max: number): string {
  if (!s) return s;
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}
