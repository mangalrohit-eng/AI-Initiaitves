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
import { TIER_STYLES, priorityTier } from "@/lib/priority";
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
 *   - `byRowId`: per-row `{ stage, error }` snapshot keyed by `L3WorkforceRow.id`.
 *   - `anyInFlight`: true iff at least one row in the tower is `running-l4`,
 *     `running-verdict`, or `running-curate` — used to disable the per-L3 Refine
 *     button while another regen (single-row OR tower-wide) is mid-flight,
 *     mirroring the cross-disable pattern in `RegenerateAiGuidanceToolbar`.
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
    const rows = program.towers[towerId]?.l3Rows ?? [];
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

/**
 * One curated (or placeholder) L4 row inside an L3's expanded panel.
 *
 * Renders the Versant-specific rationale, P-tier, frequency, criticality,
 * and maturity for an AI-eligible activity, then offers click-through to the
 * brief or full 4-lens initiative when one is attached.
 */
function L4Row({
  l4,
  l3,
  tower,
  index,
  rowId,
  review,
  actions,
}: {
  l4: InitiativeL4;
  l3: InitiativeL3;
  tower: Tower;
  index: number;
  rowId: string;
  review: InitiativeReview | undefined;
  actions: UseInitiativeReviewsResult["actions"];
}) {
  const tier = priorityTier(l4.aiPriority);
  const initiative = l4.initiativeId
    ? tower.processes.find((p) => p.id === l4.initiativeId)
    : undefined;
  const initiativeHref = initiative
    ? `/tower/${tower.id}/process/${slugify(initiative.name)}`
    : undefined;
  const briefHref = l4.briefSlug
    ? `/tower/${tower.id}/brief/${l4.briefSlug}`
    : l4.llmBriefHref;
  const briefIsLLM = !l4.briefSlug && Boolean(l4.llmBriefHref);
  const isClickable = Boolean(initiativeHref || briefHref);

  const borderClass = l4.isPlaceholder
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
        tier ? TIER_STYLES[tier].row : "bg-transparent",
        isClickable ? "hover:bg-accent-purple/5" : "",
      )}
    >
      <div className="col-span-12 min-w-0 md:col-span-6">
        <div className="flex items-start gap-2">
          {tier ? (
            <span
              className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", TIER_STYLES[tier].dot)}
              aria-hidden
            />
          ) : (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-forge-border" aria-hidden />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded border border-forge-border bg-forge-well px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-forge-hint"
                title="Hierarchy level"
              >
                L4
              </span>
              <span
                className={cn(
                  "font-medium",
                  l4.isPlaceholder ? "italic text-forge-subtle" : "text-forge-ink",
                )}
              >
                {l4.name}
              </span>
              {l4.source === "fuzzy-match" ? (
                <span
                  className="rounded-full border border-forge-border bg-forge-well px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-forge-hint"
                  title="Curated detail attached via name match. Will be confirmed in editorial sweep."
                >
                  inferred
                </span>
              ) : null}
              {l4.isPlaceholder ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-forge-border bg-forge-well px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-forge-hint"
                  title="AI couldn't identify L4 activities that are candidates for AI here. Regenerate the L4 list on Step 1, or reduce the AI dial for this L3 to zero on Step 2."
                >
                  <Icons.CircleAlert className="h-2.5 w-2.5" />
                  no AI candidates
                </span>
              ) : null}
              <InitiativeReviewActions
                l4={l4}
                l3={l3}
                review={review}
                actions={actions}
                compact
              />
            </div>
            {l4.aiRationale ? (
              <p className="mt-1 text-xs leading-relaxed text-forge-subtle">
                {l4.aiRationale}
              </p>
            ) : null}
            {l4.isPlaceholder ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                <Link
                  href={`${getTowerHref(tower.id as Parameters<typeof getTowerHref>[0], "capability-map")}#generate-l4-toolbar`}
                  className="inline-flex items-center gap-1 rounded-md border border-forge-border bg-forge-surface px-2 py-0.5 text-forge-body transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
                  title="Open Step 1 and re-run Generate L4 activities for this tower (LLM-first, canonical-map fallback)."
                  onClick={(e) => e.stopPropagation()}
                >
                  <Icons.RefreshCw className="h-3 w-3" />
                  Regenerate L4 list
                </Link>
                <Link
                  href={`${getTowerHref(tower.id as Parameters<typeof getTowerHref>[0], "impact-levers")}#l3-${rowId}`}
                  className="inline-flex items-center gap-1 rounded-md border border-forge-border bg-forge-surface px-2 py-0.5 text-forge-body transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
                  title="Open Step 2 and reduce the AI dial for this L3 to zero."
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
        {l4.frequency ? (
          <span className="inline-flex items-center rounded-full border border-forge-border bg-forge-well px-2 py-0.5 font-medium text-forge-body">
            {l4.frequency}
          </span>
        ) : null}
      </div>

      <div className="col-span-4 text-xs md:col-span-2">
        {l4.criticality ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 font-medium",
              CRITICALITY_ACCENT[l4.criticality] ?? "border-forge-border bg-forge-well",
            )}
          >
            {l4.criticality}
          </span>
        ) : null}
      </div>

      <div className="col-span-4 text-xs md:col-span-1">
        {l4.currentMaturity ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 font-medium",
              MATURITY_ACCENT[l4.currentMaturity] ?? "border-forge-border bg-forge-well",
            )}
          >
            {l4.currentMaturity}
          </span>
        ) : null}
      </div>

      <div className="col-span-12 flex items-center justify-between gap-2 md:col-span-1 md:justify-end">
        {tier ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
              TIER_STYLES[tier].badge,
            )}
          >
            {tier}
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
      title={l4.aiRationale ?? undefined}
    >
      {content}
    </div>
  );
}

