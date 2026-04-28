/**
 * Generate per-tower Markdown reports from the static curation pipeline.
 *
 * Output: `docs/l4-eligibility/{tower}.md` (one per tower) + `README.md`
 * (program-wide index with the calibration table).
 *
 * Usage: `npx tsx scripts/generateTowerReports.ts`
 *
 * The reports document the deterministic-fallback verdict — what tower
 * leads see if they never run the LLM pipeline (PR 2).
 */

import * as fs from "fs";
import * as path from "path";
import { capabilityMapDefinitions } from "../src/data/capabilityMap/maps";
import { walkCapabilityMap } from "../src/lib/initiatives/curationLookup";
import type { ComposedVerdict } from "../src/lib/initiatives/composeVerdict";

const OUT_DIR = path.resolve(__dirname, "..", "..", "docs", "l4-eligibility");

type WalkRow = ComposedVerdict & {
  l4Id: string;
  l4Name: string;
  l3Id: string;
  l3Name: string;
  l2Id: string;
  l2Name: string;
  towerId: string;
};

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function priorityRank(p?: string): number {
  if (!p) return 99;
  if (p.startsWith("P1")) return 1;
  if (p.startsWith("P2")) return 2;
  if (p.startsWith("P3")) return 3;
  return 99;
}

function statusRank(s: string): number {
  if (s === "curated") return 0;
  if (s === "pending-discovery") return 1;
  return 2; // reviewed-not-eligible
}

function statusLabel(s: string): string {
  if (s === "curated") return "**AI-eligible**";
  if (s === "reviewed-not-eligible") return "Human-led";
  return "Pending discovery";
}

function priorityShort(p?: string): string {
  if (!p) return "—";
  if (p.startsWith("P1")) return "P1";
  if (p.startsWith("P2")) return "P2";
  if (p.startsWith("P3")) return "P3";
  return "—";
}

function escapeMd(s: string): string {
  return s.replace(/\|/g, "\\|");
}

function summary(rows: WalkRow[]): {
  total: number;
  eligible: number;
  notEligible: number;
  pending: number;
  p1: number;
  p2: number;
  p3: number;
  bySourceCanonical: number;
  bySourceOverlay: number;
  bySourceRubric: number;
} {
  const out = {
    total: rows.length,
    eligible: 0,
    notEligible: 0,
    pending: 0,
    p1: 0,
    p2: 0,
    p3: 0,
    bySourceCanonical: 0,
    bySourceOverlay: 0,
    bySourceRubric: 0,
  };
  for (const r of rows) {
    if (r.status === "curated") {
      out.eligible += 1;
      if (r.aiPriority?.startsWith("P1")) out.p1 += 1;
      else if (r.aiPriority?.startsWith("P2")) out.p2 += 1;
      else if (r.aiPriority?.startsWith("P3")) out.p3 += 1;
    } else if (r.status === "reviewed-not-eligible") out.notEligible += 1;
    else out.pending += 1;
    if (r.source === "canonical") out.bySourceCanonical += 1;
    else if (r.source === "overlay") out.bySourceOverlay += 1;
    else out.bySourceRubric += 1;
  }
  return out;
}

