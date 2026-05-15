"use client";

import * as React from "react";
import type { Tower } from "@/data/types";
import type { TowerId } from "@/data/assess/types";
import { towers } from "@/data/towers";
import {
  getAssessProgram,
  getAssessProgramHydrationSnapshot,
  getMyTowers,
  subscribe,
} from "@/lib/localStore";
import { isCapabilityMapJourneyStepDone } from "@/lib/assess/capabilityMapStepStatus";
import { getTowerStaleState } from "@/lib/initiatives/curationHash";
import { useInitiativeReviewsV6 } from "@/lib/initiatives/useInitiativeReviewsV6";
import {
  hubCapabilityMapLine,
  hubImpactLeversLine,
  hubOffshorePlanLine,
  impactEstimateSummaryLine,
  resolveAiInitiativesGuidance,
  resolveCapabilityMapGuidance,
  resolveImpactLeversGuidance,
  resolveOffshoreViewGuidance,
  towersPageLine,
} from "./resolveTowerJourneyGuidance";
import {
  countUnreviewedOffshoreRows,
  isClassificationStale,
  isOffshoreClassificationLocked,
} from "@/lib/assess/offshoreViewStepStatus";
import type { ResolvedJourneyGuidance } from "./types";
import { resolveProgramHomeGuidance } from "./programResume";

type DialStatus = "no-footprint" | "default-only" | "dialed";

function dialStatus(
  program: import("@/data/assess/types").AssessProgramV2,
  towerId: TowerId,
): DialStatus {
  const t = program.towers[towerId];
  if (!t || !t.l4Rows.length) return "no-footprint";
  // Dials live on l3Rows under v6 (Job Family grain); l4Rows still exist
  // as read-only context but no longer carry the offshore / AI dial values.
  const l3 = t.l3Rows ?? [];
  const hasOff = l3.some((r) => r.offshoreAssessmentPct != null);
  const hasAi = l3.some((r) => r.aiImpactAssessmentPct != null);
  return hasOff || hasAi ? "dialed" : "default-only";
}

export function useGuidanceCapabilityMap(towerId: TowerId): ResolvedJourneyGuidance {
  const [program, setProgram] = React.useState(() => getAssessProgramHydrationSnapshot());
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);
  return React.useMemo(() => {
    const rows = program.towers[towerId]?.l4Rows ?? [];
    const blankL4Count = rows.filter(
      (r) => !r.l5Activities || r.l5Activities.length === 0,
    ).length;
    const stale = getTowerStaleState(program.towers[towerId]);
    return resolveCapabilityMapGuidance({
      rowCount: rows.length,
      blankL4Count,
      stale,
      towerId,
      l1L3JourneyStepComplete: isCapabilityMapJourneyStepDone(
        program.towers[towerId],
      ),
    });
  }, [program, towerId]);
}

export function useGuidanceImpactLevers(
  towerId: TowerId,
  towerName: string,
): ResolvedJourneyGuidance {
  const [program, setProgram] = React.useState(() => getAssessProgramHydrationSnapshot());
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);
  return React.useMemo(() => {
    const rows = program.towers[towerId]?.l4Rows ?? [];
    const stale = getTowerStaleState(program.towers[towerId]);
    const isTowerLeadComplete = program.towers[towerId]?.status === "complete";
    const offshoreViewValidated =
      program.towers[towerId]?.offshoreViewValidatedAt != null;
    return resolveImpactLeversGuidance({
      rowCount: rows.length,
      stale,
      isTowerLeadComplete: !!isTowerLeadComplete,
      towerName,
      towerId,
      offshoreViewValidated,
    });
  }, [program, towerId, towerName]);
}

export function useGuidanceOffshoreView(
  towerId: TowerId,
  towerName: string,
): ResolvedJourneyGuidance {
  const [program, setProgram] = React.useState(() => getAssessProgramHydrationSnapshot());
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);
  return React.useMemo(() => {
    const tower = program.towers[towerId];
    const rows = tower?.l4Rows ?? [];
    let unreviewedRowCount = 0;
    let unchangedFromAiCount = 0;
    for (const r of rows) {
      const src = r.gccPctSource;
      if (!src || src === "seed") {
        unreviewedRowCount += 1;
        continue;
      }
      if (src === "ai") unchangedFromAiCount += 1;
    }
    return resolveOffshoreViewGuidance({
      rowCount: rows.length,
      unreviewedRowCount,
      unchangedFromAiCount,
      classificationStale: isClassificationStale(tower),
      offshoreViewValidated: tower?.offshoreViewValidatedAt != null,
      towerName,
      towerId,
    });
  }, [program, towerId, towerName]);
}

export function useGuidanceAiInitiatives(tower: Tower): ResolvedJourneyGuidance {
  const { counts } = useInitiativeReviewsV6(tower);
  const [program, setProgram] = React.useState(() => getAssessProgramHydrationSnapshot());
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);
  return React.useMemo(() => {
    const tid = tower.id as TowerId;
    const stale = getTowerStaleState(program.towers[tid]);
    const stepFourValidated =
      program.towers[tid]?.aiInitiativesValidatedAt != null;
    const hasAiReadinessIntake =
      program.towers[tid]?.aiReadinessIntake != null;
    return resolveAiInitiativesGuidance({
      stale,
      pendingReviewCount: counts.pending,
      towerName: tower.name,
      towerId: tid,
      stepFourValidated,
      hasAiReadinessIntake,
    });
  }, [program, tower, counts.pending]);
}

