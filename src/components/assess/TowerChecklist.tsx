"use client";

import * as React from "react";
import { Check, CircleAlert, Lock, Unlock } from "lucide-react";
import type { TowerAssessReview, TowerAssessState } from "@/data/assess/types";

export type ChecklistKey =
  | "capabilityMapConfirmedAt"
  | "headcountConfirmedAt"
  | "offshoreConfirmedAt"
  | "aiConfirmedAt";

type Step = {
  key: ChecklistKey;
  label: string;
  description: string;
  /** When false, this step's confirm button is disabled (with the gating reason as title). */
  enabled: boolean;
  disabledReason?: string;
};

type Props = {
  state: TowerAssessState;
  /** Whether the user has loaded any L4 rows (gates step 2-4). */
  hasRows: boolean;
  /** Whether at least one row has non-zero headcount (gates step 2). */
  hasHeadcount: boolean;
  /** Whether at least one L4 explicit offshore% is set (gates step 3). */
  hasAnyOffshoreInput: boolean;
  /** Whether at least one L4 explicit AI% is set (gates step 4). */
  hasAnyAiInput: boolean;
  /** Tower considered complete (status === "complete"). */
  isComplete: boolean;
  onConfirm: (key: ChecklistKey) => void;
  onMarkComplete: () => void;
  onUnmarkComplete: () => void;
};

/**
 * 5-step explicit-confirmation checklist. Auto-detection is intentionally
 * avoided so seeded starter defaults can never trick a tower lead into
 * Mark-complete without having actually reviewed the data.
 */