function towerReport(towerId: string, l1Name: string, rows: WalkRow[]): string {
  const s = summary(rows);
  const eligiblePct = ((s.eligible / s.total) * 100).toFixed(1);

  const sortedRows = [...rows].sort((a, b) => {
    if (statusRank(a.status) !== statusRank(b.status)) {
      return statusRank(a.status) - statusRank(b.status);
    }
    if (priorityRank(a.aiPriority) !== priorityRank(b.aiPriority)) {
      return priorityRank(a.aiPriority) - priorityRank(b.aiPriority);
    }
    return a.l4Name.localeCompare(b.l4Name);
  });

  const lines: string[] = [];
  lines.push(`# L4 AI-eligibility verdict — ${l1Name}`);
  lines.push("");
  lines.push(`**Tower id:** \`${towerId}\``);
  lines.push("");
  lines.push(
    "Snapshot of the deterministic-fallback verdict for this tower's L4 activities.",
  );
  lines.push(
    "What tower leads see if they never run the LLM curation pipeline (PR 2).",
  );
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Count | Share |");
  lines.push("| --- | ---: | ---: |");
  lines.push(`| Total L4 activities | ${s.total} | 100% |`);
  lines.push(`| AI-eligible (curated) | ${s.eligible} | ${eligiblePct}% |`);
  lines.push(
    `| Human-led (reviewed-not-eligible) | ${s.notEligible} | ${((s.notEligible / s.total) * 100).toFixed(1)}% |`,
  );
  lines.push(
    `| Pending discovery | ${s.pending} | ${((s.pending / s.total) * 100).toFixed(1)}% |`,
  );
  lines.push("");
  lines.push("### Eligible breakdown by P-tier");
  lines.push("");
  lines.push("| Tier | Count |");
  lines.push("| --- | ---: |");
  lines.push(`| P1 — Immediate (0-6mo) | ${s.p1} |`);
  lines.push(`| P2 — Near-term (6-12mo) | ${s.p2} |`);
  lines.push(`| P3 — Medium-term (12-24mo) | ${s.p3} |`);
  lines.push("");
  lines.push("### Verdict source");
  lines.push("");
  lines.push("| Source | Count | Notes |");
  lines.push("| --- | ---: | --- |");
  lines.push(
    `| Canonical L4 | ${s.bySourceCanonical} | Verdict baked directly onto the canonical L4. |`,
  );
  lines.push(
    `| Curation overlay | ${s.bySourceOverlay} | Hand-authored P1 deep-curation or rubric correction. |`,
  );
  lines.push(
    `| Rubric | ${s.bySourceRubric} | Name-keyword classification fallback. |`,
  );
  lines.push("");
  lines.push("## L4 verdicts");
  lines.push("");
  lines.push("| L2 | L3 | L4 | Status | Tier | Vendor | Rationale |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const r of sortedRows) {
    const vendor = "primaryVendor" in r ? (r as ComposedVerdict).primaryVendor ?? "" : "";
    lines.push(
      `| ${escapeMd(r.l2Name)} | ${escapeMd(r.l3Name)} | ${escapeMd(r.l4Name)} | ${statusLabel(r.status)} | ${priorityShort(r.aiPriority)} | ${escapeMd(vendor)} | ${escapeMd(r.aiRationale)} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function indexReport(allRows: WalkRow[]): string {
  const byTower = new Map<string, { l1Name: string; rows: WalkRow[] }>();
  for (const map of capabilityMapDefinitions) {
    const towerId = map.mapRelatedTowerIds?.[0] ?? map.id;
    const rows = allRows.filter((r) => r.towerId === towerId);
    byTower.set(towerId, { l1Name: map.l1Name, rows });
  }

  const totalSum = summary(allRows);
  const totalEligiblePct = ((totalSum.eligible / totalSum.total) * 100).toFixed(1);

  const lines: string[] = [];
  lines.push("# Versant Forge — L4 AI-eligibility reports");
  lines.push("");
  lines.push(
    "Snapshot of the deterministic-fallback curation verdict across all 13 Versant Forge towers.",
  );
  lines.push("");
  lines.push("## How to read these reports");
  lines.push("");
  lines.push(
    "- **AI-eligible (curated)** — the activity has a credible AI play; the rubric or curation overlay",
  );
  lines.push(
    "  has classified it with a P-tier and a Versant-grounded rationale.",
  );
  lines.push(
    "- **Human-led (reviewed-not-eligible)** — judgment-driven, relationship-driven, or low-volume",
  );
  lines.push(
    "  activity where AI doesn't materially shrink the cycle. Falls back to one of the five approved",
  );
  lines.push(
    "  reasons in `docs/context.md` §9.",
  );
  lines.push(
    "- **Pending discovery** — the rubric couldn't classify the activity name. Falls through to the",
  );
  lines.push(
    "  LLM pipeline (PR 2) for a Versant-context-aware verdict.",
  );
  lines.push("");
  lines.push(
    "These reports describe the **deterministic fallback** — what tower leads see if no API key is",
  );
  lines.push(
    "configured or the LLM pipeline never runs. The pipeline overrides everything below when it does.",
  );
  lines.push("");
  lines.push("## Program-wide calibration");
  lines.push("");
  lines.push("| Metric | Count | Share |");
  lines.push("| --- | ---: | ---: |");
  lines.push(`| Total L4 activities (canonical) | ${totalSum.total} | 100% |`);
  lines.push(
    `| AI-eligible (curated) | ${totalSum.eligible} | ${totalEligiblePct}% |`,
  );
  lines.push(
    `| Human-led | ${totalSum.notEligible} | ${((totalSum.notEligible / totalSum.total) * 100).toFixed(1)}% |`,
  );
  lines.push(
    `| Pending discovery | ${totalSum.pending} | ${((totalSum.pending / totalSum.total) * 100).toFixed(1)}% |`,
  );
  lines.push("");
  lines.push(
    `Eligibility band targeted by the rubric: **50-75%**. Current run lands at ${totalEligiblePct}%.`,
  );
  lines.push(
    "The LLM pipeline (PR 2) tightens this to ~40-60% with Versant-specific judgment that the rubric can't apply.",
  );
  lines.push("");
  lines.push("## Per-tower roll-up");
  lines.push("");
  lines.push(
    "| Tower | Total L4 | Eligible | P1 | P2 | P3 | Human-led | Pending | Eligible % |",
  );
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");

  const sortedTowerIds = Array.from(byTower.keys()).sort((a, b) => {
    const sa = summary(byTower.get(a)!.rows);
    const sb = summary(byTower.get(b)!.rows);
    return sb.eligible - sa.eligible;
  });

  for (const towerId of sortedTowerIds) {
    const { l1Name, rows } = byTower.get(towerId)!;
    const s = summary(rows);
    const pct = s.total === 0 ? "—" : `${((s.eligible / s.total) * 100).toFixed(1)}%`;
    lines.push(
      `| [${escapeMd(l1Name)}](./${towerId}.md) | ${s.total} | **${s.eligible}** | ${s.p1} | ${s.p2} | ${s.p3} | ${s.notEligible} | ${s.pending} | ${pct} |`,
    );
  }
  lines.push("");
  lines.push("## Refresh");
  lines.push("");
  lines.push("Reports are regenerated by running:");
  lines.push("");
  lines.push("```");
  lines.push("npx tsx scripts/generateTowerReports.ts");
  lines.push("```");
  lines.push("");
  lines.push(
    "from the `forge-tower-explorer/` directory. Verdicts shift only when:",
  );
  lines.push("");
  lines.push(
    "- a capability-map L4 is added / renamed / removed (`src/data/capabilityMap/*.ts`),",
  );
  lines.push(
    "- the rubric pattern bank is tuned (`src/lib/initiatives/eligibilityRubric.ts`), or",
  );
  lines.push(
    "- the curation overlay is updated (`src/data/capabilityMap/aiCurationOverlay.ts`).",
  );
  lines.push("");
  return lines.join("\n");
}

function main() {
  ensureDir(OUT_DIR);
  const allRows: WalkRow[] = [];
  for (const map of capabilityMapDefinitions) {
    const rows = walkCapabilityMap(map);
    allRows.push(...rows);
    const towerId = map.mapRelatedTowerIds?.[0] ?? map.id;
    const path_ = path.join(OUT_DIR, `${towerId}.md`);
    fs.writeFileSync(path_, towerReport(towerId, map.l1Name, rows), "utf8");
    // eslint-disable-next-line no-console
    console.log(`Wrote ${path_}`);
  }
  const idx = indexReport(allRows);
  fs.writeFileSync(path.join(OUT_DIR, "README.md"), idx, "utf8");
  console.log(`Wrote ${path.join(OUT_DIR, "README.md")}`);
}

main();
