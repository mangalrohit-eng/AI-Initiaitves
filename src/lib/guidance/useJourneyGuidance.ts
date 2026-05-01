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
import { useInitiativeReviews } from "@/lib/initiatives/useInitiativeReviews";
import {
  hubCapabilityMapLine,
  hubImpactLeversLine,
  impactEstimateSummaryLine,
  resolveAiInitiativesGuidance,
  resolveCapabilityMapGuidance,
  resolveImpactLeversGuidance,
  towersPageLine,
} from "./resolveTowerJourneyGuidance";
import type { ResolvedJourneyGuidance } from "./types";
import { resolveProgramHomeGuidance } from "./programResume";

type DialStatus = "no-footprint" | "default-only" | "dialed";

function dialStatus(
  program: import("@/data/assess/types").AssessProgramV2,
  towerId: TowerId,
): DialStatus {
  const t = program.towers[towerId];
  if (!t || !t.l4Rows.length) return "no-footprint";
  const hasOff = t.l4Rows.some((r) => r.offshoreAssessmentPct != null);
  const hasAi = t.l4Rows.some((r) => r.aiImpactAssessmentPct != null);
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
    return resolveImpactLeversGuidance({
      rowCount: rows.length,
      stale,
      isTowerLeadComplete: !!isTowerLeadComplete,
      towerName,
      towerId,
    });
  }, [program, towerId, towerName]);
}

export function useGuidanceAiInitiatives(tower: Tower): ResolvedJourneyGuidance {
  const { counts } = useInitiativeReviews(tower);
  const [program, setProgram] = React.useState(() => getAssessProgramHydrationSnapshot());
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);
  return React.useMemo(() => {
    const tid = tower.id as TowerId;
    const stale = getTowerStaleState(program.towers[tid]);
    return resolveAiInitiativesGuidance({
      stale,
      pendingReviewCount: counts.pending,
      towerName: tower.name,
      towerId: tid,
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
 * Per-surface hooks so we never call `useInitiativeReviews` conditionally
 * (Step 4 only, always receives a `Tower`).
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
    const hasFootprint = towers.some(
      (t) => (program.towers[t.id as TowerId]?.l4Rows.length ?? 0) > 0,
    );
    return impactEstimateSummaryLine(hasFootprint);
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
