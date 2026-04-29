"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { TowerJourneyStepper } from "@/components/layout/TowerJourneyStepper";
import { useAssessSync } from "@/components/assess/AssessSyncProvider";
import { useToast } from "@/components/feedback/ToastProvider";
import { getAssessProgram, getAssessProgramHydrationSnapshot, setTowerAssess, subscribe } from "@/lib/localStore";
import { isCapabilityMapJourneyStepDone } from "@/lib/assess/capabilityMapStepStatus";
import { stepCompletionNudge } from "@/lib/program/stepCompletionNudges";
import type { TowerId } from "@/data/assess/types";
import type { TowerScopedModule } from "@/lib/towerHref";

export function TowerAiLeadToolbar({
  towerId,
  towerName,
}: {
  towerId: TowerId;
  towerName: string;
}) {
  const router = useRouter();
  const sync = useAssessSync();
  const toast = useToast();
  const [program, setProgram] = React.useState(() => getAssessProgramHydrationSnapshot());
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);

  const t = program.towers[towerId];
  const completed: TowerScopedModule[] = [];
  if (isCapabilityMapJourneyStepDone(t)) completed.push("capability-map");
  if (t?.status === "complete") completed.push("impact-levers");
  if (t?.aiInitiativesValidatedAt) completed.push("ai-initiatives");

  const reviewed = t?.aiInitiativesValidatedAt != null;

  const onMarkReviewed = async () => {
    setBusy(true);
    try {
      setTowerAssess(towerId, {
        aiInitiativesValidatedAt: new Date().toISOString(),
      });
      if (sync?.canSync) await sync.flushSave();
      const n = stepCompletionNudge(4, towerName);
      toast.success({ title: n.title, description: n.description, durationMs: 7000 });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-3">
      <TowerJourneyStepper
        towerId={towerId}
        towerName={towerName}
        current="ai-initiatives"
        completed={completed}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-forge-border bg-forge-surface/60 px-3 py-2.5">
        <p className="text-xs text-forge-subtle">
          Mark this tower when the AI initiative roadmap and four-lens views are ready for client
          discussion.
        </p>
        {reviewed ? (
          <span className="font-mono text-[11px] text-accent-green">Step 4 reviewed</span>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onMarkReviewed()}
            className="inline-flex shrink-0 items-center rounded-lg bg-accent-purple px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-purple-dark disabled:opacity-50"
          >
            {busy ? "Saving…" : "Mark Step 4 reviewed"}
          </button>
        )}
      </div>
    </div>
  );
}
