import type { AssessProgramV2 } from "@/data/assess/types";
import type { Tower } from "@/data/types";
import type { ActivityEvent, ActivityEventKind } from "./types";

const MAX_PER_TOWER = 2;
const MAX_TOTAL = 12;

type StampField =
  | "capabilityMapConfirmedAt"
  | "headcountConfirmedAt"
  | "offshoreConfirmedAt"
  | "aiConfirmedAt"
  | "impactEstimateValidatedAt"
  | "aiInitiativesValidatedAt";

const FIELD_TO_KIND: Record<StampField, ActivityEventKind> = {
  capabilityMapConfirmedAt: "capability-map-confirmed",
  headcountConfirmedAt: "headcount-confirmed",
  offshoreConfirmedAt: "offshore-confirmed",
  aiConfirmedAt: "ai-confirmed",
  impactEstimateValidatedAt: "impact-validated",
  aiInitiativesValidatedAt: "ai-initiatives-validated",
};

/**
 * Walks every tower's deliberate-action timestamps and emits one ActivityEvent
 * per non-empty stamp. Sorted newest-first, capped to 2 events per tower so a
 * single very-active tower can't crowd out the other 12, then capped to the
 * top 12 events overall.
 */
export function deriveActivity(
  program: AssessProgramV2,
  towers: ReadonlyArray<Tower>,
): ActivityEvent[] {
  const towerById = new Map(towers.map((t) => [t.id, t] as const));
  const events: ActivityEvent[] = [];

  for (const [towerId, state] of Object.entries(program.towers ?? {})) {
    if (!state) continue;
    const tower = towerById.get(towerId);
    if (!tower) continue;

    for (const field of Object.keys(FIELD_TO_KIND) as StampField[]) {
      const at = state[field];
      if (!at || typeof at !== "string") continue;
      const ms = Date.parse(at);
      if (!Number.isFinite(ms)) continue;
      events.push({
        towerId: tower.id,
        towerName: tower.name,
        kind: FIELD_TO_KIND[field],
        at,
        href: `/tower/${tower.id}`,
      });
    }
  }

  events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const perTower = new Map<string, number>();
  const out: ActivityEvent[] = [];
  for (const ev of events) {
    if (out.length >= MAX_TOTAL) break;
    const seen = perTower.get(ev.towerId) ?? 0;
    if (seen >= MAX_PER_TOWER) continue;
    perTower.set(ev.towerId, seen + 1);
    out.push(ev);
  }
  return out;
}
