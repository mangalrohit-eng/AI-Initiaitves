/**
 * One-shot codemod: wrap each canonical capability map's outer `l2: [...]`
 * array inside a single dummy L2 (Job Grouping) named after the tower
 * function, and cascade-rename inner `l4:` → `l5:` and `l3:` → `l4:`.
 *
 * Run once via `node scripts/migrate-canonical-maps-to-v5.cjs`. After all
 * 13 files compile cleanly, this script can be deleted.
 *
 * Idempotency: detects an already-migrated file by the presence of the
 * dummy wrapper id (e.g. `finance-jg`) and skips re-running on it.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "src", "data", "capabilityMap");

// Mirror of src/data/towerFunctionNames.ts - keep in sync if names ever drift.
const TOWER_FUNCTION_NAME = {
  finance: "Finance",
  hr: "HR & Talent",
  "research-analytics": "Research & Analytics",
  legal: "Legal & Business Affairs",
  "corp-services": "Corporate Services",
  "tech-engineering": "Technology & Engineering",
  "operations-technology": "Operations & Technology",
  sales: "Sales",
  "marketing-comms": "Marketing & Communications",
  service: "Service",
  "editorial-news": "Editorial & News",
  production: "Production",
  "programming-dev": "Programming & Development",
};

// File name in capabilityMap/ -> tower id used by TOWER_FUNCTION_NAME.
const FILE_TO_TOWER = {
  "finance.ts": "finance",
  "hr-localize-to-versant.ts": "hr",
  "research-analytics.ts": "research-analytics",
  "legal.ts": "legal",
  "corp-services.ts": "corp-services",
  "tech-engineering.ts": "tech-engineering",
  "operations-technology.ts": "operations-technology",
  "sales.ts": "sales",
  "marketing-comms.ts": "marketing-comms",
  "service.ts": "service",
  "editorial-news.ts": "editorial-news",
  "production.ts": "production",
  "programming-dev.ts": "programming-dev",
};

function transform(source, towerId, functionName) {
  const wrapperId = `${towerId}-jg`;
  if (source.includes(`id: "${wrapperId}"`)) {
    return { source, skipped: true };
  }

  // Step 1: rename inner `l4: [` to `l5: [` (must precede l3->l4 to avoid
  // clobbering the renamed-from-l3 keys).
  let out = source.replace(/^(\s+)l4:\s*\[/gm, "$1l5: [");

  // Step 2: rename inner `l3: [` to `l4: [`.
  out = out.replace(/^(\s+)l3:\s*\[/gm, "$1l4: [");

  // Step 3: wrap the outer `l2: [` ... `]` content with the dummy Job Grouping.
  // The outer `l2:` is at indent depth 2 (two spaces) inside the export object.
  // We match `  l2: [` and find its matching closing bracket, then wrap.
  const openMarker = "\n  l2: [";
  const openIdx = out.indexOf(openMarker);
  if (openIdx < 0) {
    throw new Error(`Could not find outer 'l2: [' marker in ${towerId}`);
  }
  const arrayStart = openIdx + openMarker.length;
  // Find the matching `]` for the outer array. Bracket-balance scan.
  let depth = 1;
  let i = arrayStart;
  while (i < out.length && depth > 0) {
    const ch = out[i];
    if (ch === "[") depth += 1;
    else if (ch === "]") depth -= 1;
    if (depth === 0) break;
    i += 1;
  }
  if (depth !== 0) {
    throw new Error(`Unbalanced brackets when scanning outer l2 array in ${towerId}`);
  }
  const arrayEnd = i; // index of the closing `]`

  const inner = out.slice(arrayStart, arrayEnd);
  // Re-indent inner content by 4 spaces (the wrapper adds two levels).
  const reindented = inner.replace(/^(?=.)/gm, "    ");
  // Trim a trailing pure-whitespace line so we don't double-indent the closing.
  const wrapped =
    `\n    {\n` +
    `      id: "${wrapperId}",\n` +
    `      name: ${JSON.stringify(functionName)},\n` +
    `      l3: [` +
    reindented +
    `      ],\n` +
    `    },\n  `;

  out = out.slice(0, arrayStart) + wrapped + out.slice(arrayEnd);
  return { source: out, skipped: false };
}

function main() {
  let changed = 0;
  let skipped = 0;
  for (const [fileName, towerId] of Object.entries(FILE_TO_TOWER)) {
    const filePath = path.join(ROOT, fileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`SKIP (missing): ${fileName}`);
      continue;
    }
    const functionName = TOWER_FUNCTION_NAME[towerId];
    if (!functionName) {
      throw new Error(`No function name for tower id "${towerId}"`);
    }
    const before = fs.readFileSync(filePath, "utf8");
    const { source, skipped: wasSkipped } = transform(before, towerId, functionName);
    if (wasSkipped) {
      skipped += 1;
      console.log(`SKIP (already migrated): ${fileName}`);
      continue;
    }
    fs.writeFileSync(filePath, source, "utf8");
    changed += 1;
    console.log(`OK: ${fileName} (wrapped under "${functionName}")`);
  }
  console.log(`\nDone. ${changed} files migrated, ${skipped} already-migrated.`);
}

main();
