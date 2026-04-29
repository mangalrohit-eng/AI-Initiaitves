"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageShell } from "@/components/PageShell";
import { useAssessSync } from "@/components/assess/AssessSyncProvider";
import { useToast } from "@/components/feedback/ToastProvider";
import { towers } from "@/data/towers";
import type { TowerId, TowerLeadDeadlines } from "@/data/assess/types";
import {
  getAssessProgram,
  getAssessProgramHydrationSnapshot,
  subscribe,
  updateAssessProgram,
} from "@/lib/localStore";

function emptyRow(): TowerLeadDeadlines {
  return {};
}

export function LeadDeadlinesPageClient() {
  const router = useRouter();
  const sync = useAssessSync();
  const toast = useToast();
  const [draft, setDraft] = React.useState<Partial<Record<TowerId, TowerLeadDeadlines>>>(() =>
    structuredClone(getAssessProgramHydrationSnapshot().leadDeadlines ?? {}),
  );
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setDraft(structuredClone(getAssessProgram().leadDeadlines ?? {}));
    return subscribe("assessProgram", () => {
      setDraft(structuredClone(getAssessProgram().leadDeadlines ?? {}));
    });
  }, []);

  const setField = (tid: TowerId, field: keyof TowerLeadDeadlines, value: string) => {
    setDraft((prev) => {
      const next = { ...prev };
      const row = { ...(next[tid] ?? emptyRow()) };
      if (!value) {
        delete row[field];
      } else {
        row[field] = value;
      }
      if (Object.keys(row).length === 0) delete next[tid];
      else next[tid] = row;
      return next;
    });
  };

  const onSave = async () => {
    setSaving(true);
    try {
      updateAssessProgram((p) => ({
        ...p,
        leadDeadlines: Object.keys(draft).length > 0 ? draft : undefined,
      }));
      if (sync?.canSync) await sync.flushSave();
      toast.success({
        title: "Lead deadlines saved",
        description: "Tower leads will see chips on each step hub.",
      });
      router.refresh();
    } catch (e) {
      toast.error({
        title: "Couldn't save",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { label: "Program home", href: "/" },
            { label: "Lead deadlines" },
          ]}
        />
        <div className="mt-4">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-purple-dark">
            <span className="font-mono">&gt;</span>
            Program admin
          </div>
          <h1 className="mt-2 font-display text-2xl font-semibold text-forge-ink">
            &gt; Tower lead deadlines
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-forge-body">
            Set calendar due dates for each tower on Steps 1–4. Dates are interpreted as end of
            day in each lead&apos;s local browser timezone. Configure credentials via{" "}
            <span className="font-mono text-forge-subtle">FORGE_ADMIN_USERNAME</span>,{" "}
            <span className="font-mono text-forge-subtle">FORGE_ADMIN_PASSWORD</span>, and{" "}
            <span className="font-mono text-forge-subtle">FORGE_ADMIN_SECRET</span> on the server.
          </p>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-forge-border bg-forge-surface/60">
          <table className="w-full min-w-[720px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-forge-border bg-forge-well/40">
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-forge-hint">
                  Tower
                </th>
                <th className="px-2 py-2 font-mono text-[10px] uppercase tracking-wider text-forge-hint">
                  Step 1 due
                </th>
                <th className="px-2 py-2 font-mono text-[10px] uppercase tracking-wider text-forge-hint">
                  Step 2 due
                </th>
                <th className="px-2 py-2 font-mono text-[10px] uppercase tracking-wider text-forge-hint">
                  Step 3 due
                </th>
                <th className="px-2 py-2 font-mono text-[10px] uppercase tracking-wider text-forge-hint">
                  Step 4 due
                </th>
              </tr>
            </thead>
            <tbody>
              {towers.map((tw) => {
                const tid = tw.id as TowerId;
                const row = draft[tid] ?? {};
                return (
                  <tr key={tw.id} className="border-b border-forge-border/80 last:border-0">
                    <td className="px-3 py-2 font-medium text-forge-ink">{tw.name}</td>
                    {(["step1Due", "step2Due", "step3Due", "step4Due"] as const).map((f) => (
                      <td key={f} className="px-2 py-1.5">
                        <input
                          type="date"
                          value={row[f] ?? ""}
                          onChange={(e) => setField(tid, f, e.target.value)}
                          className="w-full max-w-[11rem] rounded-md border border-forge-border bg-forge-page px-2 py-1 font-mono text-[11px] text-forge-body focus:border-accent-purple focus:outline-none focus:ring-1 focus:ring-accent-purple/30"
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => void onSave()}
            className="inline-flex items-center rounded-lg bg-accent-purple px-4 py-2 text-sm font-semibold text-white hover:bg-accent-purple-dark disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save deadlines"}
          </button>
          <Link
            href="/capability-map"
            className="text-xs text-accent-purple-dark underline hover:text-accent-purple"
          >
            Back to Capability Map hub
          </Link>
          <Link
            href="/program/tower-status"
            className="text-xs text-accent-purple-dark underline hover:text-accent-purple"
          >
            Tower step status
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
