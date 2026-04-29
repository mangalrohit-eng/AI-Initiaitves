import type { Tower } from "@/data/types";

/** Comma-separated Versant tower leads from catalog data (for status rollups). */
export function formatVersantTowerLeadNames(tower: Tower): string {
  const names = tower.versantLeads?.filter((n) => n.trim().length > 0) ?? [];
  if (names.length === 0) return "TBD — subject to discovery";
  return names.join(", ");
}

/** Comma-separated Accenture tower leads from catalog data (program office / delivery view). */
export function formatAccentureTowerLeadNames(tower: Tower): string {
  const names = tower.accentureLeads?.filter((n) => n.trim().length > 0) ?? [];
  if (names.length === 0) return "TBD — subject to discovery";
  return names.join(", ");
}
