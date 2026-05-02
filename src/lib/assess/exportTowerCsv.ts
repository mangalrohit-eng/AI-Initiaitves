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
  const tState = program.towers[towerId] ?? defaultTowerState(towerId);
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
  const tState = program.towers[towerId] ?? defaultTowerState(towerId);
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

/**
 * Step 4 "AI initiatives" CSV export. Emits one row per L5 Activity that the
 * Step 4 UI displays — i.e. exactly what `selectInitiativesForTower` returns
 * after its eligibility / `aiPct > 0` filters. This deliberately mirrors the
 * UI count rather than dumping every curated L5 in the database, because the
 * export's purpose is "share what the workshop is showing." A future audit
 * dump that includes `aiEligible: false` and zero-dial rows would be a
 * separate function.
 *
 * Pre-fix history: this function iterated `tower.processes` (the small set of
 * hand-authored 4-lens briefs) instead of the curated initiatives. That made
 * the export emit 5 rows for Finance regardless of how many L5 Activities
 * Step 4 actually showed. The wiring miss pre-dated V5 — V5 just renamed
 * fields without revealing it.
 *
 * Placeholders (`l5.isPlaceholder === true`) are skipped — they exist for
 * ghost-L3 prevention in the UI, not for export consumers.
 */
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

  // View-model layer mapping (post-5-layer-migration):
  //   sel.l2s        -> L2 Job Grouping (canonical wrapper)
  //   l2.l3s         -> L3 Job Family
  //   l3.rowL4Name   -> L4 Activity Group (per-row label)
  //   l3.l4s         -> L5 Activities (the leaf where initiatives attach)
  // Note the view-model field names lag the migration (Phase 8 rename pending).
  const sel = selectInitiativesForTower(towerId, program, tower);

  // O(1) brief lookup for `linked_*` enrichment columns. Built once outside
  // the loop instead of `tower.processes.find(...)` per L5.
  const processById = new Map(tower.processes.map((p) => [p.id, p]));

  // Read review decisions off the SAME program snapshot the selector saw, so
  // a row's `review_status` is consistent with its presence in the export.
  // Going through `program.towers[...]?.initiativeReviews` directly (not
  // `getInitiativeReviews`) avoids a second `getAssessProgram()` read that
  // could race with an in-flight save.
  const reviews = program.towers[towerId]?.initiativeReviews ?? {};

  const header = csvRow([
    "tower_id",
    "tower_name",
    "exported_at_iso",
    "l1_name",
    "l2_name",
    "l3_name",
    "l4_name",
    "l5_id",
    "l5_name",
    "feasibility",
    "ai_rationale",
    "primary_vendor",
    "frequency",
    "criticality",
    "current_maturity",
    "source",
    "review_status",
    "review_decided_by",
    "review_decided_at",
    "linked_initiative_id",
    "linked_brief_slug",
    "linked_brief_description",
  ]);
  const lines = [header];

  for (const l2 of sel.l2s) {
    for (const l3 of l2.l3s) {
      for (const l5 of l3.l4s) {
        if (l5.isPlaceholder) continue;
        const review = reviews[l5.id];
        const linkedBrief = l5.initiativeId
          ? processById.get(l5.initiativeId)
          : undefined;
        lines.push(
          csvRow([
            towerId,
            towerName,
            exportedAt,
            l1,
            l2.l2.name,
            l3.l3.name,
            l3.rowL4Name,
            l5.id,
            l5.name,
            l5.feasibility ?? "",
            l5.aiRationale ?? "",
            l5.primaryVendor ?? "",
            l5.frequency ?? "",
            l5.criticality ?? "",
            l5.currentMaturity ?? "",
            l5.source,
            review?.status ?? "pending",
            review?.decidedBy ?? "",
            review?.decidedAt ?? "",
            l5.initiativeId ?? "",
            l5.briefSlug ?? "",
            linkedBrief?.description ?? "",
          ]),
        );
      }
    }
  }

  return UTF8_BOM + lines.join("\n");
}
