/**
 * One-time migration: replace numeric impact (hours, time %) with ImpactTier
 * and netFTEImpact with workforce tier + summary (no FTE quantification).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function tierFromProcessHours(h) {
  if (h >= 10000) return "High";
  if (h >= 5000) return "Medium";
  return "Low";
}
function tierFromTowerHours(h) {
  if (h >= 40000) return "High";
  if (h >= 20000) return "Medium";
  return "Low";
}
function tierFromBriefHours(h) {
  if (h >= 5000) return "High";
  if (h >= 2000) return "Medium";
  return "Low";
}

function cleanFteString(s) {
  let t = s.trim();
  t = t.replace(/^≈\s*/g, "");
  t = t.replace(/^(?:\d+-\d+|\d+)\s*FTE(?:s| equivalents?)?\s*[^;]*;?\s*/i, "");
  t = t.replace(/(?:\d+-\d+|\d+)\s*FTE[^;]*;?\s*/gi, "");
  t = t.replace(/saved per deal[;\s]*/gi, "per deal, ");
  t = t.replace(/\s+/g, " ").replace(/^;\s*/, "").trim();
  if (!t) return "Workforce mix shifts toward judgment-led roles; quantitative sizing TBD in discovery.";
  if (!t.endsWith(".")) t += ".";
  return t;
}

function migrateSliceFile(content) {
  // Tower-level hours
  content = content.replace(/estimatedAnnualSavingsHours: (\d+),/g, (_, n) => {
    return `impactTier: "${tierFromTowerHours(Number(n))}",`;
  });

  // Per-process time + hours -> single tier (use annual hours for tier)
  content = content.replace(
    /\n\s*estimatedTimeSavingsPercent: \d+,\n\s*estimatedAnnualHoursSaved: (\d+),/g,
    (_, hours) => `\n      impactTier: "${tierFromProcessHours(Number(hours))}",`,
  );

  const lines = content.split("\n");
  const out = [];
  let lastProcessImpact = "Medium";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Only process-level tier (6 spaces) — not tower `  impactTier`
    const mTier = /^ {6}impactTier: "(High|Medium|Low)",\s*$/.exec(line);
    if (mTier) lastProcessImpact = mTier[1];

    const mNet = /^\s*netFTEImpact:\s*"(.*)",\s*$/.exec(line);
    if (mNet) {
      const summary = cleanFteString(mNet[1].replace(/\\"/g, '"'));
      out.push(`        workforceImpactTier: "${lastProcessImpact}",`);
      out.push(`        workforceImpactSummary: ${JSON.stringify(summary)},`);
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

function migrateProcessBriefs(content) {
  // JSON-like: "estimatedTimeSavingsPercent" then "estimatedAnnualHoursSaved"
  return content
    .replace(
      /"estimatedTimeSavingsPercent": \d+,\s*\n\s*"estimatedAnnualHoursSaved": (\d+),/g,
      (_, hours) => `"impactTier": "${tierFromBriefHours(Number(hours))}",`,
    );
}

for (const rel of ["src/data/slices/remaining.ts", "src/data/slices/finance.ts"]) {
  const f = path.join(root, rel);
  let c = fs.readFileSync(f, "utf8");
  c = migrateSliceFile(c);
  fs.writeFileSync(f, c, "utf8");
  console.log("updated", rel);
}

const briefPath = path.join(root, "src/data/processBriefs.ts");
{
  const c = migrateProcessBriefs(fs.readFileSync(briefPath, "utf8"));
  fs.writeFileSync(briefPath, c, "utf8");
  console.log("updated processBriefs.ts");
}
