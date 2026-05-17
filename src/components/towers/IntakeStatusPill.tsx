"use client";

import * as React from "react";
import { CheckCircle2, Loader2, Circle, ChevronDown } from "lucide-react";
import type { IntakeStatusEntry } from "@/data/assess/types";
import {
  INTAKE_STATUS_COLORS,
  INTAKE_STATUS_LABELS,
  intakeFieldLabel,
} from "@/lib/assess/towerReadinessIntake";
import { cn } from "@/lib/utils";

/**
 * Tri-state pill — Done / In Progress / Not Done — driven by a tower's
 * AI Readiness Intake. Used on `SolutionCardV2`, the initiative deep-
 * dive page, and the cross-tower `AIProjectsModule` card grid so the
 * visual rhythm of the classification stays consistent everywhere.
 *
 * Modes:
 *   - `mode="pill"` (default) — a small status chip in the card chip row.
 *     For `done` / `in-progress` the chip is clickable: it stops click
 *     propagation (so it doesn't trigger the card's deep-dive `<Link>`)
 *     and toggles a small evidence panel BELOW the card body (rendered
 *     by the parent via `expanded` + `onToggle`). For `not-done` the
 *     chip is muted and non-interactive.
 *
 *   - `mode="block"` — a larger evidence card used by the deep-dive
 *     route and the cross-tower module's tooltip / drawer. Renders the
 *     verbatim quote inline along with the source field caption and
 *     classifiedAt timestamp.
 *
 * Color map (single source of truth in `INTAKE_STATUS_COLORS`):
 *   - Done        → Accent Green (#00C853)
 *   - In Progress → Accent Amber (#FFB300)
 *   - Not Done    → muted forge-subtle
 */
export function IntakeStatusPill({
  intakeStatus,
  expanded,
  onToggle,
  stale,
  size = "md",
  ariaIdSuffix,
}: {
  intakeStatus: IntakeStatusEntry;
  /** Controlled-disclosure state for the inline evidence panel. */
  expanded?: boolean;
  /** Toggle callback — host renders the panel via `IntakeStatusEvidencePanel`. */
  onToggle?: () => void;
  /** True when the classification predates the latest intake import. */
  stale?: boolean;
  size?: "sm" | "md";
  ariaIdSuffix?: string;
}) {
  const { status } = intakeStatus;
  const color = INTAKE_STATUS_COLORS[status];
  const label = INTAKE_STATUS_LABELS[status];
  const Icon =
    status === "done"
      ? CheckCircle2
      : status === "in-progress"
        ? Loader2
        : Circle;
  const expandable = status !== "not-done" && !!onToggle;
  const padding = size === "sm" ? "px-1.5 py-0" : "px-2 py-0.5";
  const fontSize = size === "sm" ? "text-[10px]" : "text-[10px]";

  const baseClasses = cn(
    "inline-flex items-center gap-1 rounded-full border font-mono uppercase tracking-wider",
    fontSize,
    padding,
    color.chip,
    expandable
      ? "cursor-pointer transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/40"
      : "",
  );

  const content = (
    <>
      <Icon className="h-2.5 w-2.5" aria-hidden />
      <span>{label}</span>
      {expandable ? (
        <ChevronDown
          className={cn(
            "h-2.5 w-2.5 transition-transform",
            expanded ? "rotate-180" : "",
          )}
          aria-hidden
        />
      ) : null}
    </>
  );

  const tooltip = stale
    ? `${label} — classification predates latest intake; will refresh on next regenerate`
    : `${label} per AI Readiness Intake (${intakeFieldLabel(intakeStatus.evidenceField)})`;

  if (!expandable) {
    return (
      <span className={baseClasses} title={tooltip}>
        {content}
      </span>
    );
  }

  const ariaControls = ariaIdSuffix
    ? `intake-evidence-${ariaIdSuffix}`
    : undefined;
  return (
    <button
      type="button"
      className={baseClasses}
      title={tooltip}
      aria-expanded={!!expanded}
      aria-controls={ariaControls}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle?.();
      }}
    >
      {content}
    </button>
  );
}

/**
 * Inline evidence panel rendered BELOW a card body when the user
 * expands the `IntakeStatusPill`. Surfaces the verbatim 15-60 word
 * quote, the source-field caption, and (optionally) the originating
 * tower for the cross-tower view.
 *
 * Click handling: the panel itself stops propagation so click-to-collapse
 * works without firing the card's deep-dive `<Link>`.
 */
export function IntakeStatusEvidencePanel({
  intakeStatus,
  towerName,
  ariaIdSuffix,
  stale,
}: {
  intakeStatus: IntakeStatusEntry;
  /** When set, renders "From <towerName> intake — <field label>". */
  towerName?: string;
  ariaIdSuffix?: string;
  stale?: boolean;
}) {
  const { evidence, evidenceField } = intakeStatus;
  if (!evidence) return null;
  const id = ariaIdSuffix ? `intake-evidence-${ariaIdSuffix}` : undefined;
  const fieldLabel = intakeFieldLabel(evidenceField);
  const fromCaption = towerName
    ? `From ${towerName} intake — ${fieldLabel}`
    : `From: ${fieldLabel}`;
  return (
    <div
      id={id}
      role="region"
      aria-label="Intake evidence"
      className="mt-2 rounded-xl border border-forge-border/70 bg-forge-well/40 p-2.5"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-[11px] italic leading-relaxed text-forge-body">
        &ldquo;{evidence}&rdquo;
      </p>
      <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-forge-hint">
        <span className="text-accent-purple-dark">&gt;</span> {fromCaption}
      </p>
      {stale ? (
        <p className="mt-1 text-[10px] text-forge-hint">
          Classification predates latest intake import — will refresh on next
          regenerate.
        </p>
      ) : null}
    </div>
  );
}
