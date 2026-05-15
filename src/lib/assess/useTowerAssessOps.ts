"use client";

import * as React from "react";
import { useToast } from "@/components/feedback/ToastProvider";
import { useAssessSync } from "@/components/assess/AssessSyncProvider";
import type {
  GccPctSource,
  L3WorkforceRow,
  L4WorkforceRow,
  TowerId,
} from "@/data/assess/types";
import { defaultTowerBaseline, defaultTowerState } from "@/data/assess/types";
import {
  applyTowerStarterDefaults,
  countBlankL3Defaults,
} from "@/data/assess/seedAssessmentDefaults";
import { parseAssessFile } from "@/lib/assess/parseAssessFile";
import { weightedTowerLevers } from "@/lib/assess/scenarioModel";
import { useAsyncOp } from "@/lib/feedback/useAsyncOp";
import { markRowsQueuedOnUpload } from "@/lib/initiatives/curationHash";
import { resolveRowDescriptions } from "@/data/capabilityMap/descriptions";
import { deriveL3Rows } from "@/lib/assess/deriveL3Rows";
import { clampPct, totalRowHc } from "@/lib/offshore/offshoreSplit";
import { stepCompletionNudge } from "@/lib/program/stepCompletionNudges";
import {
  getAssessProgram,
  getAssessProgramHydrationSnapshot,
  setTowerAssess,
  subscribe,
} from "@/lib/localStore";

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

  const tState = program.towers[towerId] ?? defaultTowerState(towerId);
  const rows = tState.l4Rows;
  const rates = tState.rates;
  const isComplete = tState.status === "complete";

  const hasHeadcount = rows.some(
    (r) => r.fteOnshore + r.fteOffshore + r.contractorOnshore + r.contractorOffshore > 0,
  );
  const hasAnyOffshoreInput = rows.some((r) => r.offshoreAssessmentPct != null);
  const hasAnyAiInput = rows.some((r) => r.aiImpactAssessmentPct != null);

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
      const queuedRows = markRowsQueuedOnUpload(res.rows, (row) =>
        resolveRowDescriptions(towerId, row.l2, row.l3, row.l4),
      );
      // Derive L3 Job Family rows from the L4 upload. The L4 rows
      // themselves stay in storage as read-only LLM context; the L3 rows
      // become the dial-bearing primary entity for Step 2 and the curation
      // grain for Step 4. Each derived row is stamped `curationStage:
      // "queued"` by `deriveL3Rows` so the StaleCurationBanner picks it up.
      const derivedL3Rows = deriveL3Rows(queuedRows, towerId);
      setTowerAssess(towerId, {
        l4Rows: queuedRows,
        l3Rows: derivedL3Rows,
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

  const blanks = React.useMemo(() => countBlankL3Defaults(rows), [rows]);

  const fillBlanksOp = useAsyncOp<{ changedRows: number; changedCells: number }, []>({
    run: async () => {
      if (!rows.length) throw new Error("Load a capability map & headcount first.");
      const result = applyTowerStarterDefaults(rows, towerId, "fillBlanks");
      if (result.changedCells === 0) {
        throw new Error("No blanks to fill — every row already has explicit values.");
      }
      const w = weightedTowerLevers(result.rows, tState.baseline, rates);
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
      const w = weightedTowerLevers(result.rows, tState.baseline, rates);
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
    const w = weightedTowerLevers(rows, tState.baseline, rates);
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
  }, [rates, rows, sync, toast, towerId, towerName, tState.baseline]);

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
    // Cascade: reopening Step 1 invalidates Step 2 sign-off because the
    // headcount baseline Step 2 was confirmed against may now change.
    // Demoting status also stops migrateBackfillStep1Validated (in
    // localStore) from re-stamping l1L5TreeValidatedAt on the next read —
    // without the demotion, towers that previously reached `status:
    // "complete"` (e.g. Finance, HR) get silently re-locked because the
    // migration treats a missing Step-1 stamp on a complete tower as a
    // legacy backfill case. Mirrors the cascade `importOp.run` already
    // performs when a tower lead uploads a new map over the top.
    const cur = getAssessProgram().towers[towerId];
    const rowCount = cur?.l4Rows.length ?? 0;
    setTowerAssess(towerId, {
      l1L5TreeValidatedAt: undefined,
      l1L3TreeValidatedAt: undefined,
      status: rowCount > 0 ? "data" : "empty",
      headcountConfirmedAt: undefined,
      offshoreConfirmedAt: undefined,
      aiConfirmedAt: undefined,
      // Reopening Step 1 invalidates the Step 2 offshore split too — the
      // lanes may no longer cover every row after a map edit, and the
      // tower lead must re-confirm.
      offshoreViewValidatedAt: undefined,
    });
    if (sync?.canSync) await sync.flushSave();
    toast.info({
      title: "Capability map unlocked for editing",
      description:
        "Step 2 (Offshore View) and Step 3 (Impact Levers) are also back to pending sign-off — re-confirm once the map and GCC % decisions are workshop-ready.",
    });
  }, [sync, toast, towerId]);

  /** @deprecated Renamed to `markL1L5TreeValidated` in the 5-layer migration. */
  const markL1L3TreeValidated = markL1L5TreeValidated;
  /** @deprecated Renamed to `clearL1L5TreeValidation` in the 5-layer migration. */
  const clearL1L3TreeValidation = clearL1L5TreeValidation;

  // -------------------------------------------------------------------------
  //   Step 2 — Offshore View ops
  // -------------------------------------------------------------------------

  /**
   * Apply one or more `gccPct` decisions in a single atomic write. Each
   * change writes `r.gccPct` + provenance + reason, and ALSO mirrors the
   * new value into `r.offshoreAssessmentPct` so legacy roll-up math in
   * `scenarioModel.computeRowOffshore` (which still reads the dial)
   * continues to reconcile to Step 2 line-by-line.
   *
   * Also recomputes the parent L3 row's `offshoreAssessmentPct` as the
   * HC-weighted mean of its child L4 `gccPct`, so Step 3 (Impact Levers)
   * shows the right derived offshore $ without further refactor.
   */
  const applyGccPct = React.useCallback(
    async (
      changes: ReadonlyArray<{
        rowId: string;
        gccPct: number;
        setBy: GccPctSource;
        reason: string;
      }>,
    ) => {
      if (changes.length === 0) return;
      const cur = getAssessProgram().towers[towerId];
      if (!cur) return;
      const byId = new Map(changes.map((c) => [c.rowId, c] as const));
      const now = new Date().toISOString();
      const nextL4Rows: L4WorkforceRow[] = cur.l4Rows.map((r) => {
        const change = byId.get(r.id);
        if (!change) return r;
        const pct = clampPct(change.gccPct);
        const reason = change.reason.trim().slice(0, 200);
        const updated: L4WorkforceRow = {
          ...r,
          gccPct: pct,
          gccPctSetAt: now,
          gccPctSource: change.setBy,
          gccReason:
            reason.length > 0
              ? reason
              : r.gccReason || "Tower lead set GCC share without a written rationale.",
          offshoreAssessmentPct: pct,
        };
        return updated;
      });
      // Rebuild L3 offshore pct as the HC-weighted child L4 `gccPct`
      // mean. We ALWAYS derive a fresh L3 structure from `nextL4Rows`
      // first, then merge any pre-existing L3 metadata (AI impact dials,
      // curation stage, validated stamps) onto the derived skeleton.
      //
      // Why fresh: legacy / seed programs may persist L3 rows that
      // pre-date the `childL4RowIds` field, or whose children no longer
      // match the current L4 set after a re-upload. The previous "merge
      // into existing L3" path would silently bail out (`return l3`) in
      // those cases, leaving Step 3 reading the pre-cutover dial value
      // of 0% no matter how many times the tower lead saved a GCC %.
      // Deriving from L4 truth here makes the rollup self-healing.
      const l4ById = new Map(nextL4Rows.map((r) => [r.id, r] as const));
      const freshL3 = deriveL3Rows(nextL4Rows, towerId);
      const existingL3ById = new Map(
        (cur.l3Rows ?? []).map((r) => [r.id, r] as const),
      );
      const nextL3Rows = freshL3.map((derived) => {
        const existing = existingL3ById.get(derived.id);
        // Roll up gccPct across the (now guaranteed-current) child L4
        // ids. Empty (no headcount) groups fall back to the unweighted
        // mean so freshly-uploaded maps with all-zero HC still produce
        // a usable derived value.
        let pctNumer = 0;
        let weightDen = 0;
        let plainSum = 0;
        let plainN = 0;
        for (const childId of derived.childL4RowIds ?? []) {
          const child = l4ById.get(childId);
          if (!child) continue;
          const pct = clampPct(child.gccPct);
          const w = totalRowHc(child);
          pctNumer += pct * (w || 1);
          weightDen += w || 1;
          plainSum += pct;
          plainN += 1;
        }
        const derivedPct =
          plainN === 0
            ? 0
            : weightDen > 0
              ? pctNumer / weightDen
              : plainSum / plainN;
        // Preserve every non-structural field from the existing row —
        // AI impact dial, curation stage, validated stamps, etc. —
        // while structural fields and the derived offshore pct come
        // from the L4 truth.
        return {
          ...(existing ?? {}),
          ...derived,
          offshoreAssessmentPct: Math.round(derivedPct),
        };
      });
      setTowerAssess(towerId, { l4Rows: nextL4Rows, l3Rows: nextL3Rows });
      if (sync?.canSync) await sync.flushSave();
    },
    [sync, towerId],
  );

  /**
   * Bulk-apply a single `gccPct` value to every row in the tower. Used by
   * the Step 2 "Reset to AI suggestion" / "Mark every row at 0% (retained)
   * / 100% (GCC)" toolbar actions. Same semantics as `applyGccPct` over
   * the full row set.
   */
  const applyGccPctBulk = React.useCallback(
    async (gccPct: number, setBy: GccPctSource, reason: string) => {
      const cur = getAssessProgram().towers[towerId];
      if (!cur || cur.l4Rows.length === 0) return;
      const changes = cur.l4Rows.map((r) => ({
        rowId: r.id,
        gccPct,
        setBy,
        reason,
      }));
      await applyGccPct(changes);
    },
    [applyGccPct, towerId],
  );

  const markOffshoreClassificationValidated = React.useCallback(async () => {
    setTowerAssess(towerId, {
      offshoreViewValidatedAt: new Date().toISOString(),
    });
    if (sync?.canSync) await sync.flushSave();
    toast.success({
      title: `Step 2 locked for ${towerName}`,
      description:
        "Offshore split confirmed — Impact Levers now derives offshore $ from your GCC % decisions.",
      durationMs: 6500,
    });
  }, [sync, toast, towerId, towerName]);

  const clearOffshoreClassificationValidation = React.useCallback(async () => {
    setTowerAssess(towerId, { offshoreViewValidatedAt: undefined });
    if (sync?.canSync) await sync.flushSave();
    toast.info({
      title: "Offshore View unlocked for editing",
      description:
        "GCC % decisions are editable again — re-confirm Step 2 once the split matches your operating reality.",
    });
  }, [sync, toast, towerId]);

  return {
    program,
    tState,
    rows,
    rates,
    blanks,
    isComplete,
    hasHeadcount,
    hasAnyOffshoreInput,
    hasAnyAiInput,
    importOp,
    fillBlanksOp,
    overwriteAllOp,
    doMarkComplete,
    doUnmarkComplete,
    markL1L5TreeValidated,
    clearL1L5TreeValidation,
    applyGccPct,
    applyGccPctBulk,
    markOffshoreClassificationValidated,
    clearOffshoreClassificationValidation,
    /** @deprecated Renamed to `markL1L5TreeValidated` in the 5-layer migration. */
    markL1L3TreeValidated,
    /** @deprecated Renamed to `clearL1L5TreeValidation` in the 5-layer migration. */
    clearL1L3TreeValidation,
  };
}
