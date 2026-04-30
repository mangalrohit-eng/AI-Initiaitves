"use client";

import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import type { ProgramInitiativeRow, SelectProgramResult } from "@/lib/initiatives/selectProgram";
import type { CrossTowerAiPlanLLM } from "@/lib/llm/prompts/crossTowerAiPlan.v1";
import { TIER_META, TIER_STYLES } from "@/lib/priority";
import { formatUsdCompact } from "@/lib/format";
import { useRedactDollars } from "@/lib/clientMode";
import { slugify } from "@/lib/utils";

/**
 * Cross-tower top-initiative roster.
 *
 *   - Initiative roster + ids + metrics: deterministic (`selectInitiativesForProgram`).
 *   - Ranking + `why` + dependency descriptions: LLM-authored when available;
 *     falls back to a deterministic cross-tower ranking otherwise.
 *
 * Deterministic ranking algorithm (used when the LLM is unavailable):
 *
 *   1. Sort all initiatives globally by `(tier asc P1→P2→P3→null,
 *      attributedAiUsd desc, towerName asc, name asc)`. Priority-tier first
 *      because Versant's plan is staged by horizon; $ desc within tier so the
 *      most material initiatives surface; name as the stable tie-breaker.
 *   2. For the first `limit` rows that show on the Overview preview, walk
 *      the globally-sorted list and pick at most ONE row per tower — so the
 *      preview is genuinely cross-tower (not five Finance rows in a row).
 *   3. Append every remaining initiative in the same global order so the
 *      tail is also meaningful when the list isn't truncated.
 *
 * When the LLM has run, the LLM's curated `keyInitiatives` go first
 * (LLM owns curation), then any deterministic rows the LLM didn't pick are
 * appended in the same global order — never document order.
 *
 * Tower chips, tier badges, and the AI $ chip never come from the model.
 */
