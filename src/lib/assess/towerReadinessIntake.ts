import type {
  AssessProgramV2,
  L4WorkforceRow,
  TowerAiReadinessIntake,
  TowerAssessState,
} from "@/data/assess/types";
import { towers } from "@/data/towers";
import { hasQueuedRows } from "@/lib/initiatives/curationHash";

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

/** Round-trip from JSON (Postgres / export). */
export function parseAiReadinessIntakeFromUnknown(
  x: unknown,
): TowerAiReadinessIntake | undefined {
  if (!isRecord(x)) return undefined;
  const str = (k: string) => (typeof x[k] === "string" ? (x[k] as string) : "");
  const importedAt =
    typeof x.importedAt === "string" && x.importedAt.trim()
      ? x.importedAt.trim()
      : new Date().toISOString();
  const out = normalizeTowerReadinessIntakeFields({
    systemsPlatforms: str("systemsPlatforms"),
    currentAiTools: str("currentAiTools"),
    experimentsLearnings: str("experimentsLearnings"),
    dataRelevant: str("dataRelevant"),
    constraints: str("constraints"),
    biggestImpact: str("biggestImpact"),
    readyNow: str("readyNow"),
    noGoAreas: str("noGoAreas"),
    importedAt,
    sourceFileName: typeof x.sourceFileName === "string" ? x.sourceFileName : undefined,
    respondentTowerLabel:
      typeof x.respondentTowerLabel === "string" ? x.respondentTowerLabel : undefined,
  });
  const empty =
    !out.systemsPlatforms.trim() &&
    !out.constraints.trim() &&
    !out.currentAiTools.trim() &&
    !out.experimentsLearnings.trim() &&
    !out.dataRelevant.trim() &&
    !out.biggestImpact.trim() &&
    !out.readyNow.trim() &&
    !out.noGoAreas.trim();
  if (empty) return undefined;
  return out;
}

/** Shown next to recommendations when the digest was applied in that LLM run. */
export const TOWER_READINESS_ATTRIBUTION_LABEL =
  "Informed by tower AI readiness questionnaire";

export const TOWER_READINESS_MAX_FIELD_CHARS = 4_000;
export const TOWER_READINESS_MAX_DIGEST_CHARS = 12_000;

const B_LABEL_SNIPPETS: readonly { row: number; needle: string }[] = [
  { row: 5, needle: "tower name" },
  { row: 6, needle: "systems and platforms" },
  { row: 7, needle: "ai or automation" },
  { row: 8, needle: "ai experiments" },
  { row: 9, needle: "data does your tower" },
  { row: 10, needle: "constraints would apply" },
  { row: 11, needle: "biggest impact" },
  { row: 12, needle: "ready now" },
  { row: 13, needle: "explicitly not go" },
];

function clampField(s: string): string {
  const t = s.trim();
  if (t.length <= TOWER_READINESS_MAX_FIELD_CHARS) return t;
  return `${t.slice(0, TOWER_READINESS_MAX_FIELD_CHARS)}…`;
}

export function normalizeTowerReadinessIntakeFields(
  raw: Omit<TowerAiReadinessIntake, "importedAt"> & { importedAt?: string },
): TowerAiReadinessIntake {
  const importedAt = raw.importedAt ?? new Date().toISOString();
  return {
    systemsPlatforms: clampField(raw.systemsPlatforms ?? ""),
    currentAiTools: clampField(raw.currentAiTools ?? ""),
    experimentsLearnings: clampField(raw.experimentsLearnings ?? ""),
    dataRelevant: clampField(raw.dataRelevant ?? ""),
    constraints: clampField(raw.constraints ?? ""),
    biggestImpact: clampField(raw.biggestImpact ?? ""),
    readyNow: clampField(raw.readyNow ?? ""),
    noGoAreas: clampField(raw.noGoAreas ?? ""),
    importedAt,
    sourceFileName: raw.sourceFileName,
    respondentTowerLabel: raw.respondentTowerLabel?.trim()
      ? clampField(raw.respondentTowerLabel)
      : undefined,
  };
}

/** Minimum substance for attribution chips and "intake present" UX. */
export function intakeHasMinimumSubstance(intake: TowerAiReadinessIntake | undefined): boolean {
  if (!intake) return false;
  const sys = intake.systemsPlatforms.trim().length;
  const con = intake.constraints.trim().length;
  return sys >= 12 && con >= 12;
}

/**
 * Bounded plain-text digest for LLM prompts. Questionnaire answers outrank
 * generic priors when both appear — caller adds that rule in the system prompt.
 */
