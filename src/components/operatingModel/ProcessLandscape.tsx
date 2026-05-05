"use client";

import * as React from "react";
import Link from "next/link";
import * as Icons from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { Tower } from "@/data/types";
import type {
  AssessProgramV2,
  CurationStage,
  InitiativeReview,
  TowerId,
} from "@/data/assess/types";
import type { InitiativeL2, InitiativeL3, InitiativeL4 } from "@/lib/initiatives/select";
import type { UseInitiativeReviewsResult } from "@/lib/initiatives/useInitiativeReviews";
import { cn, slugify } from "@/lib/utils";
import { feasibilityChip } from "@/lib/feasibilityChip";
import { formatUsdCompact } from "@/lib/format";
import { useRedactDollars } from "@/lib/clientMode";
import { getTowerHref } from "@/lib/towerHref";
import { InitiativeReviewActions } from "./InitiativeReviewActions";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  getAssessProgram,
  getAssessProgramHydrationSnapshot,
  subscribe,
} from "@/lib/localStore";
import { hasInFlightRows } from "@/lib/initiatives/curationHash";
import {
  regenerateRowWithFeedback,
  type RegenerateRowSummary,
} from "@/lib/assess/curationPipeline";

function resolveIcon(name?: string): LucideIcon {
  if (!name) return Icons.Layers;
  const lib = Icons as unknown as Record<string, LucideIcon>;
  return lib[name] ?? Icons.Layers;
}

const REFINE_FEEDBACK_MAX = 600;

type RowCurationState = {
  stage: CurationStage | undefined;
  error: string | undefined;
};

/**
 * Subscribe once to the live AssessProgram for this tower and return:
 *   - `byRowId`: per-row `{ stage, error }` snapshot keyed by `L4WorkforceRow.id`.
 *   - `anyInFlight`: true iff at least one row in the tower is `running-l5`,
 *     `running-verdict`, or `running-curate` — used to disable the per-L4
 *     Activity Group Refine button while another regen (single-row OR
 *     tower-wide) is mid-flight, mirroring the cross-disable pattern in
 *     `RegenerateAiGuidanceToolbar`.
 */
function useTowerCurationStages(towerId: TowerId): {
  byRowId: Map<string, RowCurationState>;
  anyInFlight: boolean;
} {
  const [program, setProgram] = React.useState<AssessProgramV2>(() =>
    getAssessProgramHydrationSnapshot(),
  );
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);

  return React.useMemo(() => {
    const rows = program.towers[towerId]?.l4Rows ?? [];
    const byRowId = new Map<string, RowCurationState>();
    for (const r of rows) {
      byRowId.set(r.id, { stage: r.curationStage, error: r.curationError });
    }
    return { byRowId, anyInFlight: hasInFlightRows(rows) };
  }, [program, towerId]);
}

const CRITICALITY_ACCENT: Record<string, string> = {
  "Mission-critical": "border-accent-red/40 bg-red-50 text-red-900",
  High: "border-accent-amber/45 bg-amber-50 text-amber-900",
  Medium: "border-forge-border bg-forge-well text-forge-body",
  Low: "border-forge-border bg-forge-well/60 text-forge-subtle",
};

const MATURITY_ACCENT: Record<string, string> = {
  "Not yet established": "border-forge-border bg-white text-forge-subtle",
  Manual: "border-forge-border bg-white text-forge-body",
  "Semi-automated": "border-accent-teal/40 bg-accent-teal/10 text-emerald-900",
  Automated: "border-accent-teal/55 bg-accent-teal/15 text-emerald-900",
};

// ===========================================================================
//   Row grouping helpers — V5 hierarchy
// ===========================================================================

/**
 * One L3 Job Family bucket within a single L2 Section: holds every L4
 * Activity Group row whose canonical parent is this Job Family. Drives
 * the L3 sub-section header counts ("X Activity Groups · Y AI-eligible
 * L5 Activities · $Z modeled AI") and supplies the row list for the
 * stack of `L4ActivityGroupCard`s underneath.
 */
type L3Group = {
  l3Id: string;
  l3Name: string;
  l3Description?: string;
  /** Workforce rows under this L3 — each is one L4 Activity Group. */
  rows: InitiativeL3[];
  totalAiUsd: number;
  totalActivityGroupCount: number;
  curatedL5Count: number;
  placeholderL5Count: number;
};

