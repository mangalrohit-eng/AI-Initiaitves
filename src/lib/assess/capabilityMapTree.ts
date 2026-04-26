import type { L4WorkforceRow } from "@/data/assess/types";
import type { CapabilityMapDefinition } from "@/data/capabilityMap/types";

/** Unified shape for the capability map view (L1 is in scopeName). */
export type MapViewL4 = { id: string; name: string };
export type MapViewL3 = { name: string; l4: MapViewL4[] };
export type MapViewL2 = { name: string; l3: MapViewL3[] };
export type CapabilityMapViewModel = {
  l1Name: string;
  secondaryLabel?: string;
  l2: MapViewL2[];
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function rowKey(l2: string, l3: string, l4: string): string {
  return `${norm(l2)}|${norm(l3)}|${norm(l4)}`;
}

/**
 * Infers L2 / L3 / L4 from uploaded footprint rows when no canonical map exists for the tower.
 */
export function inferCapabilityViewFromRows(
  l1Name: string,
  rows: L4WorkforceRow[],
): CapabilityMapViewModel {
  const l2Order: string[] = [];
  const l2Map = new Map<string, Map<string, MapViewL3>>();

  for (const r of rows) {
    if (!l2Map.has(r.l2)) {
      l2Map.set(r.l2, new Map());
      l2Order.push(r.l2);
    }
    const m3 = l2Map.get(r.l2)!;
    if (!m3.has(r.l3)) {
      m3.set(r.l3, { name: r.l3, l4: [] });
    }
    const l3b = m3.get(r.l3)!;
    if (!l3b.l4.some((x) => x.id === r.id)) {
      l3b.l4.push({ id: r.id, name: r.l4 });
    }
  }

  return {
    l1Name,
    l2: l2Order.map((l2) => {
      const m3 = l2Map.get(l2)!;
      const l3s = Array.from(m3.values());
      return { name: l2, l3: l3s };
    }),
  };
}

export function definitionToViewModel(
  d: CapabilityMapDefinition,
  secondaryLabel?: string,
): CapabilityMapViewModel {
  return {
    l1Name: d.l1Name,
    secondaryLabel: secondaryLabel ?? d.name,
    l2: d.l2.map((l2) => ({
      name: l2.name,
      l3: l2.l3.map((l3) => ({
        name: l3.name,
        l4: l3.l4.map((l4) => ({ id: l4.id, name: l4.name })),
      })),
    })),
  };
}

/** Resolves a footprint row for a map L4: match id first, then L2+L3+L4 name. */
export function findRowForMapL4(
  rows: L4WorkforceRow[],
  l2: string,
  l3: string,
  l4: MapViewL4,
): L4WorkforceRow | undefined {
  const byId = rows.find((r) => r.id === l4.id);
  if (byId) return byId;
  return rows.find((r) => rowKey(r.l2, r.l3, r.l4) === rowKey(l2, l3, l4.name));
}

export function isL4InFootprint(
  rows: L4WorkforceRow[],
  l2: string,
  l3: string,
  l4: MapViewL4,
): boolean {
  return findRowForMapL4(rows, l2, l3, l4) !== undefined;
}
