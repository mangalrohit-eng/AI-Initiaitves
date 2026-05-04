"use client";

import * as React from "react";
import { FileUp, ChevronDown, ChevronRight } from "lucide-react";
import type { Tower } from "@/data/types";
import type { TowerAiReadinessIntake, TowerId } from "@/data/assess/types";
import {
  getAssessProgram,
  setTowerAssess,
  subscribe,
} from "@/lib/localStore";
import { useToast } from "@/components/feedback/ToastProvider";
import { parseTowerReadinessXlsx } from "@/lib/assess/parseTowerReadinessXlsx";
import {
  intakeHasMinimumSubstance,
  markRowsQueuedAfterIntakeImport,
} from "@/lib/assess/towerReadinessIntake";
import { cn } from "@/lib/utils";

export function TowerReadinessIntakePanel({ tower }: { tower: Tower }) {
  const toast = useToast();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = React.useState(false);
  const [intake, setIntake] = React.useState<TowerAiReadinessIntake | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const sync = () => {
      const t = getAssessProgram().towers[tower.id as TowerId]?.aiReadinessIntake;
      setIntake(t);
    };
    sync();
    return subscribe("assessProgram", sync);
  }, [tower.id]);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error({
        title: "Wrong file type",
        description: "Please upload an Excel workbook (.xlsx).",
      });
      return;
    }
    const buf = await file.arrayBuffer();
    const parsed = parseTowerReadinessXlsx(buf, {
      expectedTowerName: tower.name,
      sourceFileName: file.name,
    });
    if (!parsed.ok) {
      toast.error({ title: "Import failed", description: parsed.error });
      return;
    }
    const tw = getAssessProgram().towers[tower.id as TowerId];
    if (!tw) {
      toast.error({
        title: "Tower state missing",
        description: "Load capability data for this tower before importing.",
      });
      return;
    }
    const nextRows = markRowsQueuedAfterIntakeImport(tw.l4Rows);
    setTowerAssess(tower.id as TowerId, {
      aiReadinessIntake: parsed.intake,
      l4Rows: nextRows,
    });
    toast.success({
      title: "Tower intake saved",
      description:
        "Refresh AI guidance when ready so recommendations use this questionnaire.",
    });
    if (parsed.towerLabelMismatch) {
      toast.info({
        title: "Tower name mismatch",
        description:
          "The Excel Tower Name cell does not match this app tower. Confirm you uploaded the correct file.",
      });
    }
  };

  const hasSubstance = intakeHasMinimumSubstance(intake);

  return (
    <section className="rounded-2xl border border-forge-border bg-forge-surface/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-semibold text-forge-ink">
            Tower AI readiness intake
          </h3>
          <p className="mt-0.5 max-w-2xl text-xs text-forge-subtle">
            Import the Forge Excel questionnaire for{" "}
            <span className="text-forge-ink">{tower.name}</span>. Parsed answers
            persist with the workshop and inform AI guidance after you refresh.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={onPickFile}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-accent-purple/60 bg-accent-purple/10 px-3 py-2 text-xs font-semibold text-accent-purple-dark transition hover:bg-accent-purple/20"
          >
            <FileUp className="h-4 w-4" />
            Import .xlsx
          </button>
        </div>
      </div>

      {intake ? (
        <div className="mt-4 border-t border-forge-border pt-3">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center gap-2 text-left text-xs font-medium text-forge-ink"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-forge-hint" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-forge-hint" />
            )}
            {hasSubstance
              ? "View imported answers"
              : "View imported answers (add more detail for full use)"}
            <span className="ml-auto font-mono text-[10px] text-forge-hint">
              {new Date(intake.importedAt).toLocaleString()}
            </span>
          </button>
          {expanded ? (
            <dl className="mt-3 space-y-2 text-xs">
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
            </dl>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-xs text-forge-hint">
          No intake loaded yet. Use the Accenture template (fixed layout).
        </p>
      )}
    </section>
  );
}

function IntakeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-forge-border/80 bg-forge-well/40 p-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-forge-hint">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 whitespace-pre-wrap text-forge-body",
          !value.trim() ? "italic text-forge-hint" : "",
        )}
      >
        {value.trim() || "—"}
      </dd>
    </div>
  );
}