export function KeyInitiativesModule({
  program,
  llmPlan,
  narrativeUnavailable,
  bare,
  limit = 12,
  onePerTower,
  showCta,
}: {
  program: SelectProgramResult;
  llmPlan: CrossTowerAiPlanLLM | null;
  narrativeUnavailable: boolean;
  /** Drop the outer card frame when rendered inside `<TabGroup>`. */
  bare?: boolean;
  /** Cap the displayed roster (default 12). */
  limit?: number;
  /**
   * When true, the visible top-N is the strongest initiative from each of
   * up to N distinct towers — guaranteed cross-tower by construction. Used
   * by the Overview tab to surface "the strongest initiative per Versant
   * tower" across all priorities.
   */
  onePerTower?: boolean;
  /**
   * When true, renders a "See all N initiatives →" CTA below the roster.
   * Used by the Overview tab to push the executive into the comprehensive
   * Initiatives tab.
   */
  showCta?: boolean;
}) {
  const redact = useRedactDollars();
  const ranked = rankInitiatives(program, llmPlan, limit, Boolean(onePerTower));
  const top = ranked.slice(0, limit);
  const llmAuthored = !narrativeUnavailable && Boolean(llmPlan);
  const rankingCriteria = onePerTower
    ? llmAuthored
      ? "Strongest initiative per Versant tower — AI-authored rationale where curated, deterministic elsewhere"
      : "Strongest initiative per Versant tower, by priority tier then $ impact across all priorities"
    : llmAuthored
      ? "AI-curated cross-tower set"
      : "By priority tier then $ impact, one per tower";

  const Header = (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-semibold text-forge-ink">
          <span className="font-mono text-accent-purple-dark">&gt;</span> Key initiatives across towers
        </h2>
        <p className="mt-1 text-sm text-forge-subtle">
          {onePerTower ? (
            <>
              {top.length} initiatives across {top.length} Versant towers
              {program.initiatives.length > top.length
                ? `, drawn from ${program.initiatives.length} curated`
                : ""}
              . <span className="text-forge-body">{rankingCriteria}.</span>
            </>
          ) : (
            <>
              Top {top.length} of {program.initiatives.length} curated initiatives.{" "}
              <span className="text-forge-body">{rankingCriteria}.</span>
            </>
          )}
          {llmAuthored ? (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-purple-dark">
              <Sparkles className="h-2.5 w-2.5" aria-hidden /> AI-authored ranking
            </span>
          ) : null}
        </p>
      </div>
    </header>
  );

  const Roster = (
    <>
      <ul className="mt-5 divide-y divide-forge-border">
        {top.map((row, idx) => {
          const tier = row.tier;
          const tierStyles = tier ? TIER_STYLES[tier] : null;
          const tierMeta = tier ? TIER_META[tier] : null;
          const initiativeHref = row.initiative
            ? `/tower/${row.towerId}/process/${slugify(row.initiative.name)}`
            : row.briefSlug
              ? `/tower/${row.towerId}/brief/${row.briefSlug}`
              : `/tower/${row.towerId}`;
          return (
            <li key={`${row.id}-${idx}`} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
              <span className="font-mono text-xs text-forge-hint sm:w-8">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={initiativeHref}
                    className="group inline-flex max-w-full items-center gap-1 truncate text-sm font-semibold text-forge-ink hover:text-accent-purple-dark"
                  >
                    <span className="truncate">{row.name}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 flex-shrink-0 text-forge-hint transition group-hover:text-accent-purple" />
                  </Link>
                  {tier && tierStyles && tierMeta ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tierStyles.badge}`}
                    >
                      {tier} · {tierMeta.window}
                    </span>
                  ) : null}
                  <span className="rounded-full border border-forge-border bg-forge-well px-2 py-0.5 text-[11px] text-forge-body">
                    {row.towerName}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-forge-body">
                  {row.whyText ?? row.aiRationale ?? "Versant-specific rationale subject to discovery."}
                </p>
                {row.dependsOnNames.length > 0 ? (
                  <div className="mt-1.5 text-[11px] text-forge-subtle">
                    <span className="text-forge-hint">Depends on:</span>{" "}
                    {row.dependsOnNames.join(" · ")}
                  </div>
                ) : null}
              </div>
              {!redact ? (
                <span className="rounded-full border border-forge-border bg-forge-well px-2 py-0.5 font-mono text-[11px] tabular-nums text-forge-ink">
                  {formatUsdCompact(row.aiUsd)} AI $
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {showCta && program.initiatives.length > top.length ? (
        <div className="mt-4 border-t border-forge-border pt-3 text-xs">
          <span className="text-forge-subtle">
            See the full roster of {program.initiatives.length} curated initiatives — sortable, filterable by tower and phase — in the
          </span>{" "}
          <span className="font-medium text-accent-purple-dark">Initiatives</span>{" "}
          <span className="text-forge-subtle">tab above.</span>
        </div>
      ) : null}
    </>
  );

  if (bare) {
    return (
      <div>
        {Header}
        {Roster}
      </div>
    );
  }
  return (
    <section className="rounded-2xl border border-forge-border bg-forge-surface p-5 shadow-card">
      {Header}
      {Roster}
    </section>
  );
}

// ---------------------------------------------------------------------------

type DisplayRow = ProgramInitiativeRow & {
  whyText?: string;
  dependsOnNames: string[];
};

type LLMInfo = { why: string; dependsOnNames: string[]; ranking: number };

function rankInitiatives(
  program: SelectProgramResult,
  llmPlan: CrossTowerAiPlanLLM | null,
  previewLimit: number,
  onePerTower: boolean,
): DisplayRow[] {
  const byId = new Map<string, ProgramInitiativeRow>();
  for (const row of program.initiatives) byId.set(row.id, row);

  // Globally-ranked roster, by (tier, attributedAiUsd desc, tower, name).
  // Universal ordering used by every downstream picker.
  const globalRanked = [...program.initiatives].sort(globalRowScore);

  // Index every LLM-authored row by initiative id (when LLM has run).
  const llmInfoById = new Map<string, LLMInfo>();
  if (llmPlan && llmPlan.keyInitiatives.length > 0) {
    for (const llm of llmPlan.keyInitiatives) {
      const det = byId.get(llm.initiativeId);
      if (!det) continue;
      const dependsOnNames = llm.dependsOn
        .map((id) => byId.get(id)?.name)
        .filter((n): n is string => Boolean(n))
        .slice(0, 3);
      llmInfoById.set(det.id, {
        why: llm.why,
        dependsOnNames,
        ranking: llm.ranking,
      });
    }
  }

  const decorate = (row: ProgramInitiativeRow): DisplayRow => {
    const llm = llmInfoById.get(row.id);
    if (llm) {
      return { ...row, whyText: llm.why, dependsOnNames: llm.dependsOnNames };
    }
    return { ...row, whyText: row.aiRationale, dependsOnNames: [] };
  };

  // Decide which ids occupy the visible preview.
  let previewIds: string[];
  if (onePerTower) {
    // Strongest initiative per tower across ALL priorities. When the LLM has
    // curated a row from a tower, prefer that row (carries LLM `why` text);
    // otherwise the deterministic global-top row from that tower wins.
    previewIds = pickOnePerTowerIds(globalRanked, llmInfoById, previewLimit);
  } else if (llmInfoById.size > 0) {
    // LLM-authored — its curated cross-tower set goes first, sorted by the
    // LLM's own ranking int.
    previewIds = Array.from(llmInfoById.entries())
      .sort((a, b) => a[1].ranking - b[1].ranking)
      .map(([id]) => id);
  } else {
    // No LLM, no one-per-tower constraint — fall back to a cross-tower
    // diversifier on the global ranking so the visible top-N isn't all from
    // the same tower.
    previewIds = pickCrossTowerPreviewIds(globalRanked, previewLimit);
  }

  const previewSet = new Set(previewIds);
  const preview: DisplayRow[] = previewIds
    .map((id) => byId.get(id))
    .filter((r): r is ProgramInitiativeRow => Boolean(r))
    .map(decorate);
  const tail: DisplayRow[] = globalRanked
    .filter((r) => !previewSet.has(r.id))
    .map(decorate);
  return [...preview, ...tail];
}

/**
 * Pick the strongest representative from each tower, capped at `limit`.
 *
 * For each tower:
 *   - If any of its rows are in the LLM's curated set, pick the one with
 *     the lowest LLM ranking (LLM has explicitly endorsed this tower).
 *   - Else pick the row with the best global score (priority tier + $).
 *
 * The resulting set is then sorted by global score so the executive read
 * stays priority-first / $-impact-first.
 */
function pickOnePerTowerIds(
  globalRanked: readonly ProgramInitiativeRow[],
  llmInfoById: Map<string, LLMInfo>,
  limit: number,
): string[] {
  const winnerByTower = new Map<string, ProgramInitiativeRow>();
  const llmRankByTower = new Map<string, number>();
  for (const row of globalRanked) {
    const llm = llmInfoById.get(row.id);
    const existing = winnerByTower.get(row.towerId);
    if (!existing) {
      winnerByTower.set(row.towerId, row);
      if (llm) llmRankByTower.set(row.towerId, llm.ranking);
      continue;
    }
    if (llm) {
      const bestLLMRank = llmRankByTower.get(row.towerId);
      if (bestLLMRank === undefined || llm.ranking < bestLLMRank) {
        winnerByTower.set(row.towerId, row);
        llmRankByTower.set(row.towerId, llm.ranking);
      }
    }
  }
  const winners = Array.from(winnerByTower.values()).sort(globalRowScore);
  return winners.slice(0, limit).map((r) => r.id);
}

/**
 * Walk the globally-ranked list and return the first `limit` ids belonging
 * to distinct towers. Used when `onePerTower` is off — keeps the top-N
 * diverse without the strict one-per-tower commitment.
 */
function pickCrossTowerPreviewIds(
  globalRanked: readonly ProgramInitiativeRow[],
  limit: number,
): string[] {
  const seenTowers = new Set<string>();
  const picked: string[] = [];
  for (const row of globalRanked) {
    if (seenTowers.has(row.towerId)) continue;
    seenTowers.add(row.towerId);
    picked.push(row.id);
    if (picked.length >= limit) return picked;
  }
  if (picked.length < limit) {
    const pickedSet = new Set(picked);
    for (const row of globalRanked) {
      if (pickedSet.has(row.id)) continue;
      pickedSet.add(row.id);
      picked.push(row.id);
      if (picked.length >= limit) break;
    }
  }
  return picked;
}

function tierRankScore(tier: ProgramInitiativeRow["tier"]): number {
  if (tier === "P1") return 0;
  if (tier === "P2") return 1;
  if (tier === "P3") return 2;
  return 3;
}

function globalRowScore(
  a: ProgramInitiativeRow,
  b: ProgramInitiativeRow,
): number {
  const tierDelta = tierRankScore(a.tier) - tierRankScore(b.tier);
  if (tierDelta !== 0) return tierDelta;
  const usdDelta = b.attributedAiUsd - a.attributedAiUsd;
  if (Math.abs(usdDelta) > 0.5) return usdDelta;
  const towerDelta = a.towerName.localeCompare(b.towerName);
  if (towerDelta !== 0) return towerDelta;
  return a.name.localeCompare(b.name);
}