/**
 * 3-row skeleton + spinner shown inside the expanded L3 panel while a single-L3
 * regenerate is mid-flight (`running-l4` / `running-curate`). Replaces the live
 * L4 list so the user doesn't briefly see stale or empty content during the
 * interim between Stage 1 and Stage 2 atomic writes.
 */
function L4ListSkeleton({ stage }: { stage: CurationStage | undefined }) {
  const label =
    stage === "running-l4"
      ? "Generating new activities…"
      : "Re-scoring eligibility and priority…";
  return (
    <div className="space-y-2 px-4 py-4" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-2 text-xs text-forge-subtle">
        <Icons.Loader2 className="h-3.5 w-3.5 animate-spin text-accent-purple" aria-hidden />
        <span className="font-medium text-forge-body">{label}</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-forge-hint">
          this L3 only
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
 * Inline "Refine this capability with feedback" panel rendered inside the
 * expanded L3 detail. Captures session-only qualitative feedback, runs the
 * confirm flow, and calls the single-row pipeline helper. Other L3 rows on
 * the page are not touched by this action.
 */
function RefineL3Panel({
  towerId,
  rowId,
  l3Name,
  inFlight,
  rowStage,
}: {
  towerId: TowerId;
  rowId: string;
  l3Name: string;
  inFlight: boolean;
  rowStage: CurationStage | undefined;
}) {
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [feedback, setFeedback] = React.useState("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [running, setRunning] = React.useState(false);

  // The L3 card outer wrapper is a <button>; every interactive element inside
  // the panel must stop propagation so the parent doesn't toggle expand/collapse
  // on every keystroke or click. Mirrors the existing pattern used by the
  // placeholder-remediation Link components in L4Row.
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
        title: "Couldn't regenerate this capability",
        description: error,
      });
      setRunning(false);
      setConfirmOpen(false);
      return;
    }
    setRunning(false);
    setConfirmOpen(false);
    if (!summary.ok) {
      toast.error({
        title: "Regenerate failed",
        description:
          (summary.error ?? "Unknown error.") +
          " The previous activity list and curation are intact.",
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
      title: `Refreshed ${summary.l4Count} activit${summary.l4Count === 1 ? "y" : "ies"} for ${l3Name}`,
      description:
        (sourceLabel ? `Sourced via ${sourceLabel}. ` : "") +
        `${summary.eligibleL4Count} of ${summary.l4Count} ${eligibleNote}. Modeled $ for this L3 is unchanged; per-activity attribution rebalanced.` +
        (summary.warning ? ` ${summary.warning}` : ""),
      durationMs: 8000,
    });
  }, [feedback, l3Name, rowId, running, toast, towerId]);

  // The Refine button is disabled when ANY in-flight regen exists for the
  // tower (including a tower-wide refresh), to prevent races on conflicting
  // writes. Also disabled while this row's confirm is mid-flight.
  const disabled = running || inFlight;
  const disabledTooltip =
    running || rowStage === "running-l4" || rowStage === "running-curate"
      ? "Regeneration in progress for this capability"
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
        Refine this capability with feedback
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
            affects only this L3. Tower and program $ totals stay the same;
            per-activity attribution rebalances. Approve / reject decisions on
            this L3&rsquo;s previous activities become orphans (still visible
            in the Rejected drawer).
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
                Regenerate ideas
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          if (!running) setConfirmOpen(false);
        }}
        onConfirm={onConfirm}
        title={`Regenerate AI ideas for "${l3Name}"?`}
        busy={running}
        confirmLabel={running ? "Regenerating…" : "Regenerate"}
        cancelLabel="Cancel"
        description={
          <div className="space-y-2 text-sm leading-relaxed text-forge-body">
            <p>
              This re-runs both the activity list and AI scoring for this
              capability only. Other L3s in this tower and every other tower
              are not touched.
            </p>
            <p>
              Modeled $ for this L3 stays the same (it&rsquo;s driven by the
              dial on Step 2). Per-activity dollar attribution will rebalance
              across the new list.
            </p>
            <p className="text-forge-subtle">
              Approve / reject decisions on this L3&rsquo;s previous activities
              become orphans — they remain visible in the Rejected drawer with
              their captured snapshot.
            </p>
          </div>
        }
      />
    </div>
  );
}

