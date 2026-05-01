/**
 * Tower-scoped CSV exports for workshop steps (UTF-8 BOM, comma, RFC 4180).
 * Dials use the same effective % as L4LeverRow (row override vs tower baseline).
 *
 * 5-layer migration: every CSV now carries the full L1–L5 hierarchy.
 *   - L1 = Function (e.g. "Finance")
 *   - L2 = Job Grouping (defaults to the L1 Function name; can be overridden)
 *   - L3 = Job Family (was the pre-migration "L2 Pillar")
 *   - L4 = Activity Group (was the pre-migration "L3 Capability") — dials,
 *         opportunity sizing, and review decisions all live on this row.
 *   - L5 = Activity (was the pre-migration "L4 Activity") — the leaf where
 *         AI initiatives attach.
 */
import type { AssessProgramV2, TowerId } from "@/data/assess/types";
import { defaultTowerState } from "@/data/assess/types";
import type { Tower } from "@/data/types";
import { getCapabilityMapForTower } from "@/data/capabilityMap/maps";
import { selectInitiativesForTower } from "@/lib/initiatives/select";

const UTF8_BOM = "\uFEFF";

function csvCell(v: string | number | boolean | undefined | null): string {
  if (v === undefined || v === null) return "";
  const s = typeof v === "string" ? v : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(values: (string | number | boolean | undefined | null)[]): string {
  return values.map(csvCell).join(",");
}

export function isoDateForFilename(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export type TowerExportArtifact = "capability-map" | "dials" | "ai-initiatives";

export function forgeTowerCsvFilename(
  towerId: string,
  artifact: TowerExportArtifact,
  date = isoDateForFilename(),
): string {
  return `forge-tower-${towerId}-${artifact}-${date}.csv`;
}

export function buildCapabilityMapExportCsv(params: {
  towerId: TowerId;
  towerName: string;
  program: AssessProgramV2;
}): string {
  const { towerId, towerName, program } = params;
  const exportedAt = new Date().toISOString();
  const tState = program.towers[towerId] ?? defaultTowerState();
  const assessRows = tState.l4Rows ?? [];
  const map = getCapabilityMapForTower(towerId);

  const header = csvRow([
    "tower_id",
    "tower_name",
    "exported_at_iso",
    "l1_name",
    "l2_id",
    "l2_name",
    "l3_id",
    "l3_name",
    "l4_id",
    "l4_name",
    "l5_id",
    "l5_name",
    "l5_description",
    "fte_onshore",
    "fte_offshore",
    "contractor_onshore",
    "contractor_offshore",
    "annual_spend_usd",
    "row_id",
    "match_status",
  ]);
  const lines = [header];

  const matchedAssessRowIds = new Set<string>();

  if (map) {
    const l1 = map.l1Name;
    for (const l2 of map.l2) {
      for (const l3 of l2.l3) {
        for (const l4 of l3.l4) {
          // The assessment row grain is L4 (Activity Group). Match by the
          // (l3 Job Family, l4 Activity Group) pair so a tower lead's
          // upload locks onto the right Activity Group regardless of
          // whether they typed the Job Grouping cell.
          const assessRow = assessRows.find(
            (r) => r.l3 === l3.name && r.l4 === l4.name,
          );
          if (assessRow) matchedAssessRowIds.add(assessRow.id);

          const emitL5 = (l5: (typeof l4.l5)[number]) => {
            lines.push(
              csvRow([
                towerId,
                towerName,
                exportedAt,
                l1,
                l2.id,
                l2.name,
                l3.id,
                l3.name,
                l4.id,
                l4.name,
                l5.id,
                l5.name,
                l5.description ?? "",
                assessRow?.fteOnshore ?? "",
                assessRow?.fteOffshore ?? "",
                assessRow?.contractorOnshore ?? "",
                assessRow?.contractorOffshore ?? "",
                assessRow?.annualSpendUsd ?? "",
                assessRow?.id ?? "",
                assessRow ? "matched" : "map_only",
              ]),
            );
          };

          if (l4.l5.length === 0) {
            lines.push(
              csvRow([
                towerId,
                towerName,
                exportedAt,
                l1,
                l2.id,
                l2.name,
                l3.id,
                l3.name,
                l4.id,
                l4.name,
                "",
                "",
                "",
                assessRow?.fteOnshore ?? "",
                assessRow?.fteOffshore ?? "",
                assessRow?.contractorOnshore ?? "",
                assessRow?.contractorOffshore ?? "",
                assessRow?.annualSpendUsd ?? "",
                assessRow?.id ?? "",
                assessRow ? "matched" : "map_only",
              ]),
            );
          } else {
            for (const l5 of l4.l5) emitL5(l5);
          }
        }
      }
    }
  }

  for (const r of assessRows) {
    if (matchedAssessRowIds.has(r.id)) continue;
    lines.push(
      csvRow([
        towerId,
        towerName,
        exportedAt,
        map?.l1Name ?? "",
        "",
        r.l2,
        "",
        r.l3,
        "",
        r.l4,
        "",
        "",
        "",
        r.fteOnshore,
        r.fteOffshore,
        r.contractorOnshore,
        r.contractorOffshore,
        r.annualSpendUsd ?? "",
        r.id,
        "assess_only",
      ]),
    );
  }

  return UTF8_BOM + lines.join("\n");
}

export function buildDialsExportCsv(params: {
  towerId: TowerId;
  towerName: string;
  program: AssessProgramV2;
}): string {
  const { towerId, towerName, program } = params;
  const exportedAt = new Date().toISOString();
  const tState = program.towers[towerId] ?? defaultTowerState();
  const baseline = tState.baseline;
  const rows = tState.l4Rows ?? [];
  const map = getCapabilityMapForTower(towerId);
  const l1 = map?.l1Name ?? "";

  const header = csvRow([
    "tower_id",
    "tower_name",
    "exported_at_iso",
    "l1_name",
    "l2_name",
    "l3_name",
    "l4_name",
    "row_id",
    "offshore_pct_effective",
    "ai_pct_effective",
    "offshore_pct_raw",
    "ai_pct_raw",
    "offshore_rationale",
    "ai_impact_rationale",
    "dials_rationale_source",
  ]);
  const lines = [header];

  for (const r of rows) {
    const offEff = r.offshoreAssessmentPct ?? baseline.baselineOffshorePct;
    const aiEff = r.aiImpactAssessmentPct ?? baseline.baselineAIPct;
    lines.push(
      csvRow([
        towerId,
        towerName,
        exportedAt,
        l1,
        r.l2,
        r.l3,
        r.l4,
        r.id,
        offEff,
        aiEff,
        r.offshoreAssessmentPct ?? "",
        r.aiImpactAssessmentPct ?? "",
        r.offshoreRationale ?? "",
        r.aiImpactRationale ?? "",
        r.dialsRationaleSource ?? "",
      ]),
    );
  }

  return UTF8_BOM + lines.join("\n");
}

export function buildAiInitiativesExportCsv(params: {
  towerId: TowerId;
  towerName: string;
  program: AssessProgramV2;
  tower: Tower;
}): string {
  const { towerId, towerName, program, tower } = params;
  const exportedAt = new Date().toISOString();
  const map = getCapabilityMapForTower(towerId);
  const l1 = map?.l1Name ?? "";

  const sel = selectInitiativesForTower(towerId, program, tower);
  // View-model layer mapping (post-5-layer-migration):
  //   sel.l2s    -> Job Grouping (the dummy wrapper)
  //   l2.l3s    -> Job Family
  //   l3.rowL4Name -> Activity Group (per-row label)
  //   l3.l4s    -> L5 Activities (the leaf where initiatives attach)
  // Note the view-model field names lag the migration (Phase 8 rename).
  const byInitiative = new Map<
    string,
    { l2: string; l3: string; l4: string }
  >();
  for (const l2 of sel.l2s) {
    for (const l3 of l2.l3s) {
      for (const l4 of l3.l4s) {
        if (l4.initiativeId) {
          byInitiative.set(l4.initiativeId, {
            l2: l2.l2.name,
            l3: l3.l3.name,
            l4: l3.rowL4Name,
          });
        }
      }
    }
  }

  const header = csvRow([
    "tower_id",
    "tower_name",
    "exported_at_iso",
    "initiative_id",
    "initiative_name",
    "l1_name",
    "l2_name",
    "l3_name",
    "l4_name",
    "description",
    "resolution_status",
  ]);
  const lines = [header];

  for (const p of tower.processes) {
    const loc = byInitiative.get(p.id);
    lines.push(
      csvRow([
        towerId,
        towerName,
        exportedAt,
        p.id,
        p.name,
        l1,
        loc?.l2 ?? "",
        loc?.l3 ?? "",
        loc?.l4 ?? "",
        p.description,
        loc ? "linked" : "unresolved",
      ]),
    );
  }

  return UTF8_BOM + lines.join("\n");
}
