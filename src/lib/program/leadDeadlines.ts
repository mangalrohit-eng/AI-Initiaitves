import { towers } from "@/data/towers";
import type { TowerId, TowerLeadDeadlines } from "@/data/assess/types";

function isTowerId(s: string): s is TowerId {
  return towers.some((t) => t.id === s);
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidYmd(s: string): boolean {
  if (!YMD_RE.test(s)) return false;
  const d = new Date(`${s}T12:00:00`);
  return !Number.isNaN(d.getTime());
}

/** Parse `leadDeadlines` from JSON; invalid keys/values dropped. */
export function parseLeadDeadlines(raw: unknown): Partial<Record<TowerId, TowerLeadDeadlines>> | undefined {
  if (!isRecord(raw)) return undefined;
  const out: Partial<Record<TowerId, TowerLeadDeadlines>> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!isTowerId(k) || !isRecord(v)) continue;
    const row: TowerLeadDeadlines = {};
    for (const key of ["step1Due", "step2Due", "step3Due", "step4Due"] as const) {
      const val = v[key];
      if (typeof val === "string" && isValidYmd(val)) row[key] = val;
    }
    if (Object.keys(row).length > 0) out[k] = row;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Deep-merge per-tower deadline rows. Empty `incoming` returns `base`.
 * Per-tower empty objects are skipped so partial imports do not clear a tower.
 */
export function mergeLeadDeadlines(
  base: Partial<Record<TowerId, TowerLeadDeadlines>> | undefined,
  incoming: Partial<Record<TowerId, TowerLeadDeadlines>> | undefined,
): Partial<Record<TowerId, TowerLeadDeadlines>> | undefined {
  if (!incoming || Object.keys(incoming).length === 0) return base;
  if (!base) return incoming;
  const out: Partial<Record<TowerId, TowerLeadDeadlines>> = { ...base };
  for (const tid of Object.keys(incoming) as TowerId[]) {
    const inc = incoming[tid];
    if (!inc || Object.keys(inc).length === 0) continue;
    out[tid] = { ...(base[tid] ?? {}), ...inc };
  }
  return out;
}