/**
 * One L3 row with an expandable detail panel showing AI-eligible L4s.
 *
 * The header carries the modeled $ from `rowModeledSaving` (via the selector),
 * the live AI dial %, and a deep-link to Step 2 so the user can adjust the
 * dial without losing context.
 */
function L3RowCard({
  l3,
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
  l3: InitiativeL3;
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
  const maxTier = React.useMemo(() => {
    const tiers = l3.l4s.map((l) => priorityTier(l.aiPriority)).filter(Boolean);
    if (tiers.includes("P1")) return "P1" as const;
    if (tiers.includes("P2")) return "P2" as const;
    if (tiers.includes("P3")) return "P3" as const;
    return null;
  }, [l3.l4s]);

  const stepTwoHref = `${getTowerHref(tower.id as Parameters<typeof getTowerHref>[0], "impact-levers")}#l3-${l3.rowId}`;

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
              L3
            </span>
            <span className="font-display text-sm font-semibold text-forge-ink">
              {l3.l3.name}
            </span>
            {maxTier ? (
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  TIER_STYLES[maxTier].badge,
                )}
                title={`Highest priority of any AI-eligible activity in this capability: ${maxTier}`}
              >
                {maxTier}
              </span>
            ) : null}
            <span className="font-mono text-[10px] uppercase tracking-wider text-forge-hint">
              {l3.l4s.length}{" "}
              {l3.l4s.length === 1 ? "activity" : "activities"}
            </span>
          </div>
          {showBreadcrumb ? (
            <p className="mt-1 font-mono text-[11px] text-forge-hint">
              {l3.l2Name} · {l3.l3.name}
            </p>
          ) : null}
          {l3.l3.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-forge-subtle">
              {l3.l3.description}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-3 text-right">
          <div>
            <div className="font-mono text-base font-semibold tabular-nums text-forge-ink">
              {redact ? "—" : formatUsdCompact(l3.aiUsd)}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-forge-hint">
              AI dial · {Math.round(l3.aiPct)}%
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
            <RefineL3Panel
              towerId={tower.id as TowerId}
              rowId={l3.rowId}
              l3Name={l3.l3.name}
              inFlight={anyInFlight}
              rowStage={rowStage}
            />

            {rowStage === "failed" && rowError ? (
              <div className="flex items-start gap-2 border-b border-accent-red/30 bg-accent-red/[0.06] px-4 py-2 text-[11px] leading-relaxed text-forge-body">
                <Icons.AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-red" aria-hidden />
                <span>
                  <span className="font-semibold text-forge-ink">Previous regenerate failed:</span>{" "}
                  {rowError} The activity list below is the last successful version.
                </span>
              </div>
            ) : null}

            {rowStage === "running-l4" || rowStage === "running-curate" ? (
              <L4ListSkeleton stage={rowStage} />
            ) : (
              <>
                <div className="hidden grid-cols-12 gap-3 border-b border-forge-border bg-forge-well/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-forge-hint md:grid">
                  <div className="col-span-6">Activity (L4)</div>
                  <div className="col-span-2">Frequency</div>
                  <div className="col-span-2">Criticality</div>
                  <div className="col-span-1">Maturity</div>
                  <div className="col-span-1 text-right">Priority</div>
                </div>

                <div>
                  {l3.l4s.map((l4, i) => (
                    <L4Row
                      key={l4.id}
                      l4={l4}
                      l3={l3}
                      tower={tower}
                      index={i}
                      rowId={l3.rowId}
                      review={reviews[l4.id]}
                      actions={actions}
                    />
                  ))}
                </div>
              </>
            )}

            <div className="flex items-center justify-between gap-2 border-t border-forge-border bg-forge-well/40 px-4 py-2 text-[11px] text-forge-subtle">
              <span>
                Per-L3 AI $ matches the dial set on Step 2 — change once, both
                surfaces update.
              </span>
              <Link
                href={stepTwoHref}
                className="inline-flex items-center gap-1 rounded-full border border-forge-border bg-forge-surface px-2.5 py-1 font-medium text-forge-body hover:border-accent-purple/40 hover:text-accent-purple-dark"
                title="Adjust the AI dial for this capability on Step 2"
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
 * Nested L2 sections with L3 rows (L4 expands per L3). All L2s visible;
 * L3 panels start collapsed.
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
  const [expandedL3Keys, setExpandedL3Keys] = React.useState<Set<string>>(
    () => new Set(),
  );
  const { byRowId: rowStages, anyInFlight } = useTowerCurationStages(
    tower.id as TowerId,
  );

  const toggleL3 = React.useCallback((l2Id: string, l3Id: string) => {
    const key = `${l2Id}::${l3Id}`;
    setExpandedL3Keys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const collapseAll = React.useCallback(() => {
    setExpandedL3Keys(new Set());
  }, []);

  const anyExpanded = expandedL3Keys.size > 0;

  return (
    <div className="space-y-6">
      {l2s.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="max-w-3xl text-xs text-forge-subtle">
            The{" "}
            <span className="font-medium text-forge-body">Priority roadmap</span>{" "}
            tab lists only P1–P3-tagged activities; this view is the full scoped
            set. Expand an L3 row for L4 activities.
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
                    AI-eligible activities
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
              <div className="min-w-[min(100%,640px)] space-y-2 p-4 sm:p-5">
                {l2.l3s.map((l3) => {
                  const key = `${l2.l2.id}::${l3.l3.id}`;
                  const stageState = rowStages.get(l3.rowId);
                  return (
                    <L3RowCard
                      key={l3.l3.id}
                      l3={l3}
                      tower={tower}
                      expanded={expandedL3Keys.has(key)}
                      onToggle={() => toggleL3(l2.l2.id, l3.l3.id)}
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
          </motion.section>
        );
      })}
    </div>
  );
}