export function buildTowerReadinessDigest(
  intake: TowerAiReadinessIntake | undefined,
): string | undefined {
  if (!intake || !intakeHasMinimumSubstance(intake)) return undefined;
  const lines: string[] = [
    "Tower AI readiness questionnaire (tower lead):",
    `Systems / platforms: ${intake.systemsPlatforms.trim()}`,
    `Current AI or automation tools: ${intake.currentAiTools.trim()}`,
    `AI experiments and learnings: ${intake.experimentsLearnings.trim()}`,
    `Data owned or depended on: ${intake.dataRelevant.trim()}`,
    `Constraints on AI initiatives: ${intake.constraints.trim()}`,
    `Biggest impact instincts: ${intake.biggestImpact.trim()}`,
    `Ready now / low risk: ${intake.readyNow.trim()}`,
    `Do not go (and why): ${intake.noGoAreas.trim()}`,
  ];
  let text = lines.join("\n");
  if (text.length > TOWER_READINESS_MAX_DIGEST_CHARS) {
    text = `${text.slice(0, TOWER_READINESS_MAX_DIGEST_CHARS)}…`;
  }
  return text;
}

/**
 * After intake import, queue rows that have L5 leaves so Refresh AI guidance
 * re-runs with the new digest. Skips in-flight pipeline rows.
 */
export function markRowsQueuedAfterIntakeImport(rows: L4WorkforceRow[]): L4WorkforceRow[] {
  return rows.map((r) => {
    const acts = r.l5Activities ?? [];
    if (acts.length === 0) return r;
    if (
      r.curationStage === "running-l5" ||
      r.curationStage === "running-verdict" ||
      r.curationStage === "running-curate"
    ) {
      return r;
    }
    return { ...r, curationStage: "queued" as const };
  });
}

/** Cross-tower synthesis: one digest block per tower that has intake. */
export function buildProgramWideTowerIntakeDigest(
  program: Pick<AssessProgramV2, "towers"> | undefined,
): string | undefined {
  if (!program?.towers) return undefined;
  const parts: string[] = [];
  for (const t of towers) {
    const intake = program.towers[t.id]?.aiReadinessIntake;
    const block = buildTowerReadinessDigest(intake);
    if (block) parts.push(`--- ${t.name} (${t.id}) ---\n${block}`);
  }
  if (parts.length === 0) return undefined;
  let s = parts.join("\n\n");
  const cap = 16_000;
  if (s.length > cap) s = `${s.slice(0, cap - 1)}…`;
  return s;
}

/** Latest questionnaire `importedAt` across all towers (ISO string compare). */
export function latestTowerIntakeImportedAtIso(
  program: Pick<AssessProgramV2, "towers"> | undefined,
): string | undefined {
  if (!program?.towers) return undefined;
  let best: string | undefined;
  for (const t of towers) {
    const iso = program.towers[t.id]?.aiReadinessIntake?.importedAt;
    if (!iso) continue;
    if (!best || iso > best) best = iso;
  }
  return best;
}

/** Step 4 banner: queued rows and curation predates latest intake import. */
export function shouldShowIntakeStaleBannerCopy(
  tower: Pick<TowerAssessState, "l4Rows" | "aiReadinessIntake"> | undefined,
): boolean {
  const intake = tower?.aiReadinessIntake;
  const rows = tower?.l4Rows ?? [];
  if (!intake || !hasQueuedRows(rows)) return false;
  const imported = intake.importedAt;
  return rows.some(
    (r) =>
      r.curationStage === "queued" &&
      (!r.curationGeneratedAt || r.curationGeneratedAt < imported),
  );
}

export function rowCurationUsesCurrentIntake(
  row: Pick<L4WorkforceRow, "curationGeneratedAt" | "curationStage"> | undefined,
  intake: TowerAiReadinessIntake | undefined,
): boolean {
  if (!row?.curationGeneratedAt || row.curationStage !== "done") return false;
  if (!intakeHasMinimumSubstance(intake) || !intake) return false;
  return row.curationGeneratedAt >= intake.importedAt;
}

export function validateIntakeTemplateQuestionCells(
  getBText: (row: number) => string,
): { ok: true } | { ok: false; error: string } {
  for (const { row, needle } of B_LABEL_SNIPPETS) {
    const cell = getBText(row).toLowerCase();
    if (!cell.includes(needle)) {
      return {
        ok: false,
        error: `This file does not match the expected Tower AI Readiness template (row ${row} question label).`,
      };
    }
  }
  return { ok: true };
}