export function useProgramHomeGuidance(): ResolvedJourneyGuidance {
  const [program, setProgram] = React.useState(() => getAssessProgramHydrationSnapshot());
  const [mine, setMine] = React.useState<TowerId[]>([]);
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);
  React.useEffect(() => {
    setMine(getMyTowers());
    return subscribe("myTowers", () => setMine(getMyTowers()));
  }, []);
  return React.useMemo(
    () => resolveProgramHomeGuidance(program, mine),
    [program, mine],
  );
}

/**
 * Per-surface hooks so we never call `useInitiativeReviewsV6`
 * conditionally (Step 4 only, always receives a `Tower`).
 */
export function useGuidanceCapabilityMapHub(): ResolvedJourneyGuidance {
  const [program, setProgram] = React.useState(() => getAssessProgramHydrationSnapshot());
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);
  return React.useMemo(() => {
    const hasAny = towers.some(
      (t) => (program.towers[t.id as TowerId]?.l4Rows.length ?? 0) > 0,
    );
    return hubCapabilityMapLine(hasAny);
  }, [program]);
}

export function useGuidanceOffshoreHub(): ResolvedJourneyGuidance {
  const [program, setProgram] = React.useState(() => getAssessProgramHydrationSnapshot());
  const [mine, setMine] = React.useState<TowerId[]>([]);
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);
  React.useEffect(() => {
    setMine(getMyTowers());
    return subscribe("myTowers", () => setMine(getMyTowers()));
  }, []);
  return React.useMemo(() => {
    const minePicked = mine.length > 0;
    const mineSet = new Set(mine);
    const orderedTowers = minePicked
      ? [
          ...towers.filter((t) => mineSet.has(t.id as TowerId)),
          ...towers.filter((t) => !mineSet.has(t.id as TowerId)),
        ]
      : [...towers];
    const towersWithRows = orderedTowers.filter(
      (t) => (program.towers[t.id as TowerId]?.l4Rows.length ?? 0) > 0,
    );
    const hasAnyTowerWithRows = towersWithRows.length > 0;
    const allLocked =
      hasAnyTowerWithRows &&
      towersWithRows.every((t) =>
        isOffshoreClassificationLocked(program.towers[t.id as TowerId]),
      );
    // First tower with at least one unreviewed (seed-source) row that is
    // not already locked — the natural "next" the lead should open.
    const inProgressTower =
      towersWithRows.find((t) => {
        const ts = program.towers[t.id as TowerId];
        if (!ts || isOffshoreClassificationLocked(ts)) return false;
        return countUnreviewedOffshoreRows(ts) > 0;
      }) ?? null;
    return hubOffshorePlanLine(
      hasAnyTowerWithRows,
      inProgressTower
        ? { name: inProgressTower.name, id: inProgressTower.id }
        : null,
      allLocked,
    );
  }, [program, mine]);
}

export function useGuidanceImpactHub(): ResolvedJourneyGuidance {
  const [program, setProgram] = React.useState(() => getAssessProgramHydrationSnapshot());
  const [mine, setMine] = React.useState<TowerId[]>([]);
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);
  React.useEffect(() => {
    setMine(getMyTowers());
    return subscribe("myTowers", () => setMine(getMyTowers()));
  }, []);
  return React.useMemo(() => {
    const minePicked = mine.length > 0;
    const mineSet = new Set(mine);
    const orderedTowers = minePicked
      ? [
          ...towers.filter((t) => mineSet.has(t.id as TowerId)),
          ...towers.filter((t) => !mineSet.has(t.id as TowerId)),
        ]
      : [...towers];
    const hasFootprint = orderedTowers.some(
      (t) => dialStatus(program, t.id as TowerId) !== "no-footprint",
    );
    const defaultOnlyTowers = orderedTowers.filter(
      (t) => dialStatus(program, t.id as TowerId) === "default-only",
    );
    const hasDefault = defaultOnlyTowers.length > 0;
    const nextT = defaultOnlyTowers[0] ?? null;
    return hubImpactLeversLine(hasFootprint, hasDefault, nextT);
  }, [program, mine]);
}

export function useGuidanceImpactEstimateSummary(): ResolvedJourneyGuidance {
  const [program, setProgram] = React.useState(() => getAssessProgramHydrationSnapshot());
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);
  return React.useMemo(() => {
    let hasFootprint = false;
    let pendingStep3Count = 0;
    for (const t of towers) {
      const tid = t.id as TowerId;
      const ts = program.towers[tid];
      if (ts && ts.l4Rows.length > 0) {
        hasFootprint = true;
        if (ts.impactEstimateValidatedAt == null) pendingStep3Count += 1;
      }
    }
    return impactEstimateSummaryLine(hasFootprint, pendingStep3Count);
  }, [program]);
}

export function useGuidanceTowersList(): ResolvedJourneyGuidance {
  const [program, setProgram] = React.useState(() => getAssessProgramHydrationSnapshot());
  const [mine, setMine] = React.useState<TowerId[]>([]);
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);
  React.useEffect(() => {
    setMine(getMyTowers());
    return subscribe("myTowers", () => setMine(getMyTowers()));
  }, []);
  return React.useMemo(() => {
    const minePicked = mine.length > 0;
    const mineSet = new Set(mine);
    const orderedTowers = minePicked
      ? [
          ...towers.filter((t) => mineSet.has(t.id as TowerId)),
          ...towers.filter((t) => !mineSet.has(t.id as TowerId)),
        ]
      : [...towers];
    for (const t of orderedTowers) {
      const tid = t.id as TowerId;
      const rows = program.towers[tid]?.l4Rows ?? [];
      if (rows.length === 0) continue;
      const stale = getTowerStaleState(program.towers[tid]);
      if (stale.initiativesStale) {
        return towersPageLine({ name: t.name, id: tid });
      }
    }
    return towersPageLine(null);
  }, [program, mine]);
}
