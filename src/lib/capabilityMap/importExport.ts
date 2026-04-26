import {
  getCapabilityMapState,
  setCapabilityMapState,
  type CapabilityMapPersistedStateV1,
} from "@/lib/localStore";
import { defaultCapabilitySavingsAssumptions, type L4LeadInputs, type CapabilitySavingsAssumptions } from "@/data/capabilityMap/types";
import { getCapabilityMapById } from "@/data/capabilityMap/maps";

function isObject(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object";
}

function validateAssumptions(a: unknown): CapabilitySavingsAssumptions | null {
  if (!isObject(a)) return null;
  const c = a.combineMode;
  if (c !== "additive" && c !== "capped") return null;
  return {
    offshoreLeverWeight: Number(a.offshoreLeverWeight),
    aiLeverWeight: Number(a.aiLeverWeight),
    combineMode: c,
    combinedCapPctOfSpend: Number(a.combinedCapPctOfSpend),
    waveBaseMonths: Number(a.waveBaseMonths),
    monthsPerPointNotAutomated: Number(a.monthsPerPointNotAutomated),
  };
}

function validateL4Inputs(raw: unknown): Record<string, L4LeadInputs> {
  if (!isObject(raw)) return {};
  const out: Record<string, L4LeadInputs> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!isObject(v)) continue;
    const row: L4LeadInputs = {};
    if (v.headcount != null) row.headcount = Number(v.headcount);
    if (v.spend != null) row.spend = Number(v.spend);
    if (v.contractors != null) row.contractors = Number(v.contractors);
    if (v.offshorePct != null) row.offshorePct = Number(v.offshorePct);
    if (v.aiAutomationPct != null) row.aiAutomationPct = Number(v.aiAutomationPct);
    out[k] = row;
  }
  return out;
}

export function parseImportedCapabilityState(json: unknown):
  | { ok: true; state: CapabilityMapPersistedStateV1 }
  | { ok: false; error: string } {
  if (!isObject(json) || json.version !== 1) {
    return { ok: false, error: "Expected version 1 export." };
  }
  if (typeof json.mapId !== "string" || !getCapabilityMapById(json.mapId)) {
    return { ok: false, error: "Unknown or missing mapId." };
  }
  const assumptions = validateAssumptions(json.assumptions) ?? { ...defaultCapabilitySavingsAssumptions };
  const l4Inputs = validateL4Inputs(json.l4Inputs);
  return {
    ok: true,
    state: { version: 1, mapId: json.mapId, l4Inputs, assumptions },
  };
}

export function applyImportedState(state: CapabilityMapPersistedStateV1): void {
  setCapabilityMapState(state);
}

export function buildExportSnapshot(): CapabilityMapPersistedStateV1 {
  return { ...getCapabilityMapState() };
}