/**
 * Groups the flat row list inside an `InitiativeL2` by L3 Job Family,
 * preserving canonical order via first-encounter index. Each row in
 * `l2.l3s` carries its parent `l3.l3` (CapabilityL3), so we bucket by
 * that id, not by the row id.
 *
 * Pre-V5 the panel rendered one card per row and labeled it "L3" — but
 * multiple rows can share the same L3 Job Family, which surfaced as
 * duplicate "L3 [same name]" cards. This helper restores the V5-correct
 * grouping: distinct L3 Job Families become sub-sections, and the rows
 * (= L4 Activity Groups) sit underneath.
 */
function groupRowsByL3(l2: InitiativeL2): L3Group[] {
  const order: string[] = [];
  const buckets = new Map<string, L3Group>();
  for (const row of l2.l3s) {
    const id = row.l3.id;
    let g = buckets.get(id);
    if (!g) {
      g = {
        l3Id: id,
        l3Name: row.l3.name,
        l3Description: row.l3.description,
        rows: [],
        totalAiUsd: 0,
        totalActivityGroupCount: 0,
        curatedL5Count: 0,
        placeholderL5Count: 0,
      };
      buckets.set(id, g);
      order.push(id);
    }
    g.rows.push(row);
    g.totalAiUsd += row.aiUsd;
    g.totalActivityGroupCount += 1;
    for (const l5 of row.l4s) {
      if (l5.isPlaceholder) g.placeholderL5Count += 1;
      else g.curatedL5Count += 1;
    }
  }
  return order.map((id) => buckets.get(id)!);
}

/**
 * Display-only band rendered between the sticky L2 section header and the
 * `L4ActivityGroupCard` stack. Carries the L3 badge, Job Family name,
 * the row-level counts, optional description, and summed AI dollars.
 *
 * Not sticky and not collapsible — the L4 cards underneath own the
 * expand/collapse interaction. Keeping the L3 band display-only avoids
 * two competing sticky bands and keeps the L3 always discoverable.
 */
