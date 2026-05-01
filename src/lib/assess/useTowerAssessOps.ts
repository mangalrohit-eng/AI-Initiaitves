"use client";

import * as React from "react";
import { useToast } from "@/components/feedback/ToastProvider";
import { useAssessSync } from "@/components/assess/AssessSyncProvider";
import type { L3WorkforceRow, TowerId } from "@/data/assess/types";
import { defaultTowerBaseline, defaultTowerState } from "@/data/assess/types";
import { getTowerSeedState } from "@/data/assess/seedAssessProgram";
import {
  applyTowerStarterDefaults,
  countBlankL3Defaults,
} from "@/data/assess/seedAssessmentDefaults";
import { parseAssessFile } from "@/lib/assess/parseAssessFile";
import { weightedTowerLevers } from "@/lib/assess/scenarioModel";
import { useAsyncOp } from "@/lib/feedback/useAsyncOp";
import { markRowsQueuedOnUpload } from "@/lib/initiatives/curationHash";
import { stepCompletionNudge } from "@/lib/program/stepCompletionNudges";
import {
  getAssessProgram,
  getAssessProgramHydrationSnapshot,
  setTowerAssess,
  subscribe,
} from "@/lib/localStore";
import { isL1L3TreeLocked } from "@/lib/assess/capabilityMapStepStatus";

export type TowerAssessOps = ReturnType<typeof useTowerAssessOps>;

/**
 * Shared async operations for the Capability Map and Configure Impact Levers tower pages.
 *
 * The two routes manipulate the same underlying tower state — we extract every
 * persistence + toast + sync-flush concern here so both clients render only the
 * UI for their own step. The hook also subscribes to `assessProgram` so the
 * caller's render observes saves done on either page.
 */