export function TowerChecklist({
  state,
  hasRows,
  hasHeadcount,
  hasAnyOffshoreInput,
  hasAnyAiInput,
  isComplete,
  onConfirm,
  onMarkComplete,
  onUnmarkComplete,
}: Props) {
  // Backfill: legacy snapshots that pre-date the four `*ConfirmedAt` fields
  // but were marked status === "complete" should read as fully reviewed.
  const review: TowerAssessReview = React.useMemo(() => {
    if (!isComplete) return state;
    const stamp = state.lastUpdated ?? new Date(0).toISOString();
    return {
      capabilityMapConfirmedAt: state.capabilityMapConfirmedAt ?? stamp,
      headcountConfirmedAt: state.headcountConfirmedAt ?? stamp,
      offshoreConfirmedAt: state.offshoreConfirmedAt ?? stamp,
      aiConfirmedAt: state.aiConfirmedAt ?? stamp,
    };
  }, [state, isComplete]);

  const steps: Step[] = [
    {
      key: "capabilityMapConfirmedAt",
      label: "Capability map reviewed",
      description: "L1 to L4 reflects what this tower actually does.",
      enabled: hasRows,
      disabledReason: hasRows
        ? undefined
        : "Load the sample workshop or upload a footprint first.",
    },
    {
      key: "headcountConfirmedAt",
      label: "Headcount entered",
      description: "FTE / contractor onshore / offshore set per L4.",
      enabled: hasRows && hasHeadcount,
      disabledReason: !hasRows
        ? "Load the sample or upload a footprint first."
        : !hasHeadcount
          ? "Enter headcount on at least one L4 row first."
          : undefined,
    },
    {
      key: "offshoreConfirmedAt",
      label: "Offshore dials reviewed",
      description: "0 to 100 set per L4 — defaults overridden where they should be.",
      enabled: hasRows && hasAnyOffshoreInput,
      disabledReason:
        !hasRows
          ? "Load the sample or upload a footprint first."
          : !hasAnyOffshoreInput
            ? "Set at least one L4 offshore% explicitly first."
            : undefined,
    },
    {
      key: "aiConfirmedAt",
      label: "AI impact dials reviewed",
      description: "0 to 100 set per L4 — informed by the AI Initiatives module.",
      enabled: hasRows && hasAnyAiInput,
      disabledReason:
        !hasRows
          ? "Load the sample or upload a footprint first."
          : !hasAnyAiInput
            ? "Set at least one L4 AI% explicitly first."
            : undefined,
    },
  ];

  const allConfirmed = steps.every((s) => Boolean(review[s.key]));

  const fmt = (iso?: string) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return null;
    }
  };

  return (
    <section
      aria-label="Tower readiness checklist"
      className="rounded-2xl border border-forge-border bg-forge-surface/80 p-5"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-semibold text-forge-ink">
            Tower readiness
          </h2>
          <p className="mt-0.5 text-xs text-forge-subtle">
            Confirm each step explicitly. We don&apos;t auto-tick — starter defaults shouldn&apos;t mask a tower that hasn&apos;t been reviewed yet.
          </p>
        </div>
        <div className="font-mono text-[11px] text-forge-subtle">
          {steps.filter((s) => Boolean(review[s.key])).length}/{steps.length} reviewed
        </div>
      </header>

      <ol className="mt-4 space-y-2">
        {steps.map((step, idx) => {
          const ts = review[step.key];
          const confirmed = Boolean(ts);
          return (
            <li
              key={step.key}
              className={
                "flex flex-wrap items-start gap-3 rounded-xl border p-3 transition " +
                (confirmed
                  ? "border-accent-green/30 bg-accent-green/5"
                  : "border-forge-border bg-forge-page/40")
              }
            >
              <div
                className={
                  "mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold " +
                  (confirmed
                    ? "bg-accent-green text-white"
                    : step.enabled
                      ? "border border-forge-border-strong text-forge-subtle"
                      : "border border-forge-border text-forge-hint")
                }
                aria-hidden
              >
                {confirmed ? <Check className="h-3.5 w-3.5" /> : idx + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-forge-ink">{step.label}</span>
                  {confirmed && fmt(ts) ? (
                    <span className="font-mono text-[10px] text-forge-hint">
                      reviewed {fmt(ts)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-forge-subtle">{step.description}</p>
                {!step.enabled && step.disabledReason ? (
                  <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-accent-amber">
                    <CircleAlert className="h-3 w-3" />
                    {step.disabledReason}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => onConfirm(step.key)}
                  disabled={!step.enabled}
                  title={confirmed ? "Re-confirm review" : step.disabledReason}
                  className={
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 " +
                    (confirmed
                      ? "border-accent-green/40 bg-accent-green/10 text-accent-green hover:bg-accent-green/15"
                      : "border-accent-purple bg-accent-purple text-white hover:bg-accent-purple-dark")
                  }
                >
                  {confirmed ? "Confirmed" : "Confirm reviewed"}
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <footer className="mt-4 flex flex-wrap items-center gap-3 border-t border-forge-border pt-4">
        {!isComplete ? (
          <button
            type="button"
            onClick={onMarkComplete}
            disabled={!allConfirmed || !hasRows}
            title={
              !hasRows
                ? "Load the sample or upload a footprint first."
                : !allConfirmed
                  ? "Confirm every checklist step first."
                  : "Sign this tower off as reviewed and unlock the AI Initiatives handoff."
            }
            className="inline-flex items-center gap-2 rounded-lg bg-accent-purple px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-purple-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Lock className="h-4 w-4" />
            Mark reviewed by tower lead
          </button>
        ) : (
          <button
            type="button"
            onClick={onUnmarkComplete}
            className="inline-flex items-center gap-2 rounded-lg border border-forge-border bg-forge-surface px-4 py-2 text-sm font-medium text-forge-body transition hover:border-forge-border-strong"
          >
            <Unlock className="h-4 w-4" />
            Reopen for review
          </button>
        )}
        {isComplete ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-green/40 bg-accent-green/10 px-2.5 py-1 text-xs font-medium text-accent-green">
            <Check className="h-3 w-3" />
            Reviewed by tower lead
          </span>
        ) : (
          <span className="text-xs text-forge-subtle">
            Marking reviewed pins the tower in the scenario summary and surfaces the AI Initiatives handoff.
          </span>
        )}
      </footer>
    </section>
  );
}
