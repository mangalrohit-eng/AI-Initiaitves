"use client";

import * as React from "react";
import { ChevronDown, Download } from "lucide-react";
import type { Tower } from "@/data/types";
import { getAssessProgram } from "@/lib/localStore";
import { downloadBlob } from "@/lib/assess/downloadAssessSamples";
import {
  buildAiInitiativesExportCsv,
  buildCapabilityMapExportCsv,
  buildDialsExportCsv,
  forgeTowerCsvFilename,
  isoDateForFilename,
  type TowerExportArtifact,
} from "@/lib/assess/exportTowerCsv";
import { useToast } from "@/components/feedback/ToastProvider";
import { cn } from "@/lib/utils";
import { getCapabilityMapForTower } from "@/data/capabilityMap/maps";
import { useRedactDollars } from "@/lib/clientMode";

const MENU: ReadonlyArray<{
  id: TowerExportArtifact;
  label: string;
  description: string;
}> = [
  {
    id: "capability-map",
    label: "Step 1 — Capability map",
    description: "L1–L5 hierarchy, headcount, and pool fields",
  },
  {
    id: "dials",
    label: "Step 2 — Dials",
    description: "L1–L4 labels, offshore and AI % per Activity Group",
  },
  {
    id: "ai-initiatives",
    label: "Step 4 — AI initiatives",
    description: "L5 Activities with feasibility, vendor, review status, and capability path",
  },
];

/**
 * Consistent tower data export control for Capability Map, Impact Levers,
 * and AI Initiatives pages. CSVs use UTF-8 BOM and `forge-tower-*` filenames.
 */
export function TowerDataExports({
  tower,
  className,
}: {
  tower: Tower;
  className?: string;
}) {
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const redact = useRedactDollars();

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const program = getAssessProgram();
  const tState = program.towers[tower.id];
  const hasMap = Boolean(getCapabilityMapForTower(tower.id));
  const rowCount = tState?.l4Rows?.length ?? 0;
  const canMap = hasMap || rowCount > 0;
  const canDials = rowCount > 0;
  // The Step 4 export walks the same selector Step 4 itself displays, so any
  // tower with L4 rows has *something* to emit (header + 0+ data rows). We
  // gate on `rowCount > 0` rather than re-running the selector here because
  // the selector is fast but `rowCount` is already free, and the Step 4 UI
  // itself nudges the user to curate when rows exist but no eligible L5s
  // surface — the export landing empty in that case is acceptable.
  const canInitiatives = rowCount > 0;

  if (redact) return null;

  const disabledReason = (id: TowerExportArtifact): string | undefined => {
    if (id === "capability-map" && !canMap) {
      return "Upload a capability map or headcount on Step 1 first.";
    }
    if (id === "dials" && !canDials) {
      return "No L3 footprint loaded for this tower yet.";
    }
    if (id === "ai-initiatives" && !canInitiatives) {
      return "Upload a capability map on Step 1 first.";
    }
    return undefined;
  };

  const runExport = (id: TowerExportArtifact) => {
    const reason = disabledReason(id);
    if (reason) {
      toast.info({ title: "Export unavailable", description: reason });
      return;
    }
    const p = getAssessProgram();
    const date = isoDateForFilename();
    let body: string;
    if (id === "capability-map") {
      body = buildCapabilityMapExportCsv({
        towerId: tower.id,
        towerName: tower.name,
        program: p,
      });
    } else if (id === "dials") {
      body = buildDialsExportCsv({
        towerId: tower.id,
        towerName: tower.name,
        program: p,
      });
    } else {
      body = buildAiInitiativesExportCsv({
        towerId: tower.id,
        towerName: tower.name,
        program: p,
        tower,
      });
    }
    const name = forgeTowerCsvFilename(tower.id, id, date);
    downloadBlob(name, body, "text/csv;charset=utf-8");
    toast.success({
      title: "Download started",
      description: name,
    });
    setOpen(false);
  };

  return (
    <div
      ref={wrapRef}
      className={cn(
        "no-print flex flex-wrap items-center gap-3 border-b border-forge-border/60 pb-3",
        className,
      )}
    >
      <span className="font-display text-sm font-medium text-forge-ink">
        Tower data
      </span>
      <div className="relative">
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
            "border-forge-border bg-forge-surface text-forge-body",
            "hover:border-accent-purple/50 hover:text-accent-purple-dark",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/40",
          )}
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((v) => !v)}
        >
          <Download className="h-4 w-4 shrink-0 text-accent-purple-dark" aria-hidden />
          Export CSVs
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-forge-hint transition",
              open ? "rotate-180" : "",
            )}
            aria-hidden
          />
        </button>
        {open ? (
          <div
            role="menu"
            className="absolute left-0 top-full z-40 mt-2 min-w-[min(100vw-2rem,22rem)] rounded-xl border border-forge-border bg-forge-surface py-1 shadow-card"
          >
            {MENU.map((item) => {
              const dis = disabledReason(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  disabled={Boolean(dis)}
                  title={dis}
                  onClick={() => runExport(item.id)}
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm transition",
                    dis
                      ? "cursor-not-allowed text-forge-hint"
                      : "text-forge-body hover:bg-accent-purple/5 hover:text-accent-purple-dark",
                  )}
                >
                  <span className="font-medium">{item.label}</span>
                  <span className="text-xs text-forge-subtle">{item.description}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
