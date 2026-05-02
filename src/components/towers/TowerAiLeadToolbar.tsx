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
  const reviewedAt = t?.aiInitiativesValidatedAt;

  const fmtReviewed = (iso?: string) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return null;
    }
  };

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

  const onReopenReview = async () => {
    setBusy(true);
    try {
      setTowerAssess(towerId, { aiInitiativesValidatedAt: undefined });
      if (sync?.canSync) await sync.flushSave();
      toast.info({
        title: `${towerName} · Step 4 reopened for review`,
        description:
          "AI initiatives are back to awaiting tower-lead sign-off. Re-validate once the roadmap and agent architectures are workshop-ready.",
        action: { label: "Undo", onClick: () => void onMarkReviewed() },
        durationMs: 7000,
      });
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
      <div
        id="tower-lead-signoff"
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-forge-border bg-forge-surface/60 px-3 py-2.5"
      >
        <p className="text-xs text-forge-subtle">
          Mark this tower when the AI initiative roadmap and four-lens views are ready for client
          discussion.
        </p>
        {reviewed ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-green/40 bg-accent-green/10 px-2 py-0.5 text-[11px] font-medium text-accent-green">
              Reviewed
              {fmtReviewed(reviewedAt) ? (
                <span className="font-mono text-[10px] text-accent-green/80">
                  · {fmtReviewed(reviewedAt)}
                </span>
              ) : null}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onReopenReview()}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-forge-border bg-forge-surface px-3 py-1.5 text-xs font-medium text-forge-body transition hover:border-forge-border-strong disabled:opacity-50"
              title={`Reopen ${towerName} Step 4 for review`}
            >
              {busy ? "Saving…" : "Reopen for review"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onMarkReviewed()}
            className="inline-flex shrink-0 items-center rounded-lg bg-accent-purple px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-purple-dark disabled:opacity-50"
          >
            {busy ? "Saving…" : "Mark reviewed"}
          </button>
        )}
      </div>
    </div>
  );
}
