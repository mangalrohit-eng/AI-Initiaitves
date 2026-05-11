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
import { TowerReadinessIntakeFields } from "@/components/operatingModel/TowerReadinessIntakeFields";
import { cn } from "@/lib/utils";

/**
 * Tower-scoped AI readiness questionnaire import.
 *
 * `compact` (default `false`) suppresses the inner h3 + intro paragraph
 * so the component can sit cleanly under an outer step shell (the
 * facilitator drawer on Step 4) without duplicating the heading. The
 * file picker, "View imported answers" expander, and import timestamp
 * stay visible regardless. The standalone caller in
 * `OperatingModelSection` keeps the default and renders the full panel.
 */
export function TowerReadinessIntakePanel({
  tower,
  compact = false,
}: {
  tower: Tower;
  compact?: boolean;
}) {
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
    <section
      className={cn(
        compact
          ? ""
          : "rounded-2xl border border-forge-border bg-forge-surface/80 p-4",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {compact ? (
          <span className="text-[11px] text-forge-subtle">
            Forge Excel questionnaire for{" "}
            <span className="text-forge-body">{tower.name}</span>.
          </span>
        ) : (
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
        )}
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
        <div
          className={cn(
            "mt-4 pt-3",
            compact ? "border-t border-forge-border/60" : "border-t border-forge-border",
          )}
        >
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
            <TowerReadinessIntakeFields
              className="mt-3"
              intake={intake}
              showMetadata
            />
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
