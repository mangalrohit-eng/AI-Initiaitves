"use client";

import type { TowerAiReadinessIntake } from "@/data/assess/types";
import { cn } from "@/lib/utils";

export function IntakeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-forge-border/80 bg-forge-well/40 p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-forge-hint">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 whitespace-pre-wrap text-forge-body",
          !value.trim() ? "italic text-forge-hint" : "",
        )}
      >
        {value.trim() || "—"}
      </div>
    </div>
  );
}

type Props = {
  intake: TowerAiReadinessIntake;
  /** When true, prepend source file + imported-at audit rows. */
  showMetadata?: boolean;
  className?: string;
};

/**
 * Parsed Forge tower AI readiness questionnaire — shared by the intake panel,
 * Step 4 status dialog, and exports.
 */
export function TowerReadinessIntakeFields({
  intake,
  showMetadata = true,
  className,
}: Props) {
  const importedLocal = new Date(intake.importedAt).toLocaleString();
  return (
    <div className={cn("space-y-2 text-xs", className)}>
      {showMetadata ? (
        <>
          <IntakeRow
            label="Source file"
            value={intake.sourceFileName?.trim() || ""}
          />
          <div className="rounded-lg border border-forge-border/80 bg-forge-well/40 p-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-forge-hint">
              Imported at
            </div>
            <div className="mt-1 text-forge-body">
              <span className="block">{importedLocal}</span>
              <span className="mt-1 block font-mono text-[10px] text-forge-hint">
                {intake.importedAt}
              </span>
            </div>
          </div>
        </>
      ) : null}
      <IntakeRow label="Systems / platforms" value={intake.systemsPlatforms} />
      <IntakeRow label="AI / automation tools" value={intake.currentAiTools} />
      <IntakeRow label="Experiments & learnings" value={intake.experimentsLearnings} />
      <IntakeRow label="Data" value={intake.dataRelevant} />
      <IntakeRow label="Constraints" value={intake.constraints} />
      <IntakeRow label="Biggest impact" value={intake.biggestImpact} />
      <IntakeRow label="Ready now" value={intake.readyNow} />
      <IntakeRow label="Do not go" value={intake.noGoAreas} />
      {intake.respondentTowerLabel ? (
        <IntakeRow label="Excel tower name" value={intake.respondentTowerLabel} />
      ) : null}
    </div>
  );
}
