/**
 * Bulk rename script for the 5-layer migration.
 *
 * Purpose: rename typed-field accesses across the non-migration code so the
 * compiler is happy. Surgical files (localStore.ts, assessProgramIO.ts,
 * assessClientApi.ts, /api/assess/route.ts, composeVerdict.ts, select.ts,
 * L3LeverRow.tsx, the LLM generators that get renamed) are SKIPPED — they
 * need hand-edits in their respective phase.
 *
 * Replacements:
 *   `.l3Rows`       → `.l4Rows`         (typed property access)
 *   `l3Rows:`       → `l4Rows:`         (object literal keys)
 *   `"l3Rows"`      → `"l4Rows"`        (string literal field name in Pick<>)
 *   `.l4Activities` → `.l5Activities`   (L4WorkforceRow.l5Activities accessor)
 *   `l4Activities:` → `l5Activities:`   (object literal keys)
 *   `.l4Items`      → `.l5Items`        (L4WorkforceRow.l5Items accessor)
 *   `l4Items:`      → `l5Items:`        (object literal keys)
 *   `"running-l4"`  → `"running-l5"`    (CurationStage literal)
 *   `'running-l4'`  → `'running-l5'`
 *
 * Run once via `node scripts/bulk-rename-l3-l4-fields.cjs`. After all the
 * renames land + the surgical files are hand-edited, this script can be
 * deleted.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");

// Files that must NOT be auto-renamed - they get surgical hand-edits.
const SKIP = new Set(
  [
    "src/lib/localStore.ts",
    "src/lib/assess/assessProgramIO.ts",
    "src/lib/assess/assessClientApi.ts",
    "src/app/api/assess/route.ts",
    "src/app/api/assess/curate-initiatives/route.ts",
    "src/lib/initiatives/composeVerdict.ts",
    "src/lib/initiatives/select.ts",
    "src/components/assess/L3LeverRow.tsx",
    "src/lib/assess/generateL4ActivitiesLLM.ts",
    "src/lib/assess/curateInitiativesLLM.ts",
    "src/data/assess/types.ts", // already authored with both old + new aliases
    "src/data/capabilityMap/types.ts", // already authored
    "src/data/towerFunctionNames.ts", // new file, no old refs
  ].map((p) => p.replace(/\//g, path.sep)),
);

const REPLACEMENTS = [
  [/\.l3Rows\b/g, ".l4Rows"],
  [/\bl3Rows:/g, "l4Rows:"],
  [/"l3Rows"/g, '"l4Rows"'],
  [/'l3Rows'/g, "'l4Rows'"],
  [/\.l4Activities\b/g, ".l5Activities"],
  [/\bl4Activities:/g, "l5Activities:"],
  [/\.l4Items\b/g, ".l5Items"],
  [/\bl4Items:/g, "l5Items:"],
  [/"running-l4"/g, '"running-l5"'],
  [/'running-l4'/g, "'running-l5'"],
];

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      yield* walk(full);
    } else if (entry.isFile()) {
      if (/\.(ts|tsx|cjs|mjs|js)$/.test(entry.name)) yield full;
    }
  }
}

let files = 0;
let edits = 0;
const skipped = [];
for (const file of walk(SRC)) {
  const rel = path.relative(ROOT, file);
  if (SKIP.has(rel)) {
    skipped.push(rel);
    continue;
  }
  const before = fs.readFileSync(file, "utf8");
  let after = before;
  let perFile = 0;
  for (const [pat, repl] of REPLACEMENTS) {
    const next = after.replace(pat, (...args) => {
      perFile += 1;
      return typeof repl === "function" ? repl(...args) : repl;
    });
    after = next;
  }
  if (perFile > 0 && after !== before) {
    fs.writeFileSync(file, after, "utf8");
    files += 1;
    edits += perFile;
    console.log(`OK: ${rel} (${perFile} edit${perFile === 1 ? "" : "s"})`);
  }
}
console.log(`\nDone. ${edits} replacements across ${files} files.`);
if (skipped.length) {
  console.log(`\nSkipped (need hand-edit):`);
  for (const s of skipped) console.log(`  - ${s}`);
}
