/**
 * Validates tower CSV export builders against the seeded assess program.
 * Run: npx tsx scripts/verify-tower-exports.ts
 */
import { buildSeededAssessProgramV2 } from "./lib/seedFixture";
import { towers } from "../src/data/towers";
import type { TowerId } from "../src/data/assess/types";
import {
  buildAiInitiativesExportCsv,
  buildCapabilityMapExportCsv,
  buildDialsExportCsv,
} from "../src/lib/assess/exportTowerCsv";
import { buildExportCsv } from "../src/lib/assess/scenarioModel";
import { selectInitiativesForTower } from "../src/lib/initiatives/select";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function headerCols(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        cur += c;
      }
    } else if (c === ",") {
      cells.push(cur);
      cur = "";
    } else if (c === '"') {
      inQ = true;
    } else {
      cur += c;
    }
  }
  cells.push(cur);
  return cells;
}

function main(): void {
  const program = buildSeededAssessProgramV2();
  const sample = shuffled(towers).slice(0, 5);

  console.log(`Testing CSV exports for ${sample.length} random towers (seeded program)…`);

  for (const tower of sample) {
    const id = tower.id as TowerId;
    const cap = buildCapabilityMapExportCsv({
      towerId: id,
      towerName: tower.name,
      program,
    });
    const dial = buildDialsExportCsv({
      towerId: id,
      towerName: tower.name,
      program,
    });
    const init = buildAiInitiativesExportCsv({
      towerId: id,
      towerName: tower.name,
      program,
      tower,
    });

    assert(cap.startsWith("\uFEFF"), `${id}: capability-map missing UTF-8 BOM`);
    assert(dial.startsWith("\uFEFF"), `${id}: dials missing UTF-8 BOM`);
    assert(init.startsWith("\uFEFF"), `${id}: initiatives missing UTF-8 BOM`);

    const capLines = cap.replace(/^\uFEFF/, "").split("\n").filter(Boolean);
    const dialLines = dial.replace(/^\uFEFF/, "").split("\n").filter(Boolean);
    const initLines = init.replace(/^\uFEFF/, "").split("\n").filter(Boolean);

    assert(capLines.length >= 1, `${id}: capability-map empty`);
    assert(dialLines.length >= 1, `${id}: dials empty`);
    assert(initLines.length >= 1, `${id}: initiatives empty`);

    const capH = headerCols(capLines[0]);
    assert(capH.includes("tower_id"), `${id}: capability-map header missing tower_id`);
    assert(capH.includes("l1_name"), `${id}: capability-map header missing l1_name`);
    assert(capH.includes("l4_name"), `${id}: capability-map header missing l4_name`);
    assert(capH.includes("match_status"), `${id}: capability-map header missing match_status`);

    const dialH = headerCols(dialLines[0]);
    assert(dialH.includes("offshore_pct_effective"), `${id}: dials header missing effective offshore`);
    assert(dialH.includes("ai_pct_effective"), `${id}: dials header missing effective AI`);

    const initH = headerCols(initLines[0]);
    assert(initH.includes("review_status"), `${id}: initiatives header missing review_status`);
    assert(initH.includes("linked_brief_description"), `${id}: initiatives header missing linked_brief_description`);

    const dataRows = initLines.length - 1;
    let expectedInitRows = 0;
    const sel = selectInitiativesForTower(id, program, tower);
    for (const l2 of sel.l2s) {
      for (const l3 of l2.l3s) {
        for (const l5 of l3.l4s) {
          if (!l5.isPlaceholder) expectedInitRows += 1;
        }
      }
    }
    assert(
      dataRows === expectedInitRows,
      `${id}: initiatives row count ${dataRows} !== selector ${expectedInitRows}`,
    );

    const tState = program.towers[id];
    const rowCount = tState?.l4Rows?.length ?? 0;
    const dialData = dialLines.length - 1;
    assert(
      dialData === rowCount,
      `${id}: dials data rows ${dialData} !== l4 rows ${rowCount}`,
    );

    const capRedacted = buildCapabilityMapExportCsv({
      towerId: id,
      towerName: tower.name,
      program,
      redact: true,
    });
    const capRedLines = capRedacted.replace(/^\uFEFF/, "").split("\n").filter(Boolean);
    const spendIdx = headerCols(capRedLines[0]).indexOf("annual_spend_usd");
    assert(spendIdx >= 0, `${id}: annual_spend_usd column missing`);
    for (let ri = 1; ri < capRedLines.length; ri++) {
      const cells = headerCols(capRedLines[ri]);
      const v = cells[spendIdx] ?? "";
      if (v !== "") assert(v === "—", `${id}: redacted annual_spend_usd must be — or empty, got ${JSON.stringify(v)}`);
    }

    console.log(
      `  OK ${id}: capability ${capLines.length - 1} data rows, dials ${dialData}, initiatives ${dataRows}`,
    );
  }

  const impactRedacted = buildExportCsv(program, { redact: true });
  assert(impactRedacted.includes("—"), "impact CSV (redact): expected em-dash cells");
  const impactFull = buildExportCsv(program);
  const impactDataLines = impactFull.split("\n").filter((l) => l.trim().length > 0);
  assert(
    impactDataLines.length >= 2 && /\d/.test(impactDataLines[1] ?? ""),
    "impact CSV (full): expected numeric cells in first data row",
  );

  console.log("All export checks passed.");
}

main();