function L3Subsection({
  group,
  redact,
}: {
  group: L3Group;
  redact: boolean;
}) {
  return (
    <div className="space-y-2">
      <div
        id={`l3-${group.l3Id}`}
        className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-accent-purple/30 bg-accent-purple/[0.06] px-3 py-2.5 sm:px-4"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded border border-accent-purple/40 bg-accent-purple/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-accent-purple-dark"
              title="Hierarchy level"
            >
              L3
            </span>
            <span className="font-display text-sm font-semibold text-forge-ink">
              {group.l3Name}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-forge-hint">
              {group.totalActivityGroupCount}{" "}
              {group.totalActivityGroupCount === 1
                ? "Activity Group"
                : "Activity Groups"}
              {group.curatedL5Count > 0 ? (
                <>
                  {" · "}
                  {group.curatedL5Count} AI-eligible L5
                  {group.curatedL5Count === 1 ? " Activity" : " Activities"}
                </>
              ) : null}
              {group.placeholderL5Count > 0 ? (
                <>
                  {" "}
                  <span className="text-forge-subtle">
                    (+{group.placeholderL5Count} pending)
                  </span>
                </>
              ) : null}
            </span>
          </div>
          {group.l3Description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-forge-subtle">
              {group.l3Description}
            </p>
          ) : null}
        </div>
        {!redact ? (
          <div className="text-right">
            <div className="font-mono text-sm font-semibold tabular-nums text-forge-ink">
              {formatUsdCompact(group.totalAiUsd)}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-forge-hint">
              Modeled AI $
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * One curated (or placeholder) L5 Activity row inside an L4 Activity
 * Group's expanded panel.
 *
 * Renders the Versant-specific rationale, feasibility (ship-ready vs.
 * investigate), frequency, criticality, and maturity for an AI-eligible
 * L5 Activity, then offers click-through to the brief or full 4-lens
 * initiative when one is attached. Per-tower views deliberately do NOT
 * surface a priority chip — program priority is owned by the cross-tower
 * 2x2 and lives on the Cross-Tower AI Plan page.
 */
function L5ActivityRow({
  l5,
  l4,
  tower,
  index,
  rowId,
  review,
  actions,
}: {
  l5: InitiativeL4;
  l4: InitiativeL3;
  tower: Tower;
  index: number;
  rowId: string;
  review: InitiativeReview | undefined;
  actions: UseInitiativeReviewsResult["actions"];
}) {
  const feas = l5.isPlaceholder ? null : feasibilityChip(l5.feasibility);
  const initiative = l5.initiativeId
    ? tower.processes.find((p) => p.id === l5.initiativeId)
    : undefined;
  const initiativeHref = initiative
    ? `/tower/${tower.id}/process/${slugify(initiative.name)}`
    : undefined;
  const briefHref = l5.briefSlug
    ? `/tower/${tower.id}/brief/${l5.briefSlug}`
    : l5.llmBriefHref;
  const briefIsLLM = !l5.briefSlug && Boolean(l5.llmBriefHref);
  const isClickable = Boolean(initiativeHref || briefHref);

  const borderClass = l5.isPlaceholder
    ? "border-l-[3px] border-l-dashed border-l-forge-border"
    : initiative
      ? "border-l-[3px] border-l-accent-purple"
      : briefHref
        ? "border-l-[3px] border-dashed border-l-accent-purple/70"
        : "border-l-[3px] border-l-accent-purple/40";

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02, duration: 0.18 }}
      className={cn(
        "grid grid-cols-12 items-start gap-3 px-4 py-3 text-sm transition",
        borderClass,
        isClickable ? "hover:bg-accent-purple/5" : "",
      )}
    >
      <div className="col-span-12 min-w-0 md:col-span-6">
        <div className="flex items-start gap-2">
          <span
            className={cn(
              "mt-1.5 h-2 w-2 shrink-0 rounded-full",
              feas ? feas.dot : "bg-forge-border",
            )}
            aria-hidden
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded border border-forge-border bg-forge-well px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-forge-hint"
                title="Hierarchy level"
              >
                L5
              </span>
              <span
                className={cn(
                  "font-medium",
                  l5.isPlaceholder ? "italic text-forge-subtle" : "text-forge-ink",
                )}
              >
                {l5.initiativeName ?? l5.name}
              </span>
              {l5.source === "fuzzy-match" ? (
                <span
                  className="rounded-full border border-forge-border bg-forge-well px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-forge-hint"
                  title="Curated detail attached via name match. Will be confirmed in editorial sweep."
                >
                  inferred
                </span>
              ) : null}
              {l5.isPlaceholder ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-forge-border bg-forge-well px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-forge-hint"
                  title="AI couldn't identify L5 Activities that are candidates for AI here. Regenerate the L5 Activity list on Step 1, or reduce the AI dial for this L4 Activity Group to zero on Step 2."
                >
                  <Icons.CircleAlert className="h-2.5 w-2.5" />
                  no AI candidates
                </span>
              ) : null}
              <InitiativeReviewActions
                l4={l5}
                l3={l4}
                review={review}
                actions={actions}
                compact
              />
            </div>
            {l5.initiativeName && l5.initiativeName !== l5.name ? (
              <p
                className="mt-0.5 text-[11px] leading-snug text-forge-hint"
                title="The L5 Activity this AI initiative automates"
              >
                <span className="font-mono uppercase tracking-wider text-forge-hint/80">
                  Activity
                </span>{" "}
                · {l5.name}
              </p>
            ) : null}
            {l5.aiRationale ? (
              <p className="mt-1 text-xs leading-relaxed text-forge-subtle">
                {l5.aiRationale}
              </p>
            ) : null}
            {l5.isPlaceholder ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                <Link
                  href={`${getTowerHref(tower.id as Parameters<typeof getTowerHref>[0], "capability-map")}#generate-l4-toolbar`}
                  className="inline-flex items-center gap-1 rounded-md border border-forge-border bg-forge-surface px-2 py-0.5 text-forge-body transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
                  title="Open Step 1 and re-run Generate L5 Activities for this tower (LLM-first, canonical-map fallback)."
                  onClick={(e) => e.stopPropagation()}
                >
                  <Icons.RefreshCw className="h-3 w-3" />
                  Regenerate L5 list
                </Link>
                <Link
                  href={`${getTowerHref(tower.id as Parameters<typeof getTowerHref>[0], "impact-levers")}#l4-${rowId}`}
                  className="inline-flex items-center gap-1 rounded-md border border-forge-border bg-forge-surface px-2 py-0.5 text-forge-body transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
                  title="Open Step 2 and reduce the AI dial for this L4 Activity Group to zero."
                  onClick={(e) => e.stopPropagation()}
                >
                  <Icons.SlidersHorizontal className="h-3 w-3" />
                  Set dial to 0
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="col-span-4 text-xs md:col-span-2">
        {l5.frequency ? (
          <span className="inline-flex items-center rounded-full border border-forge-border bg-forge-well px-2 py-0.5 font-medium text-forge-body">
            {l5.frequency}
          </span>
        ) : null}
      </div>

      <div className="col-span-4 text-xs md:col-span-2">
        {l5.criticality ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 font-medium",
              CRITICALITY_ACCENT[l5.criticality] ?? "border-forge-border bg-forge-well",
            )}
          >
            {l5.criticality}
          </span>
        ) : null}
      </div>

      <div className="col-span-4 text-xs md:col-span-1">
        {l5.currentMaturity ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 font-medium",
              MATURITY_ACCENT[l5.currentMaturity] ?? "border-forge-border bg-forge-well",
            )}
          >
            {l5.currentMaturity}
          </span>
        ) : null}
      </div>

      <div className="col-span-12 flex items-center justify-between gap-2 md:col-span-1 md:justify-end">
        {feas ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              feas.badge,
            )}
            title={feas.tooltip}
          >
            <span className={cn("h-1 w-1 rounded-full", feas.dot)} aria-hidden />
            {feas.label}
          </span>
        ) : null}
        {isClickable ? (
          <Icons.ChevronRight className="h-4 w-4 text-forge-hint group-hover:text-accent-purple" />
        ) : null}
      </div>
    </motion.div>
  );

  if (initiativeHref) {
    return (
      <Link
        href={initiativeHref}
        className="group block border-b border-forge-border last:border-b-0"
        title="Open the full four-lens initiative design"
      >
        {content}
      </Link>
    );
  }
  if (briefHref) {
    return (
      <Link
        href={briefHref}
        className="group block border-b border-forge-border last:border-b-0"
        title={
          briefIsLLM
            ? "Generate a Versant-grounded LLM brief for this capability"
            : "Open the lightweight pre/post brief"
        }
      >
        {content}
      </Link>
    );
  }
  return (
    <div
      className="border-b border-forge-border last:border-b-0"
      title={l5.aiRationale ?? undefined}
    >
      {content}
    </div>
  );
}