export function useTowerAssessOps(towerId: TowerId, towerName: string) {
  const sync = useAssessSync();
  const toast = useToast();
  const [program, setProgram] = React.useState(() => getAssessProgramHydrationSnapshot());

  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);

  // Flush any pending debounced save when the user actually navigates away
  // from the tower page. We hold sync in a ref so the cleanup observes the
  // latest functions without re-running on every provider re-render — that
  // mistake caused an infinite save loop because every `saveState` transition
  // re-rendered the provider, changed the context reference, fired this
  // cleanup, and queued another PUT.
  const syncRef = React.useRef(sync);
  React.useEffect(() => {
    syncRef.current = sync;
  }, [sync]);
  React.useEffect(() => {
    return () => {
      const s = syncRef.current;
      if (s?.canSync) void s.flushSave();
    };
  }, []);

  const tState = program.towers[towerId] ?? { ...defaultTowerState() };
  const rows = tState.l4Rows;
  const global = program.global;
  const isComplete = tState.status === "complete";

  const hasHeadcount = rows.some(
    (r) => r.fteOnshore + r.fteOffshore + r.contractorOnshore + r.contractorOffshore > 0,
  );
  const hasAnyOffshoreInput = rows.some((r) => r.offshoreAssessmentPct != null);
  const hasAnyAiInput = rows.some((r) => r.aiImpactAssessmentPct != null);

  const patchRow = React.useCallback(
    (id: string, patch: Partial<L3WorkforceRow>) => {
      const cur = getAssessProgram().towers[towerId] ?? defaultTowerState();
      if (isL1L3TreeLocked(cur)) return;
      setTowerAssess(towerId, {
        l4Rows: cur.l4Rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        status: cur.status === "empty" ? "data" : cur.status,
      });
    },
    [towerId],
  );

  const importOp = useAsyncOp<{ rows: L3WorkforceRow[]; warnings: string[] }, [File]>({
    run: async (f) => {
      const res = await parseAssessFile(f);
      if (!res.rows.length) {
        throw new Error("No data rows parsed. Check the template columns.");
      }
      // A tower-lead upload is the canonical source of truth — record the
      // confirmation timestamp so the journey stepper marks Capability Map
      // complete and downstream consumers know the map is authored, not seeded.
      //
      // Blank-and-queue: every uploaded row is marked `queued` with a fresh
      // content hash so the StaleL4Banner (Step 1), StaleDialsBanner (Step 2),
      // and StaleCurationBanner (Step 4) all light up immediately. Tower
      // baseline soft-resets to the platform default (20%/15%) — the actual
      // staleness signal is `dialsRationaleSource: undefined`, NOT the dial
      // values themselves, so the soft-default sliders don't mislead users.
      // Sign-off timestamps are cleared so the "Reviewed by Tower Lead" pill
      // returns to "Pending" without needing extra disable logic on Step 2.
      const queuedRows = markRowsQueuedOnUpload(res.rows);
      setTowerAssess(towerId, {
        l4Rows: queuedRows,
        baseline: { ...defaultTowerBaseline },
        status: "data",
        capabilityMapConfirmedAt: new Date().toISOString(),
        l1L5TreeValidatedAt: undefined,
        l1L3TreeValidatedAt: undefined,
        headcountConfirmedAt: undefined,
        offshoreConfirmedAt: undefined,
        aiConfirmedAt: undefined,
      });
      if (sync?.canSync) await sync.flushSave();
      return { rows: queuedRows, warnings: res.errors };
    },
    messages: {
      loadingTitle: `Importing ${towerName} capability map & headcount`,
      loadingDescription: "Parsing rows and saving to the program...",
      successTitle: ({ rows: r }) =>
        `Imported ${r.length} row${r.length === 1 ? "" : "s"} for ${towerName}`,
      successDescription: ({ warnings }) =>
        warnings.length > 0
          ? `${warnings.length} warning${warnings.length === 1 ? "" : "s"} — review the parser output below.`
          : "Capability map & headcount loaded. Continue to the assessment when you're ready.",
      errorTitle: "Could not import capability map & headcount",
    },
  });

  const sampleLoadOp = useAsyncOp<{ rows: number; wasReload: boolean }, []>({
    run: async () => {
      const hadRows =
        (getAssessProgram().towers[towerId]?.l4Rows ?? []).length > 0;
      const seed = getTowerSeedState(towerId);
      // Sample loads are seed data, NOT a tower-lead authored map. Clear
      // confirmations, downstream step stamps, and initiative review keys so
      // the journey and AI Initiatives view stay consistent with a fresh seed.
      setTowerAssess(towerId, {
        l4Rows: seed.l4Rows,
        baseline: seed.baseline,
        status: seed.status,
        capabilityMapConfirmedAt: undefined,
        l1L5TreeValidatedAt: undefined,
        l1L3TreeValidatedAt: undefined,
        headcountConfirmedAt: undefined,
        offshoreConfirmedAt: undefined,
        aiConfirmedAt: undefined,
        impactEstimateValidatedAt: undefined,
        aiInitiativesValidatedAt: undefined,
        initiativeReviews: {},
      });
      if (sync?.canSync) await sync.flushSave();
      return { rows: seed.l4Rows.length, wasReload: hadRows };
    },
    messages: {
      loadingTitle: `Loading sample for ${towerName}`,
      successTitle: ({ wasReload, rows: r }) =>
        wasReload
          ? "Starter sample reloaded"
          : `Loaded ${r} starter row${r === 1 ? "" : "s"} for ${towerName}`,
      successDescription: ({ wasReload }) =>
        wasReload
          ? `Current edits for ${towerName} were replaced with the original sample.`
          : "Heuristic starter defaults applied. Review and override per L3 in Configure Impact Levers.",
      errorTitle: "Could not load sample",
    },
  });

  const blanks = React.useMemo(() => countBlankL3Defaults(rows), [rows]);

  const fillBlanksOp = useAsyncOp<{ changedRows: number; changedCells: number }, []>({
    run: async () => {
      if (!rows.length) throw new Error("Load a capability map & headcount first.");
      const result = applyTowerStarterDefaults(rows, towerId, "fillBlanks");
      if (result.changedCells === 0) {
        throw new Error("No blanks to fill — every row already has explicit values.");
      }
      const w = weightedTowerLevers(result.rows, tState.baseline, global);
      setTowerAssess(towerId, {
        l4Rows: result.rows,
        baseline: {
          baselineOffshorePct: Math.round(w.offshorePct),
          baselineAIPct: Math.round(w.aiPct),
        },
        status: tState.status === "empty" ? "data" : tState.status,
      });
      if (sync?.canSync) await sync.flushSave();
      return result;
    },
    messages: {
      loadingTitle: "Filling blanks from heuristic defaults",
      successTitle: ({ changedCells, changedRows }) =>
        `Filled ${changedCells} cell${changedCells === 1 ? "" : "s"} across ${changedRows} row${
          changedRows === 1 ? "" : "s"
        }`,
      successDescription:
        "Heuristic defaults applied only where explicit values were missing.",
      errorTitle: "Couldn't apply defaults",
    },
  });

  const overwriteAllOp = useAsyncOp<{ changedRows: number; changedCells: number }, []>({
    run: async () => {
      if (!rows.length) throw new Error("Load a capability map & headcount first.");
      const result = applyTowerStarterDefaults(rows, towerId, "overwriteAll");
      const w = weightedTowerLevers(result.rows, tState.baseline, global);
      setTowerAssess(towerId, {
        l4Rows: result.rows,
        baseline: {
          baselineOffshorePct: Math.round(w.offshorePct),
          baselineAIPct: Math.round(w.aiPct),
        },
        status: tState.status === "empty" ? "data" : tState.status,
      });
      if (sync?.canSync) await sync.flushSave();
      return result;
    },
    messages: {
      loadingTitle: "Re-applying starter defaults to every row",
      successTitle: ({ changedRows, changedCells }) =>
        `Re-seeded ${changedRows} row${changedRows === 1 ? "" : "s"} (${changedCells} cell${
          changedCells === 1 ? "" : "s"
        })`,
      successDescription: "All explicit overrides have been replaced.",
      errorTitle: "Couldn't re-apply defaults",
    },
  });

  const doMarkComplete = React.useCallback(async () => {
    if (!rows.length) {
      toast.error({ title: "Load a capability map & headcount first" });
      return false;
    }
    const w = weightedTowerLevers(rows, tState.baseline, global);
    const now = new Date().toISOString();
    setTowerAssess(towerId, {
      baseline: {
        baselineOffshorePct: w.offshorePct,
        baselineAIPct: w.aiPct,
      },
      // Stamp the three impact-lever review timestamps so the read-time
      // migration (`migrateBuggySeedComplete`) won't demote this back to
      // "data" on the next reload. We deliberately leave
      // `capabilityMapConfirmedAt` alone — that's set on the Capability Map
      // page when a tower lead uploads or confirms their map.
      headcountConfirmedAt: now,
      offshoreConfirmedAt: now,
      aiConfirmedAt: now,
      status: "complete",
    });
    if (sync?.canSync) await sync.flushSave();
    const n = stepCompletionNudge(2, towerName);
    toast.success({
      title: n.title,
      description: n.description,
      action: {
        label: "Open AI Initiatives",
        onClick: () => {
          window.location.href = `/tower/${towerId}`;
        },
      },
      durationMs: 8000,
    });
    return true;
  }, [global, rows, sync, toast, towerId, towerName, tState.baseline]);

  const doUnmarkComplete = React.useCallback(async () => {
    setTowerAssess(towerId, { status: rows.length ? "data" : "empty" });
    if (sync?.canSync) await sync.flushSave();
    toast.info({
      title: `${towerName} reopened for review`,
      description: "The tower is back to awaiting tower lead sign-off.",
    });
  }, [rows.length, sync, toast, towerId, towerName]);

  const markL1L5TreeValidated = React.useCallback(async () => {
    setTowerAssess(towerId, {
      l1L5TreeValidatedAt: new Date().toISOString(),
      // Clear the legacy V4 alias so a freshly confirmed map only carries
      // the canonical V5 timestamp.
      l1L3TreeValidatedAt: undefined,
    });
    if (sync?.canSync) await sync.flushSave();
    const n = stepCompletionNudge(1, towerName);
    toast.success({ title: n.title, description: n.description, durationMs: 6500 });
  }, [sync, toast, towerId, towerName]);

  const clearL1L5TreeValidation = React.useCallback(async () => {
    setTowerAssess(towerId, {
      l1L5TreeValidatedAt: undefined,
      l1L3TreeValidatedAt: undefined,
    });
    if (sync?.canSync) await sync.flushSave();
    toast.info({
      title: "Capability map unlocked for editing",
      description:
        "You can change headcount, upload a new map, or adjust L5 Activities. Confirm again when ready to proceed.",
    });
  }, [sync, toast, towerId]);

  /** @deprecated Renamed to `markL1L5TreeValidated` in the 5-layer migration. */
  const markL1L3TreeValidated = markL1L5TreeValidated;
  /** @deprecated Renamed to `clearL1L5TreeValidation` in the 5-layer migration. */
  const clearL1L3TreeValidation = clearL1L5TreeValidation;

  return {
    program,
    tState,
    rows,
    global,
    blanks,
    isComplete,
    hasHeadcount,
    hasAnyOffshoreInput,
    hasAnyAiInput,
    patchRow,
    importOp,
    sampleLoadOp,
    fillBlanksOp,
    overwriteAllOp,
    doMarkComplete,
    doUnmarkComplete,
    markL1L5TreeValidated,
    clearL1L5TreeValidation,
    /** @deprecated Renamed to `markL1L5TreeValidated` in the 5-layer migration. */
    markL1L3TreeValidated,
    /** @deprecated Renamed to `clearL1L5TreeValidation` in the 5-layer migration. */
    clearL1L3TreeValidation,
  };
}
