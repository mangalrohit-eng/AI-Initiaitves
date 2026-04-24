/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const SPEC_PATH = "C:\\Users\\rohit.m.mangal\\Downloads\\Cursor_New_P1_P2_Process_Briefs.md";
const OUT_PATH = path.join(__dirname, "..", "src", "data", "processBriefs.ts");

const towerHeaders = [
  { re: /###\s+TOWER 1: FINANCE/i, slug: "finance" },
  { re: /###\s+TOWER 2: HR/i, slug: "hr" },
  { re: /###\s+TOWER 3: RESEARCH/i, slug: "research-analytics" },
  { re: /###\s+TOWER 4: LEGAL/i, slug: "legal" },
  { re: /###\s+TOWER 5: CORPORATE/i, slug: "corp-services" },
  { re: /###\s+TOWER 6: TECH/i, slug: "tech-engineering" },
  { re: /###\s+TOWER 7: OPERATIONS/i, slug: "operations-technology" },
  { re: /###\s+TOWER 8: SALES/i, slug: "sales" },
  { re: /###\s+TOWER 9: MARKETING/i, slug: "marketing-comms" },
  { re: /###\s+TOWER 10: SERVICE/i, slug: "service" },
  { re: /###\s+TOWER 11: EDITORIAL/i, slug: "editorial-news" },
  { re: /###\s+TOWER 12: PRODUCTION/i, slug: "production" },
  { re: /###\s+TOWER 13: PROGRAMMING/i, slug: "programming-dev" },
];

const text = fs.readFileSync(SPEC_PATH, "utf8");

// Split into yaml blocks and track which tower each block belongs to.
const lines = text.split(/\r?\n/);
let currentTower = null;
const blocks = []; // { tower, body }
let inBlock = false;
let buf = [];

for (const line of lines) {
  const twr = towerHeaders.find((t) => t.re.test(line));
  if (twr) {
    currentTower = twr.slug;
    continue;
  }
  if (!inBlock && /^```yaml\s*$/.test(line)) {
    inBlock = true;
    buf = [];
    continue;
  }
  if (inBlock && /^```\s*$/.test(line)) {
    inBlock = false;
    if (currentTower && buf.length > 0) {
      blocks.push({ tower: currentTower, body: buf.join("\n") });
    }
    continue;
  }
  if (inBlock) buf.push(line);
}

const briefs = [];
for (const { tower, body } of blocks) {
  let parsed;
  try {
    parsed = yaml.load(body);
  } catch (err) {
    console.error("YAML parse failed:", err.message);
    console.error(body.slice(0, 400));
    continue;
  }
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  for (const item of arr) {
    if (!item || typeof item !== "object" || !item.id) continue;
    briefs.push({ tower, item });
  }
}

console.log(`Parsed ${briefs.length} briefs`);

// Validate required fields and fill in defaults for optional.
const ser = (v) => JSON.stringify(v, null, 2);

const header = `import type { AIProcessBrief } from "./types";

// ---------------------------------------------------------------------------
// AI Process Briefs
//
// Each brief is a lightweight pre/post + agents detail page for a P1/P2
// sub-process that sits underneath a parent initiative but doesn't warrant
// a full 4-lens treatment. Clicking a P1/P2 row in the operating model with
// a matching brief loads \`/tower/[slug]/brief/[briefSlug]\`.
//
// \`matchRowName\` is used to attach \`briefSlug\` onto the corresponding
// TowerProcess row at composition time in \`towers.ts\`.
//
// Generated from Cursor_New_P1_P2_Process_Briefs.md by scripts/build-briefs.cjs.
// ---------------------------------------------------------------------------

const b = (brief: AIProcessBrief): AIProcessBrief => brief;

export const processBriefs: AIProcessBrief[] = [
`;

const footer = `];

export const processBriefsBySlug: Map<string, AIProcessBrief> = new Map(
  processBriefs.map((brief) => [brief.id, brief]),
);
`;

function asStringArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String);
  return [String(v)];
}

const body = briefs
  .map(({ tower, item }) => {
    const name = String(item.name ?? item.id);
    const matchRowName = String(item.matchRowName ?? item.name ?? item.id);
    const parentProcessId = String(item.parentInitiativeId ?? item.parentProcessId ?? "");
    const aiPriority = item.aiPriority === "P2" ? "P2" : "P1";
    const pre = item.preState ?? {};
    const post = item.postState ?? {};
    const agents = Array.isArray(item.agentsInvolved) ? item.agentsInvolved : [];
    const tools = Array.isArray(item.toolsRequired) ? item.toolsRequired : [];
    const roles = Array.isArray(item.rolesImpacted) ? item.rolesImpacted : [];
    const obj = {
      id: String(item.id),
      name,
      towerSlug: tower,
      parentProcessId,
      matchRowName,
      aiPriority,
      ...(item.description ? { description: String(item.description) } : {}),
      impactTier: (() => {
        const v = item.impactTier;
        if (v === "High" || v === "Medium" || v === "Low") return v;
        const h = Number(item.estimatedAnnualHoursSaved ?? 0);
        if (h >= 5000) return "High";
        if (h >= 2000) return "Medium";
        return "Low";
      })(),
      preState: {
        summary: String(pre.summary ?? ""),
        painPoints: asStringArray(pre.painPoints),
        typicalCycleTime: String(pre.typicalCycleTime ?? ""),
      },
      postState: {
        summary: String(post.summary ?? ""),
        keyImprovements: asStringArray(post.keyImprovements),
        newCycleTime: String(post.newCycleTime ?? ""),
      },
      agentsInvolved: agents.map((a) => ({
        agentName: String(a.agentName ?? ""),
        roleInProcess: String(a.roleInProcess ?? ""),
      })),
      toolsRequired: tools.map((t) => ({
        tool: String(t.tool ?? ""),
        purpose: String(t.purpose ?? ""),
      })),
      keyMetric: String(item.keyMetric ?? ""),
      dependencies: asStringArray(item.dependencies),
      rolesImpacted: roles.map((r) => ({
        role: String(r.role ?? ""),
        impact: String(r.impact ?? ""),
      })),
    };
    return `  b(${ser(obj).replace(/\n/g, "\n  ")}),`;
  })
  .join("\n");

fs.writeFileSync(OUT_PATH, header + body + "\n" + footer, "utf8");
console.log(`Wrote ${OUT_PATH}`);