/**
 * 3-row skeleton + spinner shown inside the expanded L4 Activity Group
 * panel while a single-row regenerate is mid-flight (`running-l5` /
 * `running-curate`). Replaces the live L5 Activity list so the user
 * doesn't briefly see stale or empty content during the interim
 * between Stage 1 and Stage 2 atomic writes.
 */
function L5ActivityListSkeleton({ stage }: { stage: CurationStage | undefined }) {
  const label =
    stage === "running-l5"
      ? "Generating new L5 Activities…"
      : "Re-scoring eligibility and feasibility…";
  return (
    <div className="space-y-2 px-4 py-4" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-2 text-xs text-forge-subtle">
        <Icons.Loader2 className="h-3.5 w-3.5 animate-spin text-accent-purple" aria-hidden />
        <span className="font-medium text-forge-body">{label}</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-forge-hint">
          this L4 only
        </span>
      </div>
      <div className="space-y-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-md border border-forge-border/60 bg-forge-well/40 px-4 py-3"
          >
            <div className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-forge-border" />
            <div className="h-3 flex-1 animate-pulse rounded bg-forge-border/70" />
            <div className="h-3 w-16 animate-pulse rounded bg-forge-border/50" />
            <div className="h-3 w-12 animate-pulse rounded bg-forge-border/50" />
          </div>
        ))}
      </div>
    </div>
  );
}

const REFINE_PLACEHOLDER = [
  "e.g. Split production automation by linear media and digital — they have very different workflows.",
  "e.g. What about automating the scheduling of make-up artists?",
].join("\n");

/**
 * Inline "Refine this Activity Group with feedback" panel rendered
 * inside the expanded L4 Activity Group detail. Captures session-only
 * qualitative feedback, runs the confirm flow, and calls the
 * single-row pipeline helper. Other L4 Activity Group rows on the page
 * are not touched by this action.
 */
