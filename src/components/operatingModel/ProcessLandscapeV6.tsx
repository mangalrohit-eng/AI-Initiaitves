"use client";

import * as React from "react";
import Link from "next/link";
import {
  Cpu,
  Layers,
  Sparkles,
  ChevronRight,
  Building2,
  ArrowUpRight,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  V6InitiativeCard,
  V6L3Row,
  SelectInitiativesV6Result,
} from "@/lib/initiatives/selectV6";
import { feasibilityChip } from "@/lib/feasibilityChip";
import { formatUsdCompact } from "@/lib/format";
import { useRedactDollars, RedactedAmount } from "@/lib/clientMode";
import { cn } from "@/lib/utils";

/**
 * v6 Step 4 panel — one card per L3 Job Family with 1..N AI Solution
 * sub-cards. Replaces the v5 `ProcessLandscape` (L3 → L4 Activity Group →
 * L5 Activity tree) with a single dial-bearing layer (L3) and specific
 * AI Solutions hanging off it.
 *
 * Sibling component to `ProcessLandscape.tsx` (v5) — kept in a separate
 * file so the v5 surface stays untouched through the cutover. Phase 7
 * cleanup removes the v5 component once the schema flag retires.
 */
export function ProcessLandscapeV6({
  result,
}: {
  result: SelectInitiativesV6Result;
}) {
  const redact = useRedactDollars();

  if (result.l3Rows.length === 0) {
    return null;
  }

  // Group L3 rows by L2 Job Grouping so the cards read editorially as
  // "section → solutions", not a flat scrollable wall.
  const byL2 = new Map<string, V6L3Row[]>();
  for (const row of result.l3Rows) {
    const arr = byL2.get(row.l2) ?? [];
    arr.push(row);
    byL2.set(row.l2, arr);
  }

  return (
    <div className="space-y-8">
      {Array.from(byL2.entries()).map(([l2, rows]) => (
        <section key={l2} className="space-y-3">
          <header className="flex flex-wrap items-end justify-between gap-3 border-b border-forge-border/60 pb-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded border border-forge-border/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-forge-hint">
                  &gt; L2
                </span>
                <h3 className="font-display text-sm font-semibold text-forge-ink">
                  {l2}
                </h3>
              </div>
              <p className="mt-1 text-xs text-forge-subtle">
                {rows.length} Job Famil{rows.length === 1 ? "y" : "ies"} ·{" "}
                {rows.reduce((s, r) => s + r.initiatives.filter((i) => !i.isPlaceholder).length, 0)}{" "}
                AI Solution
                {rows.reduce(
                  (s, r) => s + r.initiatives.filter((i) => !i.isPlaceholder).length,
                  0,
                ) === 1
                  ? ""
                  : "s"}
              </p>
            </div>
            {!redact ? (
              <div className="text-right">
                <div className="font-mono text-sm font-semibold tabular-nums text-forge-ink">
                  {formatUsdCompact(rows.reduce((s, r) => s + r.aiUsd, 0))}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-forge-hint">
                  Modeled AI $
                </div>
              </div>
            ) : null}
          </header>
          <div className="space-y-3">
            {rows.map((row) => (
              <L3RowCard key={row.id} row={row} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ===========================================================================
//   L3 row card — one Job Family with its AI Solutions
// ===========================================================================

function L3RowCard({ row }: { row: V6L3Row }) {
  const redact = useRedactDollars();
  const [open, setOpen] = React.useState(true);
  const realInitiatives = row.initiatives.filter((i) => !i.isPlaceholder);
  const visibleChildren = row.childL4Names.slice(0, 4);
  const hiddenChildrenCount = Math.max(
    0,
    row.childL4Names.length - visibleChildren.length,
  );

  return (
    <article
      id={`l3row-${row.id}`}
      className={cn(
        "rounded-2xl border border-forge-border bg-forge-surface/70 transition-colors",
        "hover:border-accent-purple/30",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left sm:px-5 sm:py-4"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-forge-hint">
            <span className="rounded border border-accent-purple/40 bg-accent-purple/10 px-1.5 py-0.5 font-semibold text-accent-purple-dark">
              L3
            </span>
            <span>{row.l2}</span>
            <ChevronRight className="h-3 w-3 text-forge-subtle" aria-hidden />
            <span className="text-forge-body">{row.l3}</span>
          </div>
          <h4 className="mt-1.5 font-display text-base font-semibold text-forge-ink">
            {row.l3}
          </h4>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-forge-subtle">
            <span className="font-mono">{row.headcount} h/c</span>
            <span className="text-forge-hint">·</span>
            <span className="font-mono tabular-nums">
              pool{" "}
              {redact ? (
                <RedactedAmount />
              ) : row.poolUsd > 0 ? (
                formatUsdCompact(row.poolUsd)
              ) : (
                "$—"
              )}
            </span>
            <span className="text-forge-hint">·</span>
            <span className="font-mono">AI {row.aiPct.toFixed(0)}%</span>
            {row.curationStage === "queued" ? (
              <>
                <span className="text-forge-hint">·</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-accent-amber/40 bg-accent-amber/10 px-2 py-0 font-mono text-[10px] uppercase tracking-wider text-accent-amber">
                  <Loader2 className="h-2.5 w-2.5" aria-hidden /> queued
                </span>
              </>
            ) : null}
            {row.curationStage === "running-curate" ? (
              <>
                <span className="text-forge-hint">·</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-accent-purple/40 bg-accent-purple/10 px-2 py-0 font-mono text-[10px] uppercase tracking-wider text-accent-purple-dark">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden />{" "}
                  scoring
                </span>
              </>
            ) : null}
            {row.curationStage === "failed" && row.curationError ? (
              <>
                <span className="text-forge-hint">·</span>
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-accent-red/40 bg-accent-red/10 px-2 py-0 font-mono text-[10px] uppercase tracking-wider text-accent-red"
                  title={row.curationError}
                >
                  <AlertTriangle className="h-2.5 w-2.5" aria-hidden /> error
                </span>
              </>
            ) : null}
          </div>
          {visibleChildren.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Layers className="h-3 w-3 text-forge-hint" aria-hidden />
              <span className="font-mono text-[10px] uppercase tracking-wider text-forge-hint">
                Activity Groups:
              </span>
              {visibleChildren.map((name) => (
                <span
                  key={name}
                  className="rounded-full border border-forge-border/60 bg-forge-well/40 px-2 py-0.5 text-[10px] text-forge-subtle"
                  title={`L4 Activity Group: ${name}`}
                >
                  {name}
                </span>
              ))}
              {hiddenChildrenCount > 0 ? (
                <span className="rounded-full border border-forge-border/40 px-1.5 py-0.5 font-mono text-[10px] text-forge-hint">
                  +{hiddenChildrenCount}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          {!redact ? (
            <div className="font-display text-lg font-semibold text-accent-green tabular-nums">
              {row.aiUsd > 0 ? formatUsdCompact(row.aiUsd) : "$—"}
            </div>
          ) : (
            <RedactedAmount className="text-forge-subtle" />
          )}
          <div className="font-mono text-[10px] uppercase tracking-wider text-forge-hint">
            modeled AI $
          </div>
          <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-forge-border bg-forge-well/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-forge-subtle">
            <Sparkles className="h-2.5 w-2.5" aria-hidden />
            {realInitiatives.length} AI Solution
            {realInitiatives.length === 1 ? "" : "s"}
          </div>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="space-y-2.5 border-t border-forge-border/60 px-4 py-3 sm:px-5 sm:py-4">
              {row.initiatives.length === 0 ? (
                <p className="rounded-xl border border-dashed border-forge-border/60 bg-forge-well/30 px-3 py-3 text-xs text-forge-subtle">
                  AI Initiatives are queued for refresh. Use the
                  &ldquo;Refresh AI guidance&rdquo; control above to score
                  this Job Family with the Versant-grounded model.
                </p>
              ) : (
                row.initiatives.map((init) => (
                  <InitiativeSubcard key={init.id} init={init} />
                ))
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </article>
  );
}

// ===========================================================================
//   AI Solution sub-card
// ===========================================================================

function InitiativeSubcard({ init }: { init: V6InitiativeCard }) {
  const feas = init.isPlaceholder ? null : feasibilityChip(init.feasibility);
  const isClickable = Boolean(init.initiativeHref);

  const inner = (
    <div
      className={cn(
        "group/card flex items-start justify-between gap-4 rounded-xl border bg-forge-well/40 px-3.5 py-3 transition-colors sm:px-4",
        init.isPlaceholder
          ? "border-l-[3px] border-l-dashed border-l-forge-border/70 border-forge-border/60"
          : "border-forge-border/70 hover:border-accent-purple/40 hover:bg-accent-purple/[0.04]",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Cpu
            className={cn(
              "h-3.5 w-3.5",
              init.isPlaceholder ? "text-forge-hint" : "text-accent-purple-dark",
            )}
            aria-hidden
          />
          <h5 className="font-display text-sm font-semibold text-forge-ink">
            {init.solutionName}
          </h5>
          {feas ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-1.5 py-0 font-mono text-[10px] uppercase tracking-wider",
                feas.badge,
              )}
              title={feas.tooltip}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", feas.dot)} />
              {feas.label}
            </span>
          ) : null}
          {init.primaryVendor ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-forge-border bg-white/5 px-1.5 py-0 font-mono text-[10px] text-forge-body"
              title="Anchored vendor or stack for this solution"
            >
              <Building2 className="h-2.5 w-2.5 text-forge-hint" aria-hidden />
              {init.primaryVendor}
            </span>
          ) : null}
        </div>
        {init.tagline ? (
          <p className="mt-1 text-xs leading-relaxed text-forge-body">
            {init.tagline}
          </p>
        ) : null}
        {init.aiRationale ? (
          <p className="mt-1.5 text-[11px] leading-relaxed text-forge-subtle">
            {init.aiRationale}
          </p>
        ) : null}
        {init.coversL4RowIds.length > 0 ? (
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-forge-hint">
            covers {init.coversL4RowIds.length} Activity Group
            {init.coversL4RowIds.length === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>
      {isClickable ? (
        <ArrowUpRight
          className="mt-1 h-4 w-4 flex-shrink-0 text-forge-hint transition-colors group-hover/card:text-accent-purple-dark"
          aria-hidden
        />
      ) : null}
    </div>
  );

  if (!init.initiativeHref) return inner;
  return (
    <Link
      href={init.initiativeHref}
      className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/50 focus-visible:ring-offset-2 focus-visible:ring-offset-forge-bg"
      title={`Open the full 4-lens deep dive for ${init.solutionName}. The page generates the deep dive on first visit and caches the result.`}
    >
      {inner}
    </Link>
  );
}
