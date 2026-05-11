"use client";

import * as React from "react";
import { FileSpreadsheet, X } from "lucide-react";
import type { Tower } from "@/data/types";
import type { TowerAiReadinessIntake, TowerId } from "@/data/assess/types";
import {
  intakeHasMinimumSubstance,
  TOWER_READINESS_ATTRIBUTION_LABEL,
} from "@/lib/assess/towerReadinessIntake";
import { getAssessProgram, subscribe } from "@/lib/localStore";
import { TowerReadinessIntakeFields } from "@/components/operatingModel/TowerReadinessIntakeFields";
import { cn } from "@/lib/utils";

/**
 * Always-visible Step 4 strip: questionnaire import status + link to view parsed answers.
 */
export function TowerReadinessIntakeStatus({
  tower,
  className,
}: {
  tower: Tower;
  className?: string;
}) {
  const towerId = tower.id as TowerId;
  const [intake, setIntake] = React.useState<TowerAiReadinessIntake | undefined>(
    undefined,
  );
  const [dialogOpen, setDialogOpen] = React.useState(false);

  React.useEffect(() => {
    const sync = () => {
      setIntake(getAssessProgram().towers[towerId]?.aiReadinessIntake);
    };
    sync();
    return subscribe("assessProgram", sync);
  }, [towerId]);

  React.useEffect(() => {
    if (!dialogOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDialogOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [dialogOpen]);

  const hasSubstance = intakeHasMinimumSubstance(intake);
  const displayName =
    intake?.sourceFileName?.trim() || "Imported questionnaire";

  return (
    <>
      <section
        aria-label="Tower AI readiness questionnaire status"
        className={cn(
          "mt-3 flex flex-col gap-3 rounded-2xl border border-forge-border/80 bg-forge-surface/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
          className,
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent-purple/35 bg-accent-purple/10 text-accent-purple-light">
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-forge-hint">
              AI readiness questionnaire
            </div>
            {intake ? (
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm text-forge-ink">{displayName}</span>
                <span className="font-mono text-xs tabular-nums text-forge-body">
                  {new Date(intake.importedAt).toLocaleString()}
                </span>
                {hasSubstance ? (
                  <span className="rounded-full border border-accent-teal/35 bg-accent-teal/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-accent-teal">
                    {TOWER_READINESS_ATTRIBUTION_LABEL}
                  </span>
                ) : (
                  <span className="text-[11px] text-forge-subtle">
                    Add detail in Workshop tools so AI guidance uses full context.
                  </span>
                )}
              </div>
            ) : (
              <p className="mt-1 text-sm text-forge-body">
                Not imported — tower questionnaire data for this workshop has not been loaded.
              </p>
            )}
          </div>
        </div>
        {intake ? (
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-accent-purple/50 bg-accent-purple/10 px-3 py-2 text-xs font-semibold text-accent-purple-dark transition hover:bg-accent-purple/20"
          >
            View parsed answers
          </button>
        ) : null}
      </section>

      {dialogOpen && intake ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-near-black/65 px-4 py-8 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="intake-dialog-title"
        >
          <button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 cursor-default"
            onClick={() => setDialogOpen(false)}
          />
          <div className="relative z-[1] flex max-h-[min(85vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-forge-border bg-forge-surface shadow-xl">
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-forge-border px-5 py-4">
              <div className="min-w-0">
                <h2
                  id="intake-dialog-title"
                  className="font-display text-base font-semibold text-forge-ink"
                >
                  Parsed questionnaire — {tower.name}
                </h2>
                <p className="mt-1 text-[11px] leading-relaxed text-forge-subtle">
                  The original Excel file is not stored in the app—only the parsed
                  answers below (same data used for AI guidance).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="shrink-0 rounded-lg border border-forge-border p-2 text-forge-hint transition hover:border-accent-purple/40 hover:text-forge-ink"
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <TowerReadinessIntakeFields intake={intake} showMetadata />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