function RefineActivityGroupPanel({
  towerId,
  rowId,
  activityGroupName,
  inFlight,
  rowStage,
}: {
  towerId: TowerId;
  rowId: string;
  activityGroupName: string;
  inFlight: boolean;
  rowStage: CurationStage | undefined;
}) {
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [feedback, setFeedback] = React.useState("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [running, setRunning] = React.useState(false);

  // The L4 Activity Group card outer wrapper is a <button>; every interactive
  // element inside the panel must stop propagation so the parent doesn't
  // toggle expand/collapse on every keystroke or click. Mirrors the existing
  // pattern used by the placeholder-remediation Link components in
  // L5ActivityRow.
  const stop = React.useCallback(
    (e: React.SyntheticEvent) => e.stopPropagation(),
    [],
  );

  const onSubmit = React.useCallback(
    async (e: React.MouseEvent) => {
      stop(e);
      setConfirmOpen(true);
    },
    [stop],
  );

  const onConfirm = React.useCallback(async () => {
    if (running) return;
    // Close the modal BEFORE the long-running LLM call so the user can
    // see the "Regenerate ideas" button spinner and the row hydrate
    // behind it. Native <dialog> blurs everything behind the backdrop,
    // so leaving it open during the 20-60s call hides every progress
    // signal.
    setConfirmOpen(false);
    setRunning(true);
    let summary: RegenerateRowSummary;
    try {
      summary = await regenerateRowWithFeedback({
        towerId,
        rowId,
        feedback: feedback.trim() || undefined,
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      toast.error({
        title: "Couldn't regenerate this Activity Group",
        description: error,
      });
      setRunning(false);
      return;
    }
    setRunning(false);
    if (!summary.ok) {
      toast.error({
        title: "Regenerate failed",
        description:
          (summary.error ?? "Unknown error.") +
          " The previous L5 Activity list and curation are intact.",
      });
      return;
    }
    setFeedback("");
    setOpen(false);
    const sourceLabel =
      summary.source === "llm"
        ? "Versant-grounded LLM"
        : summary.source === "fallback"
          ? "deterministic verdict composer"
          : null;
    const eligibleNote =
      summary.eligibleL4Count === 1 ? "is now AI-eligible" : "are now AI-eligible";
    toast.success({
      title: `Refreshed ${summary.l4Count} L5 Activit${summary.l4Count === 1 ? "y" : "ies"} for ${activityGroupName}`,
      description:
        (sourceLabel ? `Sourced via ${sourceLabel}. ` : "") +
        `${summary.eligibleL4Count} of ${summary.l4Count} ${eligibleNote}. Modeled $ for this L4 Activity Group is unchanged; per-Activity attribution rebalanced.` +
        (summary.warning ? ` ${summary.warning}` : ""),
      durationMs: 8000,
    });
  }, [feedback, activityGroupName, rowId, running, toast, towerId]);

  // The Refine button is disabled when ANY in-flight regen exists for the
  // tower (including a tower-wide refresh), to prevent races on conflicting
  // writes. Also disabled while this row's confirm is mid-flight.
  const disabled = running || inFlight;
  const disabledTooltip =
    running || rowStage === "running-l5" || rowStage === "running-curate"
      ? "Regeneration in progress for this Activity Group"
      : inFlight
        ? "Another regeneration is in progress for this tower"
        : undefined;

  return (
    <div
      className="border-b border-forge-border bg-accent-purple/[0.03] px-4 py-3"
      onClick={stop}
      onMouseDown={stop}
      onKeyDown={stop}
      role="presentation"
    >
      <button
        type="button"
        onClick={(e) => {
          stop(e);
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        className="inline-flex items-center gap-2 text-xs font-semibold text-accent-purple-dark hover:underline"
      >
        <Icons.Wand2 className="h-3.5 w-3.5" aria-hidden />
        Refine this Activity Group with feedback
        <Icons.ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition",
            open ? "rotate-180" : "",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="mt-2 space-y-2">
          <p className="text-[11px] leading-relaxed text-forge-subtle">
            <span className="font-mono text-forge-hint">›</span> Regenerating
            affects only this L4 Activity Group. Tower and program $ totals
            stay the same; per-Activity attribution rebalances. Approve /
            reject decisions on this Activity Group&rsquo;s previous L5
            Activities become orphans (still visible in the Rejected
            drawer).
          </p>
          <textarea
            value={feedback}
            onChange={(e) => {
              stop(e);
              setFeedback(e.target.value.slice(0, REFINE_FEEDBACK_MAX));
            }}
            onClick={stop}
            onMouseDown={stop}
            onKeyDown={stop}
            onFocus={stop}
            disabled={disabled}
            maxLength={REFINE_FEEDBACK_MAX}
            placeholder={REFINE_PLACEHOLDER}
            rows={3}
            className={cn(
              "block w-full resize-y rounded-md border border-forge-border bg-forge-surface px-3 py-2 text-xs leading-relaxed text-forge-ink shadow-sm",
              "placeholder:text-forge-hint focus:border-accent-purple/50 focus:outline-none focus:ring-2 focus:ring-accent-purple/30",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-forge-hint">
              {feedback.length} / {REFINE_FEEDBACK_MAX}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  setFeedback("");
                }}
                disabled={disabled || feedback.length === 0}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border border-forge-border bg-forge-surface px-2.5 py-1 text-[11px] font-medium text-forge-body transition",
                  "hover:border-forge-border-strong hover:text-forge-ink",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={disabled}
                title={disabledTooltip}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md bg-accent-purple px-3 py-1 text-[11px] font-semibold text-white shadow-sm transition",
                  "hover:bg-accent-purple-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/40",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                )}
              >
                {running ? (
                  <Icons.Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : (
                  <Icons.Sparkles className="h-3 w-3" aria-hidden />
                )}
                {running ? "Regenerating..." : "Regenerate ideas"}
              </button>
            </div>
          </div>
          {running ? (
            <div
              className="flex items-start gap-2 rounded-md border border-accent-purple/30 bg-accent-purple/[0.04] px-2.5 py-2 text-[11px] leading-relaxed text-forge-body"
              role="status"
              aria-live="polite"
            >
              <Icons.Loader2
                className="mt-0.5 h-3 w-3 shrink-0 animate-spin text-accent-purple"
                aria-hidden
              />
              <span className="min-w-0">
                Regenerating L5 Activities and AI scoring for this Activity
                Group. Typically 20-60 seconds — don&apos;t navigate away.
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={onConfirm}
        title={`Regenerate AI ideas for "${activityGroupName}"?`}
        confirmLabel="Regenerate"
        cancelLabel="Cancel"
        description={
          <div className="space-y-2 text-sm leading-relaxed text-forge-body">
            <p>
              This re-runs both the L5 Activity list and AI scoring for this
              Activity Group only. Other Activity Groups in this tower and
              every other tower are not touched.
            </p>
            <p>
              Modeled $ for this L4 Activity Group stays the same
              (it&rsquo;s driven by the dial on Step 2). Per-Activity
              dollar attribution will rebalance across the new list.
            </p>
            <p className="text-forge-subtle">
              Approve / reject decisions on this Activity Group&rsquo;s
              previous L5 Activities become orphans — they remain visible
              in the Rejected drawer with their captured snapshot.
            </p>
          </div>
        }
      />
    </div>
  );
}

/**
 * One L4 Activity Group row card with an expandable detail panel showing
 * AI-eligible L5 Activities.
 *
 * The header carries the Activity Group name (`row.rowL4Name`), the
 * modeled $ from `rowModeledSaving` (via the selector), the live AI
 * dial %, and a deep-link to Step 2 so the user can adjust the dial
 * without losing context.
 */
function L4ActivityGroupCard({
  row,
  tower,
  expanded,
  onToggle,
  reviews,
  actions,
  showBreadcrumb = true,
  rowStage,
  rowError,
  anyInFlight,
}: {
  row: InitiativeL3;
  tower: Tower;
  expanded: boolean;
  onToggle: () => void;
  reviews: Record<string, InitiativeReview>;
  actions: UseInitiativeReviewsResult["actions"];
  showBreadcrumb?: boolean;
  rowStage: CurationStage | undefined;
  rowError: string | undefined;
  anyInFlight: boolean;
}) {
  const redact = useRedactDollars();
  // Surface the strongest feasibility signal under this Activity Group —
  // if any L5 is ship-ready, the L4 carries a "Ship-ready" badge so leads
  // can scan for Activity Groups ready to move now. Final program priority
  // lives on the cross-tower 2x2.
  const headlineFeasibility = React.useMemo<"High" | "Low" | null>(() => {
    let sawLow = false;
    for (const l5 of row.l4s) {
      if (l5.isPlaceholder) continue;
      if (l5.feasibility === "High") return "High";
      if (l5.feasibility === "Low") sawLow = true;
    }
    return sawLow ? "Low" : null;
  }, [row.l4s]);
  const headlineChip = headlineFeasibility ? feasibilityChip(headlineFeasibility) : null;

  const stepTwoHref = `${getTowerHref(tower.id as Parameters<typeof getTowerHref>[0], "impact-levers")}#l4-${row.rowId}`;

  return (
    <div
      className={cn(
        "group rounded-2xl border bg-forge-surface shadow-sm transition",
        expanded ? "border-accent-purple/40 shadow-card" : "border-forge-border",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded border border-forge-border bg-forge-well px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-forge-hint"
              title="Hierarchy level"
            >
              L4
            </span>
            <span className="font-display text-sm font-semibold text-forge-ink">
              {row.rowL4Name}
            </span>
            {headlineChip ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  headlineChip.badge,
                )}
                title={headlineChip.tooltip}
              >
                <span className={cn("h-1 w-1 rounded-full", headlineChip.dot)} aria-hidden />
                {headlineChip.label}
              </span>
            ) : null}
            <span className="font-mono text-[10px] uppercase tracking-wider text-forge-hint">
              {row.l4s.length}{" "}
              {row.l4s.length === 1 ? "L5 Activity" : "L5 Activities"}
            </span>
          </div>
          {showBreadcrumb ? (
            <p className="mt-1 font-mono text-[11px] text-forge-hint">
              {row.l2Name} · {row.l3.name} · {row.rowL4Name}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-3 text-right">
          <div>
            <div className="font-mono text-base font-semibold tabular-nums text-forge-ink">
              {redact ? "—" : formatUsdCompact(row.aiUsd)}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-forge-hint">
              AI dial · {Math.round(row.aiPct)}%
            </div>
          </div>
          <Icons.ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-forge-hint transition",
              expanded ? "rotate-180 text-accent-purple-dark" : "",
            )}
            aria-hidden
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden border-t border-forge-border"
          >
            <RefineActivityGroupPanel
              towerId={tower.id as TowerId}
              rowId={row.rowId}
              activityGroupName={row.rowL4Name}
              inFlight={anyInFlight}
              rowStage={rowStage}
            />

            {rowStage === "failed" && rowError ? (
              <div className="flex items-start gap-2 border-b border-accent-red/30 bg-accent-red/[0.06] px-4 py-2 text-[11px] leading-relaxed text-forge-body">
                <Icons.AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-red" aria-hidden />
                <span>
                  <span className="font-semibold text-forge-ink">Previous regenerate failed:</span>{" "}
                  {rowError} The L5 Activity list below is the last successful version.
                </span>
              </div>
            ) : null}

            {rowStage === "running-l5" || rowStage === "running-curate" ? (
              <L5ActivityListSkeleton stage={rowStage} />
            ) : (
              <>
                <div className="hidden grid-cols-12 gap-3 border-b border-forge-border bg-forge-well/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-forge-hint md:grid">
                  <div className="col-span-6">Activity (L5)</div>
                  <div className="col-span-2">Frequency</div>
                  <div className="col-span-2">Criticality</div>
                  <div className="col-span-1">Maturity</div>
                  <div
                    className="col-span-1 text-right"
                    title="Ship-ready vs. Investigate. Final program priority is set on the Cross-Tower AI Plan via the feasibility × business-impact 2x2."
                  >
                    Feasibility
                  </div>
                </div>

                <div>
                  {row.l4s.map((l5, i) => (
                    <L5ActivityRow
                      key={l5.id}
                      l5={l5}
                      l4={row}
                      tower={tower}
                      index={i}
                      rowId={row.rowId}
                      review={reviews[l5.id]}
                      actions={actions}
                    />
                  ))}
                </div>
              </>
            )}

            <div className="flex items-center justify-between gap-2 border-t border-forge-border bg-forge-well/40 px-4 py-2 text-[11px] text-forge-subtle">
              <span>
                Per-L4 Activity Group AI $ matches the dial set on Step 2 —
                change once, both surfaces update.
              </span>
              <Link
                href={stepTwoHref}
                className="inline-flex items-center gap-1 rounded-full border border-forge-border bg-forge-surface px-2.5 py-1 font-medium text-forge-body hover:border-accent-purple/40 hover:text-accent-purple-dark"
                title="Adjust the AI dial for this Activity Group on Step 2"
              >
                <Icons.SlidersHorizontal className="h-3 w-3" />
                Adjust dial in Step 2
                <Icons.ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * V5 capability hierarchy renderer: L2 Section -> L3 sub-section band ->
 * L4 Activity Group card -> expandable list of L5 Activities.
 *
 *   - L2 sections come straight from the selector (`InitiativeL2`) with
 *     a sticky bordered header. One per Job Grouping.
 *   - L3 sub-sections are computed locally via `groupRowsByL3`. Distinct
 *     L3 Job Families bucket the rows so multi-row Job Families collapse
 *     into one band instead of N look-alike cards. The band is display-
 *     only (not collapsible, not sticky) so the L4 cards underneath own
 *     the expand interaction without competing.
 *   - L4 Activity Group cards are one-per-row (each `InitiativeL3`
 *     entry IS one workforce row = one Activity Group). Header carries
 *     the Activity Group name, headline feasibility, modeled AI $, and
 *     the live dial %. Click to expand.
 *   - L5 Activity rows are the AI initiatives surfaced under the
 *     Activity Group — rationale, feasibility, frequency, criticality,
 *     maturity, with click-through to the brief or full 4-lens initiative.
 *
 * The expanded-state set is keyed by `${l2Id}::${l3Id}::${rowId}` so
 * "two L4 Activity Groups happen to share a name in different L2/L3"
 * still expand independently.
 */
export function ProcessLandscape({
  l2s,
  tower,
  reviews,
  actions,
}: {
  l2s: InitiativeL2[];
  tower: Tower;
  reviews: Record<string, InitiativeReview>;
  actions: UseInitiativeReviewsResult["actions"];
}) {
  const redact = useRedactDollars();
  const [expandedL4Keys, setExpandedL4Keys] = React.useState<Set<string>>(
    () => new Set(),
  );
  const { byRowId: rowStages, anyInFlight } = useTowerCurationStages(
    tower.id as TowerId,
  );

  const toggleL4 = React.useCallback(
    (l2Id: string, l3Id: string, rowId: string) => {
      const key = `${l2Id}::${l3Id}::${rowId}`;
      setExpandedL4Keys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    [],
  );

  const collapseAll = React.useCallback(() => {
    setExpandedL4Keys(new Set());
  }, []);

  const anyExpanded = expandedL4Keys.size > 0;

  return (
    <div className="space-y-6">
      {l2s.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="max-w-3xl text-xs text-forge-subtle">
            The{" "}
            <span className="font-medium text-forge-body">Feasibility roster</span>{" "}
            tab groups ship-ready vs. investigate ideas for this tower; this view
            is the full scoped set. Expand an L4 Activity Group card for its L5
            Activities. Final program priority (P1/P2/P3) is set on the
            Cross-Tower AI Plan via the feasibility × business-impact 2x2.
          </p>
          {anyExpanded ? (
            <button
              type="button"
              onClick={collapseAll}
              className="shrink-0 text-xs font-medium text-accent-purple-dark hover:underline"
            >
              Collapse all
            </button>
          ) : null}
        </div>
      ) : null}

      {l2s.map((l2) => {
        const Icon = resolveIcon(l2.l2.icon);
        const l3Groups = groupRowsByL3(l2);
        return (
          <motion.section
            key={l2.l2.id}
            id={`l2-${l2.l2.id}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden scroll-mt-24 rounded-2xl border border-forge-border bg-forge-surface shadow-card"
          >
            <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-forge-border bg-forge-well/95 px-4 py-3 backdrop-blur-sm sm:px-5 sm:py-4">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span
                  className="mt-0.5 rounded border border-forge-border bg-forge-surface px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-forge-hint"
                  title="Hierarchy level"
                >
                  L2
                </span>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent-purple/40 bg-accent-purple/10 text-accent-purple-dark">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="font-display text-lg font-semibold text-forge-ink">
                    {l2.l2.name}
                  </div>
                  {l2.l2.description ? (
                    <p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-forge-subtle">
                      {l2.l2.description}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-right text-xs text-forge-subtle sm:flex-row sm:items-center sm:gap-4">
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-forge-hint">
                    AI-eligible L5 Activities
                  </div>
                  <div className="font-mono text-sm font-semibold tabular-nums text-forge-ink">
                    {l2.curatedL4Count}
                    {l2.placeholderL4Count > 0 ? (
                      <span className="font-normal text-forge-hint">
                        {" "}
                        (+{l2.placeholderL4Count} pending)
                      </span>
                    ) : null}
                  </div>
                </div>
                {!redact ? (
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-forge-hint">
                      AI impact
                    </div>
                    <div className="font-mono text-lg font-semibold tabular-nums text-forge-ink">
                      {formatUsdCompact(l2.totalAiUsd)}
                    </div>
                  </div>
                ) : null}
              </div>
            </header>

            <div className="overflow-x-auto">
              <div className="min-w-[min(100%,640px)] space-y-5 p-4 sm:p-5">
                {l3Groups.map((group) => (
                  <div key={group.l3Id} className="space-y-2">
                    <L3Subsection group={group} redact={redact} />
                    <div className="space-y-2">
                      {group.rows.map((row) => {
                        const key = `${l2.l2.id}::${group.l3Id}::${row.rowId}`;
                        const stageState = rowStages.get(row.rowId);
                        return (
                          <L4ActivityGroupCard
                            key={row.rowId}
                            row={row}
                            tower={tower}
                            expanded={expandedL4Keys.has(key)}
                            onToggle={() =>
                              toggleL4(l2.l2.id, group.l3Id, row.rowId)
                            }
                            reviews={reviews}
                            actions={actions}
                            showBreadcrumb
                            rowStage={stageState?.stage}
                            rowError={stageState?.error}
                            anyInFlight={anyInFlight}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>
        );
      })}
    </div>
  );
}
